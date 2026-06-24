import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare, Send, Bot, User, Cpu } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { adminApi } from "@/lib/admin-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/_authed/chat")({
  component: ChatPage,
});

type MessageItem = {
  id: string | number;
  role: "user" | "assistant" | "system";
  content: string;
  pending?: boolean;
};

const OLLAMA_URL = "/ollama";
const DEFAULT_MODEL = "qwen3:1.7b";
const SESSION_ID = "admin-robot-control-session";

function tryParseRobotCommand(text: string): { robot_type: string; action: string; parameters: any } | null {
  const q = text.toLowerCase().trim();

  // Mobile Robot commands
  if (/(앞으로|전진)/.test(q)) {
    const distMatch = q.match(/([\d\.]+)\s*(초|미터|m|초 동안)/);
    const duration = distMatch ? parseFloat(distMatch[1]) : 1.0;
    return {
      robot_type: "mobile",
      action: "move",
      parameters: { left: 50, right: 50, duration }
    };
  }
  if (/(뒤로|후진)/.test(q)) {
    const distMatch = q.match(/([\d\.]+)\s*(초|미터|m|초 동안)/);
    const duration = distMatch ? parseFloat(distMatch[1]) : 1.0;
    return {
      robot_type: "mobile",
      action: "move",
      parameters: { left: -50, right: -50, duration }
    };
  }
  if (/(좌회전|왼쪽으로)/.test(q)) {
    return {
      robot_type: "mobile",
      action: "move",
      parameters: { left: -40, right: 40, duration: 0.8 }
    };
  }
  if (/(우회전|오른쪽으로)/.test(q)) {
    return {
      robot_type: "mobile",
      action: "move",
      parameters: { left: 40, right: -40, duration: 0.8 }
    };
  }
  if (/(정지|멈춰|멈춤|스톱|stop)/i.test(q)) {
    if (/팔/.test(q)) {
      return {
        robot_type: "arm",
        action: "stop",
        parameters: {}
      };
    }
    return {
      robot_type: "mobile",
      action: "stop",
      parameters: {}
    };
  }
  if (/(웃어줘|표정|행복|해피|happy)/.test(q)) {
    return {
      robot_type: "mobile",
      action: "emotion",
      parameters: { emotion: "happy" }
    };
  }
  if (/(슬픈|슬퍼)/.test(q)) {
    return {
      robot_type: "mobile",
      action: "emotion",
      parameters: { emotion: "sad" }
    };
  }
  if (/(화나|화내)/.test(q)) {
    return {
      robot_type: "mobile",
      action: "emotion",
      parameters: { emotion: "angry" }
    };
  }
  if (/(소리|벨|삐|비프|소리내)/.test(q)) {
    return {
      robot_type: "mobile",
      action: "buzzer",
      parameters: { preset: "bell", count: 1 }
    };
  }

  // Robot Arm commands
  if (/로봇팔.*(원위치|홈|home)/.test(q) || /(팔.*홈)/.test(q)) {
    return {
      robot_type: "arm",
      action: "home",
      parameters: {}
    };
  }
  if (/(얼굴\s*추적|얼굴\s*따라|얼굴\s*추적\s*시작)/.test(q)) {
    return {
      robot_type: "arm",
      action: "face-track",
      parameters: { start: true }
    };
  }
  if (/(얼굴\s*추적\s*중지|얼굴\s*추적\s*멈춰)/.test(q)) {
    return {
      robot_type: "arm",
      action: "face-track",
      parameters: { start: false }
    };
  }
  if (/(사물\s*인식|객체\s*인식|물건\s*인식)/.test(q)) {
    return {
      robot_type: "arm",
      action: "classify",
      parameters: { start: true }
    };
  }
  if (/(글자\s*인식|텍스트\s*인식|ocr|글씨\s*인식)/i.test(q)) {
    return {
      robot_type: "arm",
      action: "ocr",
      parameters: { start: true }
    };
  }

  return null;
}

function isControlRelated(text: string): boolean {
  const q = text.toLowerCase().trim();
  const keywords = [
    "앞", "뒤", "좌", "우", "전진", "후진", "회전", "돌아", "멈", "정지", "스톱", "stop",
    "lcd", "눈", "표정", "웃어", "화내", "슬퍼", "감정", "텍스트", "글자", "글씨",
    "소리", "벨", "삐", "비프", "부저", "buzzer", "음향",
    "로봇팔", "팔", "원위치", "홈", "home", "앵글", "각도", "그리퍼", "집어", "잡아",
    "추적", "인식", "분류", "카메라", "ocr", "face", "gesture", "classify", "barcode", "qr", "블록", "색상"
  ];
  return keywords.some(k => q.includes(k));
}

