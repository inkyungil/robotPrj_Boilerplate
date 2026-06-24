import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Camera, Cpu, Monitor, ScanEye, SlidersHorizontal, Server, Square, Type } from "lucide-react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useCameraFrame } from "@/hooks/useCameraFrame";
import { useActiveRobotBase } from "@/lib/active-robot";
import { adminApi, type LcdTextConfig } from "@/lib/admin-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/_authed/pinky-detect")({
  component: RobotPinkyDetectPage,
});

type Detection = {
  class_id: number;
  label: string;
  confidence: number;
  box: [number, number, number, number];
};

type ModelStatus = {
  available: boolean;
  loaded: boolean;
  model_path: string;
  classes: string[];
  confidence: number;
  error: string | null;
};

const LS_SERVER_KEY = "pinky-detect.ai-server";   // 로봇팔과 AI 서버 공유

const DEFAULT_AI_SERVER = "192.168.0.9:9001";

function buildBase(aiServer: string): string {
  const trimmed = aiServer.trim();
  if (!trimmed) return `http://${DEFAULT_AI_SERVER}`;
  if (trimmed.startsWith("http")) return trimmed.replace(/\/$/, "");
  return `http://${trimmed}`;
}

function extractHostname(base: string): string {
  try {
    return new URL(base).hostname;
  } catch {
    return base.replace(/https?:\/\//, "").split(":")[0];
  }
}

function RobotPinkyDetectPage() {
  const robotBase = useActiveRobotBase();
  const robotHostname = extractHostname(robotBase);

  const [aiServer, setAiServer] = useState<string>(
    () => localStorage.getItem(LS_SERVER_KEY) ?? DEFAULT_AI_SERVER,
  );
  const [aiServerInput, setAiServerInput] = useState<string>(
    () => localStorage.getItem(LS_SERVER_KEY) ?? DEFAULT_AI_SERVER,
  );

  const [running, setRunning] = useState(false);
  const [connected, setConnected] = useState(false);
  const [confidence, setConfidence] = useState(0.7);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [inferenceMs, setInferenceMs] = useState<number | null>(null);
  const [status, setStatus] = useState<ModelStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const { frameUrl, pushFrame } = useCameraFrame();

  // LCD 설정 상태
  const [lcdText, setLcdText] = useState("안녕하세요!\nPinky Pro 감지됨 :)");
  const [lcdFont, setLcdFont] = useState("default");
  const [lcdSize, setLcdSize] = useState(28);
  const [lcdColor, setLcdColor] = useState("#ffffff");
  const [lcdBgColor, setLcdBgColor] = useState("#000000");
  const [lcdAlign, setLcdAlign] = useState<"left" | "center" | "right">("center");
  const [autoSend, setAutoSend] = useState(false);
  const autoSentRef = useRef(false);

  const { data: fontsData } = useQuery({
    queryKey: ["robot", "fonts"],
    queryFn: adminApi.listFonts,
  });

  const lcdMut = useMutation({
    mutationFn: (cfg: LcdTextConfig) => adminApi.lcdText(cfg),
    onSuccess: () => toast.success("LCD에 텍스트 전송 완료"),
    onError: () => toast.error("LCD 전송 실패"),
  });

  const lcdStopMut = useMutation({
    mutationFn: () => adminApi.lcdStop(),
    onSuccess: () => toast.success("LCD 화면 끄기 완료"),
    onError: () => toast.error("LCD 끄기 실패"),
  });

  const sendLcd = () => lcdMut.mutate({
    text: lcdText,
    font_name: lcdFont,
    font_size: lcdSize,
    color: lcdColor,
    bg_color: lcdBgColor,
    align: lcdAlign,
  });

  // 핑키 감지 시 자동 전송 / 감지 사라지면 LCD 끄기
  useEffect(() => {
    const pinkyDetected = detections.some((d) => d.label === "pinky_63");
    if (autoSend) {
      if (pinkyDetected && !autoSentRef.current) {
        autoSentRef.current = true;
        sendLcd();
      } else if (!pinkyDetected && autoSentRef.current) {
        autoSentRef.current = false;
        lcdStopMut.mutate();
      }
    }
    if (!autoSend) {
      autoSentRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detections, autoSend]);

  const base = buildBase(aiServer);

  function saveAiServer() {
    const v = aiServerInput.trim();
    setAiServer(v);
    localStorage.setItem(LS_SERVER_KEY, v);
  }



  useEffect(() => {
    const url = `${base}/api/arm/pinky-detect/status`;
    console.log("[robot-pinky-detect] 상태 조회 →", url);
    fetch(url)
      .then((r) => {
        if (r.status === 404) throw new Error(
          "YOLO API 미지원 — 해당 서버에 ultralytics가 설치되어 있지 않습니다.",
        );
        if (!r.ok) throw new Error(`서버 오류: ${r.status}`);
        return r.json();
      })
      .then((data: ModelStatus) => {
        console.log("[robot-pinky-detect] 상태 수신 ←", data);
        setStatus(data);
        setConfidence(data.confidence);
        setError(data.error);
      })
      .catch((e: Error) => {
        console.error("[robot-pinky-detect] 상태 조회 실패:", e.message);
        setStatus(null);
        setError(e.message);
      });
    return () => wsRef.current?.close();
  }, [base]);

  const stop = () => {
    console.log("[robot-pinky-detect] 인식 중지");
    wsRef.current?.close();
    wsRef.current = null;
    setRunning(false);
    setConnected(false);
  };

  const start = () => {
    stop();
    setError(null);
    setRunning(true);

    const wsBase = base.replace(/^http/, "ws");
    // 로컬 모드: robot_ip 없이 → 해당 로봇에서 직접 YOLO 추론
    // 서버 모드: robot_ip 전달 → AI서버가 로봇 카메라를 가져옴
    const wsUrl = `${wsBase}/api/arm/pinky-detect/ws?robot_ip=${encodeURIComponent(robotHostname)}`;

    console.log("[robot-pinky-detect] WS 연결 시도 →", wsUrl, `(서버 모드, robot=${robotHostname})`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onopen = () => {
      console.log("[robot-pinky-detect] WS 연결됨 ✅");
      setConnected(true);
    };
    ws.onclose = (e) => {
      console.warn("[robot-pinky-detect] WS 닫힘 — code:", e.code, "reason:", e.reason);
      setConnected(false);
      setRunning(false);
    };
    ws.onerror = (e) => {
      console.error("[robot-pinky-detect] WS 오류:", e);
      setError("객체 인식 스트림에 연결하지 못했습니다.");
    };
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "error") {
        console.error("[robot-pinky-detect] 서버 오류:", message.message);
        setError(message.message);
        return;
      }
      if (message.type === "detection") {
        console.log(
          `[robot-pinky-detect] 감지 ← ${message.detections?.length ?? 0}개`,
          message.detections?.map((d: Detection) => `${d.label} ${(d.confidence * 100).toFixed(0)}%`),
          `| ${message.inference_ms}ms`,
        );
        pushFrame(message.frame);
        setDetections(message.detections ?? []);
        setInferenceMs(message.inference_ms ?? null);
      }
    };
  };

  const updateConfidence = async (value: number) => {
    setConfidence(value);
    await fetch(`${base}/api/arm/pinky-detect/confidence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confidence: value }),
    });
  };

  return (
    <AdminShell title="핑키프로 인식">
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[20px] font-bold text-slate-900">핑키프로 인식</h1>
            <p className="text-[13px] text-slate-500">
              주행 로봇({robotHostname}) 카메라와 YOLOv8로 사람과 Pinky Pro를 실시간 인식합니다.
            </p>
          </div>
          <Button
            onClick={running ? stop : start}
            disabled={!status?.available}
            variant={running ? "destructive" : "default"}
          >
            <ScanEye className="mr-2 size-4" />
            {running ? "인식 중지" : "인식 시작"}
          </Button>
        </div>

        {/* AI 서버 설정 */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Server className="size-5 text-blue-500" />
                <div>
                  <p className="text-[14px] font-semibold">서버 모드 구동 중</p>
                  <p className="text-[12px] text-slate-500">
                    외부 AI 서버에서 YOLO 추론을 수행합니다.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-[12px] text-slate-500 flex items-center gap-1">
                  <Server className="size-3" /> AI 서버 IP:포트
                </Label>
                <Input
                  value={aiServerInput}
                  onChange={(e) => setAiServerInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveAiServer()}
                  placeholder="예: 192.168.0.9:9001"
                  className="font-mono text-[13px]"
                />
              </div>
              <div className="flex items-end">
                <Button variant="outline" onClick={saveAiServer}>적용</Button>
              </div>
            </div>

            <p className="mt-2 text-[11px] text-slate-400">
              현재 연결: <span className="font-mono">{base}</span>
              <span> | 로봇: <span className="font-mono">{robotHostname}</span></span>
            </p>
          </CardContent>
        </Card>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
            <AlertTriangle className="size-4 shrink-0" />{error}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-[14px]">
                <span className="flex items-center gap-2">
                  <Camera className="size-4 text-orange-500" />실시간 인식 화면
                </span>
                <span className="text-[11px] font-normal text-slate-400">
                  {connected ? "연결됨" : "대기"}{inferenceMs != null ? ` · ${inferenceMs} ms` : ""}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-slate-950">
                {frameUrl
                  ? <img src={frameUrl} className="h-full w-full object-contain" alt="YOLO detection" />
                  : (
                    <div className="text-center text-slate-500">
                      <ScanEye className="mx-auto mb-2 size-10 opacity-40" />
                      <p className="text-[12px]">인식 시작 버튼을 눌러주세요</p>
                    </div>
                  )}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[14px]">
                  <SlidersHorizontal className="size-4 text-orange-500" />인식 설정
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-[12px]">
                  <span>신뢰도 임계값</span><strong>{confidence.toFixed(2)}</strong>
                </div>
                <Slider
                  min={0.1} max={0.95} step={0.05}
                  value={[confidence]}
                  onValueCommit={([value]) => void updateConfidence(value)}
                  onValueChange={([value]) => setConfidence(value)}
                />
                <div className="flex flex-wrap gap-2">
                  {(status?.classes ?? []).map((name) => (
                    <Badge key={name} variant="secondary">{name}</Badge>
                  ))}
                </div>
                <p className="break-all text-[11px] text-slate-400">{status?.model_path}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-[14px]">현재 인식 결과 ({detections.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {detections.length === 0
                  ? <p className="text-[12px] text-slate-400">인식된 객체가 없습니다.</p>
                  : detections.map((item, index) => (
                    <div
                      key={`${item.label}-${index}`}
                      className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-[12px]"
                    >
                      <span className="font-medium">{item.label}</span>
                      <span>{(item.confidence * 100).toFixed(1)}%</span>
                    </div>
                  ))}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* LCD 화면 설정 카드 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-[14px]">
              <Monitor className="size-4 text-blue-500" />
              LCD 화면 설정
              {detections.some((d) => d.label === "pinky_63") && (
                <Badge className="ml-1 bg-emerald-500 text-white text-[10px]">핑키 감지됨</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 자동 전송 토글 */}
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div>
                <p className="text-[13px] font-medium text-slate-700">핑키 감지 시 자동 전송</p>
                <p className="text-[11px] text-slate-400">pinky_63 감지될 때마다 아래 설정을 LCD에 전송합니다</p>
              </div>
              <Switch checked={autoSend} onCheckedChange={setAutoSend} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* 텍스트 */}
              <div className="sm:col-span-2">
                <Label className="mb-1 block text-[12px] text-slate-600">표시할 텍스트</Label>
                <textarea
                  value={lcdText}
                  onChange={(e) => setLcdText(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
              </div>

              {/* 폰트 선택 */}
              <div>
                <Label className="mb-1 block text-[12px] text-slate-600">폰트</Label>
                <select
                  value={lcdFont}
                  onChange={(e) => setLcdFont(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[13px] text-slate-800 focus:border-primary focus:outline-none"
                >
                  <option value="default">기본 폰트 (PIL 내장)</option>
                  {(fontsData?.fonts ?? []).map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              {/* 정렬 */}
              <div>
                <Label className="mb-1 block text-[12px] text-slate-600">정렬</Label>
                <div className="flex gap-1">
                  {(["left", "center", "right"] as const).map((a) => (
                    <button
                      key={a}
                      onClick={() => setLcdAlign(a)}
                      className={cn(
                        "flex-1 rounded-lg border py-1.5 text-[12px] font-medium transition-all",
                        lcdAlign === a
                          ? "border-primary bg-primary text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-primary/50",
                      )}
                    >
                      {a === "left" ? "왼쪽" : a === "center" ? "가운데" : "오른쪽"}
                    </button>
                  ))}
                </div>
              </div>

              {/* 글꼴 크기 */}
              <div className="sm:col-span-2">
                <Label className="mb-1 block text-[12px] text-slate-600">
                  글꼴 크기: <span className="tabular-nums">{lcdSize}px</span>
                </Label>
                <Slider min={8} max={80} step={2} value={[lcdSize]} onValueChange={([v]) => setLcdSize(v)} />
              </div>

              {/* 색상 */}
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <Label className="mb-1 block text-[12px] text-slate-600">글자 색상</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={lcdColor} onChange={(e) => setLcdColor(e.target.value)}
                      className="h-9 w-9 cursor-pointer rounded-lg border border-slate-200 p-0.5" />
                    <span className="font-mono text-[12px] text-slate-500">{lcdColor}</span>
                  </div>
                </div>
                <div>
                  <Label className="mb-1 block text-[12px] text-slate-600">배경 색상</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={lcdBgColor} onChange={(e) => setLcdBgColor(e.target.value)}
                      className="h-9 w-9 cursor-pointer rounded-lg border border-slate-200 p-0.5" />
                    <span className="font-mono text-[12px] text-slate-500">{lcdBgColor}</span>
                  </div>
                </div>
                {/* 미리보기 */}
                <div
                  className="ml-auto flex h-16 w-28 items-center justify-center overflow-hidden rounded-lg border border-slate-200"
                  style={{ backgroundColor: lcdBgColor }}
                >
                  <span
                    className="truncate px-1 text-center text-[10px] leading-tight"
                    style={{ color: lcdColor, fontSize: Math.min(lcdSize * 0.4, 12) }}
                  >
                    {lcdText || "미리보기"}
                  </span>
                </div>
              </div>
            </div>

            {/* 버튼 */}
            <div className="flex gap-2">
              <Button onClick={sendLcd} disabled={lcdMut.isPending} className="gap-2">
                <Type className="size-4" />
                {lcdMut.isPending ? "전송 중..." : "LCD에 전송"}
              </Button>
              <Button variant="outline" onClick={() => lcdStopMut.mutate()} disabled={lcdStopMut.isPending} className="gap-2">
                <Square className="size-4" />
                화면 끄기
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
