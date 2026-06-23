import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { 
  Bot, Compass, Clock, BookOpen, CheckCircle2, 
  RotateCcw, Sparkles, AlertCircle, ArrowLeft, Loader2, Play
} from "lucide-react";
import { toast } from "sonner";
import { ZONES } from "@/lib/mock-data";

export const Route = createFileRoute("/robot-location")({
  head: () => ({ meta: [{ title: "Libi Bot — 실시간 로봇 위치 관제" }] }),
  component: RobotLocationPage,
});

type RobotTask = {
  id: number;
  memberId: number;
  bookId: number;
  status: "requested" | "moving" | "retrieved" | "delivering" | "completed" | "failed";
  zone: string;
  shelf: string;
  createdAt: string;
  updatedAt: string;
  bookTitle: string;
};

const ZONE_COORDS: Record<string, { x: number; y: number }> = {
  A: { x: 27.5, y: 22.5 },
  B: { x: 70, y: 22.5 },
  C: { x: 25, y: 52.5 },
  D: { x: 57.5, y: 52.5 },
  E: { x: 82.5, y: 52.5 },
  F: { x: 27.5, y: 81 },
  CAFE: { x: 62.5, y: 81 },
  WC: { x: 84, y: 81 },
};

// Two charging stations
const STATION_1_COORD = { x: 10, y: 90 };
const STATION_2_COORD = { x: 22, y: 90 };

// Two delivery destinations near counter
const DESK_1_COORD = { x: 42, y: 90 };
const DESK_2_COORD = { x: 48, y: 90 };

function RobotLocationPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<RobotTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Robots coordinates
  const [robot1Pos, setRobot1Pos] = useState(STATION_1_COORD);
  const [robot2Pos, setRobot2Pos] = useState(STATION_2_COORD);

  const [t1Duration, setT1Duration] = useState("duration-[1000ms]");
  const [t2Duration, setT2Duration] = useState("duration-[1000ms]");

  // Authentication check
  useEffect(() => {
    const token = localStorage.getItem("libi.memberToken");
    if (!token) {
      void navigate({ to: "/login", search: { redirect: "/robot-location" } });
    }
  }, [navigate]);

  // Fetch tasks helper
  async function fetchTasks() {
    const token = localStorage.getItem("libi.memberToken");
    if (!token) return;

    try {
      const res = await fetch("/api/robot/tasks", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem("libi.memberToken");
          localStorage.removeItem("libi.memberInfo");
          void navigate({ to: "/login", search: { redirect: "/robot-location" } });
          return;
        }
        throw new Error("작업 목록을 불러올 수 없습니다.");
      }
      const data = await res.json() as RobotTask[];
      setTasks(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "서버와 연결할 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }

  // Poll for live state changes every 2 seconds
  useEffect(() => {
    fetchTasks();
    const interval = setInterval(() => {
      fetchTasks();
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Split tasks between Robot 1 (odd IDs) and Robot 2 (even IDs)
  const robot1Tasks = tasks.filter((t) => t.id % 2 === 1);
  const robot2Tasks = tasks.filter((t) => t.id % 2 === 0);

  // Active or latest task for Robot 1
  const activeTask1 = robot1Tasks.find(
    (t) => t.status === "requested" || t.status === "moving" || t.status === "retrieved" || t.status === "delivering"
  ) || robot1Tasks[0];

  // Active or latest task for Robot 2
  const activeTask2 = robot2Tasks.find(
    (t) => t.status === "requested" || t.status === "moving" || t.status === "retrieved" || t.status === "delivering"
  ) || robot2Tasks[0];

  // Update Robot 1 location
  useEffect(() => {
    if (!activeTask1 || activeTask1.status === "failed") {
      setT1Duration("duration-[2000ms]");
      setRobot1Pos(STATION_1_COORD);
      return;
    }

    const zoneCode = activeTask1.zone.split("-")[0];
    const targetZone = ZONE_COORDS[zoneCode] || ZONE_COORDS["A"];

    switch (activeTask1.status) {
      case "requested":
        setT1Duration("duration-[1000ms]");
        setRobot1Pos(STATION_1_COORD);
        break;
      case "moving":
        setT1Duration("duration-[4000ms]");
        setRobot1Pos(targetZone);
        break;
      case "retrieved":
        setT1Duration("duration-[1000ms]");
        setRobot1Pos(targetZone);
        break;
      case "delivering":
        setT1Duration("duration-[4000ms]");
        setRobot1Pos(DESK_1_COORD);
        break;
      case "completed":
        setT1Duration("duration-[1000ms]");
        setRobot1Pos(DESK_1_COORD);
        break;
      default:
        setT1Duration("duration-[1000ms]");
        setRobot1Pos(STATION_1_COORD);
        break;
    }
  }, [activeTask1?.status, activeTask1?.zone]);

  // Update Robot 2 location
  useEffect(() => {
    if (!activeTask2 || activeTask2.status === "failed") {
      setT2Duration("duration-[2000ms]");
      setRobot2Pos(STATION_2_COORD);
      return;
    }

    const zoneCode = activeTask2.zone.split("-")[0];
    const targetZone = ZONE_COORDS[zoneCode] || ZONE_COORDS["B"];

    switch (activeTask2.status) {
      case "requested":
        setT2Duration("duration-[1000ms]");
        setRobot2Pos(STATION_2_COORD);
        break;
      case "moving":
        setT2Duration("duration-[4000ms]");
        setRobot2Pos(targetZone);
        break;
      case "retrieved":
        setT2Duration("duration-[1000ms]");
        setRobot2Pos(targetZone);
        break;
      case "delivering":
        setT2Duration("duration-[4000ms]");
        setRobot2Pos(DESK_2_COORD);
        break;
      case "completed":
        setT2Duration("duration-[1000ms]");
        setRobot2Pos(DESK_2_COORD);
        break;
      default:
        setT2Duration("duration-[1000ms]");
        setRobot2Pos(STATION_2_COORD);
        break;
    }
  }, [activeTask2?.status, activeTask2?.zone]);

  // Create a mock simulation task
  async function triggerMockTask() {
    const token = localStorage.getItem("libi.memberToken");
    if (!token) return;

    try {
      const booksRes = await fetch("/api/books");
      if (!booksRes.ok) throw new Error("도서 목록을 가져오지 못했습니다.");
      const books = await booksRes.json();
      const availableBooks = books.filter((b: any) => b.inStock);

      if (availableBooks.length === 0) {
        toast.error("현재 대출 가능한 도서가 없습니다. 도서 리셋이 필요합니다.");
        return;
      }

      // Pick a random book
      const randomBook = availableBooks[Math.floor(Math.random() * availableBooks.length)];

      // Call robot
      const res = await fetch("/api/robot/call", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ book_id: Number(randomBook.id) })
      });

      if (!res.ok) {
        throw new Error("로봇 호출에 실패했습니다.");
      }

      toast.success(`『${randomBook.title.KR}』 도서 배달 로봇 호출 시작!`);
      fetchTasks();
    } catch (err: any) {
      toast.error(err.message || "시뮬레이션 시작 오류");
    }
  }

  // Reset task helper
  async function handleReset(taskId: number) {
    const token = localStorage.getItem("libi.memberToken");
    if (!token) return;

    try {
      const res = await fetch(`/api/robot/tasks/${taskId}/reset`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        toast.success("로봇 시뮬레이션 상태가 리셋되었습니다.");
        fetchTasks();
      }
    } catch (err) {
      console.error("Failed to reset task", err);
    }
  }

  // Status visual label configs
  function getStatusLabel(status: RobotTask["status"]) {
    switch (status) {
      case "requested":
        return { text: "준비 중", color: "bg-amber-500 text-white" };
      case "moving":
        return { text: "이동 중", color: "bg-blue-500 text-white animate-pulse" };
      case "retrieved":
        return { text: "수거 완료", color: "bg-indigo-500 text-white" };
      case "delivering":
        return { text: "배송 중", color: "bg-purple-500 text-white animate-pulse" };
      case "completed":
        return { text: "배달 완료", color: "bg-green-500 text-white" };
      default:
        return { text: "대기", color: "bg-slate-400 text-white" };
    }
  }

  return (
    <AppShell>
      <div className="px-5 pb-8 pt-3 max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <Link to="/home" className="p-1 rounded-lg hover:bg-card-soft text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="text-xl font-bold text-foreground">🤖 실시간 로봇 관제 (2대 운행)</h1>
        </div>

        {/* Live Map Panel */}
        <div className="rounded-3xl border border-border bg-card p-4 shadow-lg mb-6 overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <span className="relative flex size-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full size-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-bold text-foreground">실시간 맵 모니터 (듀얼 관제)</span>
            </div>
          </div>

          {/* Interactive Library Layout */}
          <div className="relative aspect-[4/3.2] overflow-hidden rounded-2xl bg-paper border border-border shadow-inner">
            {/* Grid Pattern Background */}
            <div className="absolute inset-0 opacity-15 [background-image:linear-gradient(to_right,oklch(0.27_0.12_273)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.27_0.12_273)_1px,transparent_1px)] [background-size:16px_16px]" />
            
            {/* Dotted Guide Paths from stations to shelves */}
            <svg className="absolute inset-0 size-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
              {/* Robot 1 Path */}
              {activeTask1 && activeTask1.status !== "completed" && activeTask1.status !== "failed" && (
                <>
                  <path 
                    d={`M ${STATION_1_COORD.x}% ${STATION_1_COORD.y}% L ${ZONE_COORDS[activeTask1.zone.split("-")[0]]?.x || 27}% ${ZONE_COORDS[activeTask1.zone.split("-")[0]]?.y || 22}%`}
                    fill="none" 
                    stroke="var(--color-primary)" 
                    strokeWidth="1.2" 
                    strokeDasharray="3,3"
                    className="opacity-45"
                  />
                  <path 
                    d={`M ${ZONE_COORDS[activeTask1.zone.split("-")[0]]?.x || 27}% ${ZONE_COORDS[activeTask1.zone.split("-")[0]]?.y || 22}% L ${DESK_1_COORD.x}% ${DESK_1_COORD.y}%`}
                    fill="none" 
                    stroke="var(--color-primary)" 
                    strokeWidth="1.2" 
                    strokeDasharray="3,3"
                    className="opacity-45"
                  />
                </>
              )}
              {/* Robot 2 Path */}
              {activeTask2 && activeTask2.status !== "completed" && activeTask2.status !== "failed" && (
                <>
                  <path 
                    d={`M ${STATION_2_COORD.x}% ${STATION_2_COORD.y}% L ${ZONE_COORDS[activeTask2.zone.split("-")[0]]?.x || 70}% ${ZONE_COORDS[activeTask2.zone.split("-")[0]]?.y || 22}%`}
                    fill="none" 
                    stroke="#2563eb" 
                    strokeWidth="1.2" 
                    strokeDasharray="3,3"
                    className="opacity-45"
                  />
                  <path 
                    d={`M ${ZONE_COORDS[activeTask2.zone.split("-")[0]]?.x || 70}% ${ZONE_COORDS[activeTask2.zone.split("-")[0]]?.y || 22}% L ${DESK_2_COORD.x}% ${DESK_2_COORD.y}%`}
                    fill="none" 
                    stroke="#2563eb" 
                    strokeWidth="1.2" 
                    strokeDasharray="3,3"
                    className="opacity-45"
                  />
                </>
              )}
            </svg>

            {/* Render Static Zones */}
            {ZONES.map((z) => {
              const isActiveTarget1 = activeTask1 && activeTask1.status !== "completed" && activeTask1.status !== "failed" && activeTask1.zone.startsWith(z.id);
              const isActiveTarget2 = activeTask2 && activeTask2.status !== "completed" && activeTask2.status !== "failed" && activeTask2.zone.startsWith(z.id);
              const isActive = isActiveTarget1 || isActiveTarget2;
              return (
                <div
                  key={z.id}
                  className={`absolute flex flex-col items-center justify-center rounded-xl text-[10px] font-bold border border-border/60 transition-all ${z.color} ${
                    isActive 
                      ? "ring-2 ring-primary/80 shadow-md scale-[1.03] z-10" 
                      : "opacity-75"
                  }`}
                  style={{
                    left: `${z.x}%`,
                    top: `${z.y}%`,
                    width: `${z.w}%`,
                    height: `${z.h}%`,
                  }}
                >
                  <span className="font-mono text-[9px] text-foreground/50">{z.id}</span>
                  <span className="text-foreground text-[10px] leading-none mt-0.5">{z.label}</span>
                </div>
              );
            })}

            {/* Static Charging Stations & Desk Icons */}
            <div 
              className="absolute size-7 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-[10px] shadow-sm font-semibold text-slate-700"
              style={{ left: `calc(${STATION_1_COORD.x}% - 14px)`, top: `calc(${STATION_1_COORD.y}% - 14px)` }}
              title="리비 1호기 충전소"
            >
              ⚡1
            </div>
            <div 
              className="absolute size-7 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-[10px] shadow-sm font-semibold text-blue-600"
              style={{ left: `calc(${STATION_2_COORD.x}% - 14px)`, top: `calc(${STATION_2_COORD.y}% - 14px)` }}
              title="리비 2호기 충전소"
            >
              ⚡2
            </div>
            <div 
              className="absolute size-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs shadow-sm font-bold text-primary"
              style={{ left: `calc(45% - 16px)`, top: `calc(90% - 16px)` }}
              title="도서 대출대"
            >
              📥
            </div>

            {/* Robot 1 (리비 1호기) - Orange */}
            <div
              className={`absolute size-8 rounded-full bg-primary text-white flex items-center justify-center shadow-lg transition-all ease-in-out ${t1Duration} z-20`}
              style={{
                left: `calc(${robot1Pos.x}% - 16px)`,
                top: `calc(${robot1Pos.y}% - 16px)`,
              }}
            >
              {activeTask1 && activeTask1.status !== "completed" && activeTask1.status !== "failed" && (
                <div className="absolute inset-0 rounded-full bg-primary opacity-35 animate-ping" />
              )}
              <span className="text-[10px] font-extrabold relative z-10">L1</span>
            </div>

            {/* Robot 2 (리비 2호기) - Blue */}
            <div
              className={`absolute size-8 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg transition-all ease-in-out ${t2Duration} z-20`}
              style={{
                left: `calc(${robot2Pos.x}% - 16px)`,
                top: `calc(${robot2Pos.y}% - 16px)`,
              }}
            >
              {activeTask2 && activeTask2.status !== "completed" && activeTask2.status !== "failed" && (
                <div className="absolute inset-0 rounded-full bg-blue-600 opacity-35 animate-ping" />
              )}
              <span className="text-[10px] font-extrabold relative z-10">L2</span>
            </div>
          </div>

          {/* Map Legends */}
          <div className="flex justify-center gap-4 mt-3 text-[10px] text-muted-foreground border-t border-border pt-3">
            <span className="flex items-center gap-1">⚡ 충전소</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-primary inline-block" /> 1호기 (L1)</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-blue-600 inline-block" /> 2호기 (L2)</span>
            <span className="flex items-center gap-1">📥 대출대</span>
          </div>
        </div>

        {/* Dynamic Robot Status Panels */}
        <div className="space-y-4 mb-6">
          {/* Robot 1 Panel */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-md">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-foreground flex items-center gap-1">
                <span className="size-2 rounded-full bg-primary" />
                🤖 리비 1호기 (홀수 번호 전담)
              </span>
              {activeTask1 && activeTask1.status !== "completed" && activeTask1.status !== "failed" ? (
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${getStatusLabel(activeTask1.status).color}`}>
                  {getStatusLabel(activeTask1.status).text}
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground bg-slate-100 px-2 py-0.5 rounded-full">대기 중</span>
              )}
            </div>

            {activeTask1 && activeTask1.status !== "failed" ? (
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="font-semibold text-slate-800 line-clamp-1">『{activeTask1.bookTitle}』</div>
                <div>구역: {activeTask1.zone} ({activeTask1.shelf})</div>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => handleReset(activeTask1.id)}
                    className="inline-flex h-7 items-center gap-1 px-2 rounded-md border border-border bg-card text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <RotateCcw className="size-2.5" />
                    1호기 리셋
                  </button>
                  {activeTask1.status === "completed" && (
                    <span className="text-[10px] font-bold text-green-600 ml-auto flex items-center gap-0.5">
                      <Sparkles className="size-3" /> 배달완료
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">대기 상태 (배터리 98% · 충전 충전대 대기)</div>
            )}
          </div>

          {/* Robot 2 Panel */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-md">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-foreground flex items-center gap-1">
                <span className="size-2 rounded-full bg-blue-600" />
                🤖 리비 2호기 (짝수 번호 전담)
              </span>
              {activeTask2 && activeTask2.status !== "completed" && activeTask2.status !== "failed" ? (
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${getStatusLabel(activeTask2.status).color}`}>
                  {getStatusLabel(activeTask2.status).text}
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground bg-slate-100 px-2 py-0.5 rounded-full">대기 중</span>
              )}
            </div>

            {activeTask2 && activeTask2.status !== "failed" ? (
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="font-semibold text-slate-800 line-clamp-1">『{activeTask2.bookTitle}』</div>
                <div>구역: {activeTask2.zone} ({activeTask2.shelf})</div>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => handleReset(activeTask2.id)}
                    className="inline-flex h-7 items-center gap-1 px-2 rounded-md border border-border bg-card text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <RotateCcw className="size-2.5" />
                    2호기 리셋
                  </button>
                  {activeTask2.status === "completed" && (
                    <span className="text-[10px] font-bold text-green-600 ml-auto flex items-center gap-0.5">
                      <Sparkles className="size-3" /> 배달완료
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">대기 상태 (배터리 95% · 충전 충전대 대기)</div>
            )}
          </div>
        </div>

        {/* Action button to trigger simulation for test */}
        <div className="space-y-3">
          <button
            onClick={triggerMockTask}
            className="w-full flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary/95 active:scale-98 cursor-pointer"
          >
            <Play className="size-4 fill-white" />
            도서 호출 시뮬레이션 시작 (로봇 배분)
          </button>

          <Link 
            to="/robot" 
            className="w-full flex h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-card text-sm font-bold text-foreground hover:bg-card-soft active:scale-98"
          >
            📋 전체 호출 내역 목록 보기
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
