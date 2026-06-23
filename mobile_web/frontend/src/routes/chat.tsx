import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { BottomNav } from "@/components/BottomNav";
import { LANGS, useI18n } from "@/lib/i18n";
import { QUICK_CHIPS, BOOKS } from "@/lib/mock-data";
import { useSpeechRecognition, speak } from "@/lib/use-speech";
import { Mic, Send, Volume2, Map as MapIcon, X, Menu } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

export const Route = createFileRoute("/chat")({
  head: () => ({ meta: [{ title: "Libi Bot — Libi Bot 챗봇" }] }),
  component: ChatPage,
});

type Msg = { id: string; role: "user" | "bot"; text: string; showMap?: boolean; pending?: boolean };

// Same-origin path proxied to the local Ollama server by nginx (works through ngrok / external too).
const OLLAMA_URL = import.meta.env.VITE_OLLAMA_URL ?? "/ollama";
const OLLAMA_MODEL_KEY = "labi.ollamaModel";
const DEFAULT_OLLAMA_MODEL = import.meta.env.VITE_OLLAMA_MODEL ?? "qwen3:1.7b";

function getSelectedOllamaModel() {
  if (typeof window === "undefined") return DEFAULT_OLLAMA_MODEL;
  return localStorage.getItem(OLLAMA_MODEL_KEY) || DEFAULT_OLLAMA_MODEL;
}

async function askLocalLlm(
  input: string,
  lang: "KR" | "EN" | "ZH" | "VI",
  model: string,
  booksContext?: string,
  onToken?: (fullText: string) => void,
) {
  const languageName = {
    KR: "Korean",
    EN: "English",
    ZH: "Chinese",
    VI: "Vietnamese",
  }[lang];
  const endpoint = OLLAMA_URL.endsWith("/") ? OLLAMA_URL.slice(0, -1) : OLLAMA_URL;

  const response = await fetch(endpoint + "/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json", "ngrok-skip-browser-warning": "true" },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        {
          role: "system",
          content: [
            "You are Libi Bot, a helpful AI guide for a library app.",
            "You MUST write every reply only in " + languageName + ", regardless of the language the user writes in.",
            "Never answer in any other language.",
            "Keep answers concise and practical.",
            booksContext ? `Here is the current real-time library database containing books relevant to the user's query:\n${booksContext}\nAlways use this real database information to recommend books. If the user asks for loanable books (대출 가능한 책), recommend only the books in this list that have '대출 가능' status. Never recommend books that are not in the database if the user is asking for real books. Include their location (zone and shelf) in the response.` : "",
            "If the user asks about books, recommend concrete titles from the database list above or ask for the title or genre.",
            "If the user asks about facilities or shelf location, give a short directional answer.",
          ].join(" "),
        },
        { role: "user", content: input },
      ],
      options: {
        temperature: 0.4,
        num_ctx: 4096,
      },
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
        const chunk = JSON.parse(line) as { message?: { content?: string }; done?: boolean };
        const piece = chunk.message?.content;
        if (piece) {
          full += piece;
          onToken?.(full);
        }
      } catch {
        // ignore partial / malformed line
      }
    }
  }

  const text = full.trim();
  if (!text) throw new Error("Ollama returned an empty response");
  return text;
}

export function makeReply(input: string, lang: "KR" | "EN" | "ZH" | "VI"): { text: string; showMap?: boolean } {
  const q = input.toLowerCase();
  if (/(화장실|restroom|toilet|洗手|vệ sinh)/.test(q)) {
    return {
      text:
        lang === "KR"
          ? "화장실은 입구 오른쪽 끝, 외국도서 코너 옆에 있어요. (F-옆)"
          : lang === "EN"
            ? "The restroom is at the far right by the foreign-books section."
            : lang === "ZH"
              ? "洗手间在外文书区旁边,入口右侧尽头。"
              : "Nhà vệ sinh ở cuối bên phải lối vào, cạnh khu sách ngoại văn.",
      showMap: true,
    };
  }
  if (/(지도|map|地图|bản đồ)/.test(q)) {
    return { text: lang === "KR" ? "지도를 띄울게요." : "Opening the map.", showMap: true };
  }
  if (/(시집|poetry|诗|thơ|위로|comfort)/.test(q)) {
    return {
      text:
        lang === "KR"
          ? "위로가 필요할 땐 『불편한 편의점』(A-2 셋째 줄)을 추천드려요. 잔잔한 위로가 가득해요."
          : "I recommend 'The Uncanny Convenience Store' (A-2). A warm, comforting read.",
    };
  }
  if (/(경제|economy|经济|kinh tế)/.test(q)) {
    return {
      text:
        lang === "KR"
          ? "오늘 대출 가능한 경제 신간으로는 『트렌드 코리아 2026』(E-1 첫째 줄)이 있어요."
          : "'Trend Korea 2026' (E-1) is in stock today.",
    };
  }
  // fallback: try to match a book
  const found = BOOKS.find((b) => b.title[lang].toLowerCase().includes(q) || b.title.KR.includes(input));
  if (found) {
    return {
      text:
        lang === "KR"
          ? `『${found.title.KR}』은(는) ${found.zone} ${found.shelf}에 있어요. ${found.inStock ? "대출 가능 ✅" : "현재 대출 중입니다."}`
          : `'${found.title[lang]}' is at ${found.zone}. ${found.inStock ? "In stock." : "Sold out."}`,
      showMap: found.inStock,
    };
  }
  return {
    text:
      lang === "KR"
        ? "외국도서 코너는 1층 왼쪽 끝(F-2)이에요. 더 구체적으로 책 제목을 알려주시면 위치까지 안내해드릴게요."
        : "Could you share a title or topic? I'll guide you to the exact shelf.",
  };
}