async function askLocalLlm(input: string, onToken?: (fullText: string) => void) {
  const systemLines = [
    "You are Labi Bot, a robot controller helper.",
    "Your ONLY job is to convert natural language robot control commands into JSON command sequences.",
    "If the user input is NOT related to controlling the mobile robot or the robot arm (e.g. general questions like '한국의 수도는', '날씨 어때', general chit-chat, greetings, or common sense), you MUST reply exactly: '로봇 관련 제어 명령어만 입력해 주세요.'",
    "Do NOT answer general questions. Only respond to robot commands.",
    "You MUST reply in Korean.",
    "If the user commands you to move or control the mobile robot or robot arm (e.g. '앞으로 가줘', '로봇팔 원위치'), you MUST start your response with exact JSON string:",
    "CMD:{\"robot_type\": \"mobile\"|\"arm\", \"action\": \"...\", \"parameters\": {...}}",
    "supported actions: 'move' (params: left, right, duration), 'stop', 'emotion' (params: emotion), 'buzzer', 'home', 'angles', 'face-track' (params: start:true/false), 'classify' (params: start:true/false), 'ocr' (params: start:true/false). Examples: CMD:{\"robot_type\":\"mobile\",\"action\":\"move\",\"parameters\":{\"left\":50,\"right\":50,\"duration\":1.0}} or CMD:{\"robot_type\":\"arm\",\"action\":\"home\",\"parameters\":{}}",
  ];

  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      stream: true,
      messages: [
        { role: "system", content: systemLines.join("\n") },
        { role: "user", content: input },
      ],
      options: { temperature: 0.4, num_ctx: 4096 },
    }),
  });

  if (!response.ok || !response.body) throw new Error("Ollama request failed: " + response.status);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      try {
        const chunk = JSON.parse(line) as { message?: { content?: string } };
        const piece = chunk.message?.content;
        if (piece) {
          full += piece;
          onToken?.(full);
        }
      } catch {
        // ignore
      }
    }
  }

  return full.trim();
}

