import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { 
  Bot, Clock, BookOpen, Compass, CheckCircle2, 
  RotateCcw, Sparkles, AlertCircle, ArrowLeft, Loader2 
} from "lucide-react";

export const Route = createFileRoute("/robot")({
  head: () => ({ meta: [{ title: "Libi Bot — 로봇 호출 모니터" }] }),
  component: RobotMonitorPage,
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

function RobotMonitorPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<RobotTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Authentication check
  useEffect(() => {
    const token = localStorage.getItem("libi.memberToken");
    if (!token) {
      void navigate({ to: "/login", search: { redirect: "/robot" } });
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
          void navigate({ to: "/login", search: { redirect: "/robot" } });
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

  // Poll for live state changes every 2.5 seconds
  useEffect(() => {
    fetchTasks();
    const interval = setInterval(() => {
      fetchTasks();
    }, 2500);
    return () => clearInterval(interval);
  }, []);

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
        fetchTasks();
      }
    } catch (err) {
      console.error("Failed to reset task", err);
    }
  }

  // Get status details
  function getStatusConfig(status: RobotTask["status"]) {
    switch (status) {
      case "requested":
        return {
          step: 1,
          label: "호출 요청됨",
          desc: "로봇이 호출 명령을 접수하고 출발 준비 중입니다.",
          color: "text-amber-500 bg-amber-500/10 border-amber-500/30",
          icon: Clock
        };
      case "moving":
        return {
          step: 2,
          label: "구역으로 이동 중",
          desc: "로봇이 도서가 보관된 서가로 가고 있습니다.",
          color: "text-blue-500 bg-blue-500/10 border-blue-500/30",
          icon: Bot
        };
      case "retrieved":
        return {
          step: 3,
          label: "도서 수거 완료",
          desc: "서가에서 대상 도서를 성공적으로 집어 올렸습니다.",
          color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/30",
          icon: BookOpen
        };
      case "delivering":
        return {
          step: 4,
          label: "진열대로 이송 중",
          desc: "수거한 도서를 안내/대출 진열대로 전달하는 중입니다.",
          color: "text-purple-500 bg-purple-500/10 border-purple-500/30",
          icon: Compass
        };
      case "completed":
        return {
          step: 5,
          label: "진열대 전달 완료",
          desc: "진열대에 도서 배달을 완료했습니다! 대출 가능 상태입니다.",
          color: "text-green-500 bg-green-500/10 border-green-500/30",
          icon: CheckCircle2
        };
      default:
        return {
          step: 0,
          label: "오류 발생",
          desc: "작업 도중 알 수 없는 오류가 발생했습니다.",
          color: "text-red-500 bg-red-500/10 border-red-500/30",
          icon: AlertCircle
        };
    }
  }

  return (
    <AppShell>
      <div className="px-5 pb-8 pt-3 max-w-md mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <Link to="/settings" className="p-1 rounded-lg hover:bg-card-soft text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="text-xl font-bold text-foreground">🤖 로봇 호출 모니터</h1>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <Loader2 className="size-8 animate-spin text-primary" />
            <span className="text-sm">로봇 호출 내역을 가져오는 중...</span>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex gap-2">
            <AlertCircle className="size-5 shrink-0" />
            <div>
              <div className="font-bold">오류 발생</div>
              <div className="text-xs mt-1">{error}</div>
            </div>
          </div>
        ) : tasks.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/40 p-8 text-center">
            <div className="inline-flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary mb-4">
              <Bot className="size-7" />
            </div>
            <h3 className="font-bold text-foreground">호출 내역이 없습니다</h3>
            <p className="text-xs text-muted-foreground mt-2 max-w-xs mx-auto">
              도서관 책 검색 화면에서 대출 가능한 도서를 찾고 <br /><strong>'로봇으로 책 호출'</strong> 버튼을 클릭해보세요!
            </p>
            <Link 
              to="/search" 
              className="mt-6 inline-flex h-10 px-6 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white shadow-md shadow-primary/10 hover:bg-primary/95"
            >
              도서 검색하러 가기
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            <p className="text-xs text-muted-foreground text-center animate-pulse">
              🔄 로봇의 현재 상태를 실시간(2.5초 간격)으로 받아오고 있습니다.
            </p>

            {tasks.map((task) => {
              const config = getStatusConfig(task.status);
              const Icon = config.icon;
              const isFinished = task.status === "completed";

              return (
                <div 
                  key={task.id} 
                  className="rounded-3xl border border-border bg-card p-5 shadow-lg relative overflow-hidden"
                >
                  {/* Decorative background glow for active tasks */}
                  {!isFinished && (
                    <div className="absolute -right-10 -top-10 size-32 bg-primary/5 rounded-full blur-2xl" />
                  )}

                  {/* Header info */}
                  <div className="flex justify-between items-start gap-2 mb-4">
                    <div>
                      <span className="text-[10px] font-bold text-muted-foreground font-mono">
                        TASK #{task.id} · {new Date(task.createdAt).toLocaleTimeString()}
                      </span>
                      <h3 className="font-bold text-foreground text-base mt-0.5 line-clamp-1">
                        {task.bookTitle}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        위치: <span className="font-semibold text-primary">{task.zone}</span> 구역 ({task.shelf})
                      </p>
                    </div>

                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${config.color}`}>
                      <Icon className="size-3.5" />
                      {config.label}
                    </span>
                  </div>

                  {/* Stepper Progress */}
                  <div className="relative my-6 px-1">
                    <div className="absolute left-1 right-1 top-2.5 h-1 bg-border rounded-full" />
                    <div 
                      className="absolute left-1 top-2.5 h-1 bg-primary rounded-full transition-all duration-500" 
                      style={{ width: `${((config.step - 1) / 4) * 100}%` }}
                    />
                    
                    <div className="relative flex justify-between">
                      {[1, 2, 3, 4, 5].map((stepNum) => {
                        const isPast = stepNum < config.step;
                        const isActive = stepNum === config.step;
                        
                        return (
                          <div 
                            key={stepNum} 
                            className={`size-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all ${
                              isPast 
                                ? "bg-primary border-primary text-white" 
                                : isActive 
                                  ? "bg-card border-primary text-primary ring-4 ring-primary/15 scale-110" 
                                  : "bg-card border-border text-muted-foreground"
                            }`}
                          >
                            {stepNum}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Description Box */}
                  <div className="rounded-2xl bg-card-soft border border-border p-3 text-xs text-foreground mb-4">
                    <p className="font-medium text-foreground">{config.desc}</p>
                  </div>

                  {/* Reset/Debug Button */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReset(task.id)}
                      className="inline-flex h-9 items-center gap-1.5 px-3 rounded-lg border border-border bg-card text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <RotateCcw className="size-3" />
                      시뮬레이션 재설정
                    </button>
                    
                    {isFinished && (
                      <span className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-green-600">
                        <Sparkles className="size-3.5 animate-bounce" />
                        배송 완료!
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