const mdComponents: Components = {
  p: ({ node: _n, ...props }) => <p className="my-1 first:mt-0 last:mb-0" {...props} />,
  ul: ({ node: _n, ...props }) => <ul className="my-1 list-disc space-y-0.5 pl-5" {...props} />,
  ol: ({ node: _n, ...props }) => <ol className="my-1 list-decimal space-y-0.5 pl-5" {...props} />,
  li: ({ node: _n, ...props }) => <li className="leading-snug marker:text-muted-foreground" {...props} />,
  strong: ({ node: _n, ...props }) => <strong className="font-semibold text-foreground" {...props} />,
  em: ({ node: _n, ...props }) => <em className="italic" {...props} />,
  a: ({ node: _n, ...props }) => (
    <a className="text-primary underline underline-offset-2" target="_blank" rel="noreferrer" {...props} />
  ),
  h1: ({ node: _n, ...props }) => <h3 className="mb-1 mt-2 text-base font-bold first:mt-0" {...props} />,
  h2: ({ node: _n, ...props }) => <h3 className="mb-1 mt-2 text-base font-bold first:mt-0" {...props} />,
  h3: ({ node: _n, ...props }) => <h3 className="mb-1 mt-2 text-sm font-bold first:mt-0" {...props} />,
  code: ({ node: _n, ...props }) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]" {...props} />
  ),
  hr: () => <hr className="my-2 border-border" />,
  blockquote: ({ node: _n, ...props }) => (
    <blockquote className="my-1 border-l-2 border-border pl-3 text-muted-foreground" {...props} />
  ),
};