function ChatPage() {
  const qc = useQueryClient();
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load chat history from SQLite DB
  const historyQuery = useQuery({
    queryKey: ["chat", "history", SESSION_ID],
    queryFn: () => adminApi.getChatHistory(SESSION_ID),
  });

  useEffect(() => {
    if (historyQuery.data) {
      setMessages(
        historyQuery.data.map((m) => ({
          id: m.id,
          role: m.role as any,
          content: m.content,
        }))
      );
    }
  }, [historyQuery.data]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const sendCommandMut = useMutation({
    mutationFn: adminApi.executeChatCommand,
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["chat", "history"] });
    },
    onError: (err) => {
      toast.error("로봇 명령 실행 오류");
    }
  });

  const handleSend = async (text: string) => {
    if (!text.trim() || loading) return;
    setLoading(true);
    setInput("");

    // Add user message
    const userMsg: MessageItem = { id: Date.now().toString(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);

    const pendingId = Date.now().toString() + "p";
    setMessages((prev) => [
      ...prev,
      { id: pendingId, role: "assistant", content: "자연어 분석 중...", pending: true }
    ]);

    // 1. Direct Regex Match
    const directCmd = tryParseRobotCommand(text);
    if (directCmd) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? { ...m, content: `🤖 로봇 지시 명령 실행 중입니다... (${directCmd.robot_type} - ${directCmd.action})` }
            : m
        )
      );

      try {
        const result = await sendCommandMut.mutateAsync({
          session_id: SESSION_ID,
          user_message: text,
          robot_type: directCmd.robot_type,
          action: directCmd.action,
          parameters: directCmd.parameters,
        });

        const successMsg = result.success
          ? `🤖 로봇 명령이 성공적으로 실행되었습니다.\n\n- 대상: ${directCmd.robot_type}\n- 동작: ${directCmd.action}`
          : `❌ 로봇 명령 실행에 실패했습니다.\n\n오류: ${result.response || "알 수 없는 에러"}`;

        setMessages((prev) =>
          prev.map((m) => (m.id === pendingId ? { ...m, content: successMsg, pending: false } : m))
        );
      } catch (err) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? { ...m, content: "❌ 로봇 명령 실행 중 오류가 발생했습니다.", pending: false }
              : m
          )
        );
      } finally {
        setLoading(false);
      }
      return;
    }

    // 2. Local LLM Request
    if (!isControlRelated(text)) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? { ...m, content: "로봇 관련 제어 명령어만 입력해 주세요.", pending: false }
            : m
        )
      );
      setLoading(false);
      return;
    }

    try {
      let robotCmdJson: string | null = null;
      await askLocalLlm(text, (full) => {
        if (full.startsWith("CMD:")) {
          robotCmdJson = full;
        } else {
          setMessages((prev) =>
            prev.map((m) => (m.id === pendingId ? { ...m, content: full, pending: false } : m))
          );
        }
      });

      if (robotCmdJson) {
        try {
          const jsonStr = robotCmdJson.replace(/^CMD:/, "").trim();
          const parsed = JSON.parse(jsonStr);

          setMessages((prev) =>
            prev.map((m) =>
              m.id === pendingId
                ? { ...m, content: `🤖 분석 완료. 로봇 명령을 실행 중입니다... (${parsed.robot_type} - ${parsed.action})` }
                : m
            )
          );

          const result = await sendCommandMut.mutateAsync({
            session_id: SESSION_ID,
            user_message: text,
            robot_type: parsed.robot_type,
            action: parsed.action,
            parameters: parsed.parameters,
          });

          const successMsg = result.success
            ? `🤖 로봇 명령이 성공적으로 실행되었습니다.\n\n- 대상: ${parsed.robot_type}\n- 동작: ${parsed.action}`
            : `❌ 로봇 명령 실행에 실패했습니다.\n\n오류: ${result.response || "알 수 없는 에러"}`;

          setMessages((prev) =>
            prev.map((m) => (m.id === pendingId ? { ...m, content: successMsg, pending: false } : m))
          );
        } catch (err) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === pendingId
                ? { ...m, content: "❌ LLM 파싱 오류 혹은 명령 실행 중 오류가 발생했습니다.", pending: false }
                : m
            )
          );
        }
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? { ...m, content: "❌ 로컬 LLM 서버(Ollama)에 접속할 수 없습니다. 모델 기동 여부를 확인해 주세요.", pending: false }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminShell title="챗봇 제어">
      <div className="grid gap-4 md:grid-cols-3">
        {/* Left 2 cols: Chat Room */}
        <Card className="md:col-span-2 flex flex-col h-[70vh]">
          <CardHeader className="border-b border-slate-100 py-3 shrink-0">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" /> 로컬 LLM 로봇 대화형 콘솔
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 flex flex-col p-4">
            {/* Scrollable messages area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-2 mb-4">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                  <Bot className="h-8 w-8 text-slate-300" />
                  <p className="text-xs">명령어나 질문을 아래 입력해 보세요.</p>
                </div>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "flex gap-3 text-sm max-w-[85%]",
                    m.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full border text-xs shadow-sm",
                      m.role === "user" ? "bg-primary text-primary-foreground border-primary" : "bg-white text-slate-700 border-slate-200"
                    )}
                  >
                    {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-2 text-leading shadow-sm whitespace-pre-wrap",
                      m.role === "user" ? "rounded-tr-sm bg-primary text-primary-foreground" : "rounded-tl-sm bg-slate-50 border border-slate-100 text-slate-800"
                    )}
                  >
                    {m.pending && m.content === "자연어 분석 중..." ? (
                      <span className="inline-flex items-center gap-1 py-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" />
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]" />
                      </span>
                    ) : (
                      m.content
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Input area */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSend(input);
              }}
              className="flex items-center gap-2 shrink-0 border-t border-slate-100 pt-3"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="로봇 지시사항을 자연어로 입력해 보세요... (예: 앞으로 가줘, 로봇팔 홈으로 가)"
                className="flex-1"
                disabled={loading}
              />
              <Button type="submit" disabled={!input.trim() || loading} size="icon">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Right 1 col: Commands Guide */}
        <Card className="flex flex-col h-[70vh]">
          <CardHeader className="border-b border-slate-100 py-3 shrink-0">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Cpu className="h-4 w-4 text-emerald-600" /> 제어 명령어 가이드
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 overflow-y-auto space-y-4 text-xs">
            <div>
              <h4 className="font-bold text-slate-800 mb-1 flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-orange-500" /> 주행 로봇 (PinkyPro)
              </h4>
              <ul className="space-y-1.5 text-slate-600 pl-3 border-l border-orange-100">
                <li>• <b>전진</b>: "앞으로 가줘", "전진 2초 동안"</li>
                <li>• <b>후진</b>: "뒤로 가줘", "후진해줘"</li>
                <li>• <b>회전</b>: "좌회전 해줘", "오른쪽으로 돌아줘"</li>
                <li>• <b>정지</b>: "정지", "멈춰", "로봇 정지"</li>
                <li>• <b>표정</b>: "웃어줘", "화내줘", "슬픈 표정"</li>
                <li>• <b>사운드</b>: "벨 소리 내줘", "삐 소리내"</li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-slate-800 mb-1 flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> 로봇팔 (JetCobot)
              </h4>
              <ul className="space-y-1.5 text-slate-600 pl-3 border-l border-emerald-100">
                <li>• <b>원위치</b>: "로봇팔 홈으로 가", "로봇팔 원위치"</li>
                <li>• <b>정지</b>: "로봇팔 정지", "로봇팔 멈춰"</li>
                <li>• <b>얼굴 추적</b>: "얼굴 추적 시작해줘", "얼굴 추적 중지"</li>
                <li>• <b>사물 인식</b>: "사물 인식 시작해", "사물 인식 정지"</li>
                <li>• <b>글자 인식 (OCR)</b>: "글자 인식 시작해", "글씨 인식 정지"</li>
              </ul>
            </div>

            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-[11px] text-slate-500 leading-normal">
              💬 <b>작동 원리:</b> 챗봇이 자연어 의도를 분석한 뒤, 해당 명령을 SQLite 데이터베이스(`conversations`, `messages` 테이블)에 기록하고 로봇 하드웨어에 직접 명령을 내려 실시간 구동시킵니다.
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