function MessageMarkdown({ text }: { text: string }) {
  return (
    <div className="leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

function greetingFor(lang: "KR" | "EN" | "ZH" | "VI") {
  return lang === "KR"
    ? "안녕하세요! 저는 도서관 가이드 Libi Bot이에요. 책 제목, 장르, 또는 시설 위치 무엇이든 물어봐 주세요 😊"
    : lang === "EN"
      ? "Hi! I'm Libi Bot, your library guide. Ask me about any book, topic or facility."
      : lang === "ZH"
        ? "您好,我是书店向导 Libi Bot,请随意询问任何书籍或设施。"
        : "Xin chào! Tôi là Libi Bot, hướng dẫn viên nhà sách.";
}

function ChatPage() {
  const { lang, tr } = useI18n();
  const speechLang = LANGS.find((l) => l.code === lang)?.speech ?? "ko-KR";
  const { listening, transcript, start, stop, setTranscript } = useSpeechRecognition(speechLang);

  const [messages, setMessages] = useState<Msg[]>([
    { id: "init", role: "bot", text: greetingFor(lang) },
  ]);
  const [input, setInput] = useState("");
  const [mapOpen, setMapOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, mapOpen]);

  // keep the greeting in sync with the selected language (only before the chat starts)
  useEffect(() => {
    setMessages((m) =>
      m.length === 1 && m[0].id === "init" ? [{ ...m[0], text: greetingFor(lang) }] : m,
    );
  }, [lang]);

  useEffect(() => {
    if (transcript) setInput(transcript);
  }, [transcript]);

  useEffect(() => {
    if (!listening && transcript.trim()) {
      const text = transcript.trim();
      setTranscript("");
      setInput("");
      void send(text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening]);

  const send = async (text: string) => {
    if (!text.trim()) return;
    const userMsg: Msg = { id: Math.random().toString(36), role: "user", text };
    const pendingId = Math.random().toString(36) + "p";
    setMessages((m) => [
      ...m,
      userMsg,
      {
        id: pendingId,
        role: "bot",
        text: lang === "KR" ? "Libi Bot이 로컬 LLM으로 답변을 작성 중이에요..." : "Libi Bot is thinking locally...",
        pending: true,
      },
    ]);
    setInput("");

    // Fetch database books for RAG context
    let dbBooks: any[] = [];
    try {
      const res = await fetch("/api/books");
      if (res.ok) {
        dbBooks = await res.json();
      }
    } catch (e) {
      console.error("Failed to fetch books from DB", e);
    }

    // Filter books based on query keywords
    let relevantBooks = dbBooks;
    const q = text.toLowerCase();
    
    if (q.includes("경제") || q.includes("finance") || q.includes("economy") || q.includes("돈") || q.includes("주식")) {
      relevantBooks = dbBooks.filter(b => b.category === "경제" || b.category?.includes("경제") || b.title.KR.includes("경제"));
    } else if (q.includes("소설") || q.includes("novel") || q.includes("문학")) {
      relevantBooks = dbBooks.filter(b => b.category === "소설" || b.category?.includes("소설"));
    } else if (q.includes("자기계발") || q.includes("self") || q.includes("성공")) {
      relevantBooks = dbBooks.filter(b => b.category === "자기계발" || b.category?.includes("자기계발"));
    } else if (q.includes("외국") || q.includes("foreign") || q.includes("영어")) {
      relevantBooks = dbBooks.filter(b => b.category === "외국도서" || b.category?.includes("외국"));
    } else {
      // search title or author
      relevantBooks = dbBooks.filter(b => 
        b.title.KR.toLowerCase().includes(q) || 
        b.author.toLowerCase().includes(q)
      );
    }

    const maxContextBooks = relevantBooks.slice(0, 15);
    const booksContext = maxContextBooks.length > 0 
      ? maxContextBooks.map(b => 
          `- 제목: ${b.title.KR}, 저자: ${b.author}, 카테고리: ${b.category}, 위치: ${b.zone} 구역 (${b.shelf}), 대출상태: ${b.inStock ? "대출 가능" : "대출 중"}`
        ).join("\n")
      : "";

    try {
      const model = getSelectedOllamaModel();
      const showMap = /(화장실|restroom|toilet|지도|map|洗手|地图|vệ sinh|bản đồ)/i.test(text);
      // stream tokens in as they arrive (typing effect)
      await askLocalLlm(text, lang, model, booksContext, (full) => {
        setMessages((m) =>
          m.map((msg) => (msg.id === pendingId ? { ...msg, text: full, pending: false } : msg)),
        );
      });
      setMessages((m) =>
        m.map((msg) => (msg.id === pendingId ? { ...msg, showMap, pending: false } : msg)),
      );
      if (showMap) setTimeout(() => setMapOpen(true), 400);
    } catch (error) {
      console.error(error);
      
      // Smart local search fallback using DB books
      let fallbackText = "";
      let showMap = false;

      if (dbBooks.length > 0) {
        if (q.includes("경제") || q.includes("finance") || q.includes("economy")) {
          const economics = dbBooks.filter(b => (b.category === "경제" || b.category?.includes("경제")) && b.inStock);
          if (economics.length > 0) {
            fallbackText = `📚 오늘 대출 가능한 경제 서적 중 인기 있는 책들을 추천합니다:\n\n` + 
              economics.slice(0, 3).map(b => `• **"${b.title.KR}"** (${b.author}) - 위치: ${b.zone} 구역 (${b.shelf})`).join("\n") +
              `\n\n원하시면 도서 검색 메뉴에서 직접 책을 검색해 로봇을 호출하거나, 특정 분야 또는 최근 도서를 알려주세요!`;
          } else {
            fallbackText = `오늘 대출 가능한 경제 서적이 도서관에 남아있지 않습니다.`;
          }
        } else {
          // general book match
          const found = dbBooks.find(b => b.title.KR.toLowerCase().includes(q) || b.author.toLowerCase().includes(q));
          if (found) {
            fallbackText = `『${found.title.KR}』 (${found.author})은(는) 현재 ${found.zone} 구역 서가(${found.shelf})에 위치하고 있으며, ${found.inStock ? "대출 가능 ✅" : "대출 중 ❌"} 상태입니다.`;
            showMap = found.inStock;
          }
        }
      }

      if (!fallbackText) {
        const reply = makeReply(text, lang);
        fallbackText = reply.text;
        showMap = reply.showMap;
      }

      const suffix =
        lang === "KR"
          ? "(로컬 LLM 연결 실패로 실시간 DB 정보를 직접 검색하여 답변해 드렸습니다.)"
          : lang === "EN"
            ? "(Used real-time DB fallback because local LLM was unavailable.)"
            : lang === "ZH"
              ? "(本地 LLM 连接失败,已使用实时数据库指引。)"
              : "(Đã dùng hướng dẫn thực tế vì không kết nối được LLM cục bộ.)";
              
      setMessages((m) =>
        m.map((msg) =>
          msg.id === pendingId
            ? { ...msg, text: fallbackText + "\n\n" + suffix, showMap, pending: false }
            : msg,
        ),
      );
      if (showMap) setTimeout(() => setMapOpen(true), 400);
    }
  };

  return (
    <AppShell showNav={false}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pt-4 pb-36">
          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow">
                  {m.text}
                </div>
              </div>
            ) : (
              <div key={m.id} className="flex gap-2">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm">
                  📚
                </div>
                <div className="max-w-[80%]">
                  <div className="rounded-2xl rounded-tl-sm bg-card px-4 py-2.5 text-sm text-foreground shadow-card">
                    {m.pending ? (
                      <span className="inline-flex items-center gap-1 py-1" aria-label="작성 중">
                        <span className="wave-dot" />
                        <span className="wave-dot [animation-delay:0.15s]" />
                        <span className="wave-dot [animation-delay:0.3s]" />
                      </span>
                    ) : (
                      <MessageMarkdown text={m.text} />
                    )}
                  </div>
                  <div className="mt-1 flex gap-2 px-1">
                    <button
                      onClick={() => speak(m.text, speechLang)}
                      disabled={m.pending}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground"
                    >
                      <Volume2 className="size-3" />
                      듣기
                    </button>
                    {m.showMap && (
                      <button
                        onClick={() => setMapOpen(true)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-primary"
                      >
                        <MapIcon className="size-3" />
                        지도 보기
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ),
          )}
        </div>

        {/* fixed bottom footer: chips + input */}
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md bg-background">
          {/* quick chips */}
          <div className="flex gap-2 overflow-x-auto px-4 pb-2 pt-2">
            {QUICK_CHIPS[lang].map((c) => (
            <button
              key={c}
              onClick={() => void send(c)}
              className="shrink-0 rounded-full bg-primary-soft px-3 py-1.5 text-[11px] font-semibold text-primary"
            >
              {c}
            </button>
          ))}
        </div>

        {/* input (fixed at bottom) */}
        <div className="shrink-0 border-t border-border bg-card p-3 safe-bottom">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="flex items-center gap-2"
          >
            {/* hamburger → opens bottom menu */}
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
              aria-label="menu"
            >
              <Menu className="size-5" />
            </button>

            {/* input with mic inside on the left */}
            <div className="relative flex-1">
              <button
                type="button"
                onClick={() => (listening ? stop() : start())}
                className={`absolute left-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full transition-colors ${
                  listening
                    ? "bg-accent text-accent-foreground voice-pulse"
                    : "text-primary hover:bg-primary-soft"
                }`}
                aria-label="voice"
              >
                <Mic className="size-4" />
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={listening ? tr("listening") : tr("chatPh")}
                className="h-11 w-full rounded-full border border-border bg-background pl-11 pr-4 text-sm outline-none focus:border-primary"
              />
            </div>

            <button
              type="submit"
              disabled={!input.trim()}
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
            >
              <Send className="size-5" />
            </button>
          </form>
          </div>
        </div>

        {/* slide-up map */}
        {mapOpen && (
          <div className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md animate-in slide-in-from-bottom rounded-t-3xl border-t border-border bg-card p-5 shadow-float">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold text-foreground">📍 도서관 지도</h3>
              <button onClick={() => setMapOpen(false)} aria-label="close">
                <X className="size-5 text-muted-foreground" />
              </button>
            </div>
            <div className="relative aspect-video overflow-hidden rounded-xl bg-paper ring-1 ring-border">
              <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(to_right,oklch(0.27_0.12_273)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.27_0.12_273)_1px,transparent_1px)] [background-size:20px_20px]" />
              <div className="absolute left-[10%] top-[10%] flex h-1/3 w-1/3 items-center justify-center rounded bg-rose-200 ring-2 ring-primary text-xs font-bold">
                A · 소설
              </div>
              <div className="absolute right-[10%] top-[55%] flex h-1/3 w-1/3 items-center justify-center rounded bg-stone-200 text-xs font-bold">
                화장실
              </div>
              <div className="absolute bottom-2 left-2 rounded-full bg-primary px-3 py-1 text-[10px] font-bold text-primary-foreground">
                📍 현위치
              </div>
            </div>
            <button
              onClick={() => setMapOpen(false)}
              className="mt-4 h-11 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground"
            >
              대화로 돌아가기
            </button>
          </div>
        )}

        {/* slide-up bottom menu (opened by hamburger) */}
        {navOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/20"
              onClick={() => setNavOpen(false)}
            />
            <div
              className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md animate-in slide-in-from-bottom"
              onClick={() => setNavOpen(false)}
            >
              <BottomNav />
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
