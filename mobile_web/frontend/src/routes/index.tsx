import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { Mic, Keyboard, BookOpen } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Libi Bot — 시작하기" },
      { name: "description", content: "음성과 텍스트로 책을 찾아주는 도서관 AI 가이드, Libi Bot에 오신 것을 환영합니다." },
    ],
  }),
  component: Onboarding,
});

function Onboarding() {
  const { tr } = useI18n();
  const navigate = useNavigate();

  const goHome = async (askMic: boolean) => {
    if (askMic && typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        s.getTracks().forEach((t) => t.stop());
      } catch {
        /* user can still proceed */
      }
    }
    navigate({ to: "/home" });
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background px-6 py-10">
      <div className="flex flex-1 flex-col">
        <div className="mt-6 flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
            <BookOpen className="size-6" />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold tracking-tight text-primary">
              Libi <span className="text-accent">Bot</span>
            </h1>
            <p className="text-xs text-muted-foreground">{tr("tagline")}</p>
          </div>
        </div>

        <h2 className="mt-12 text-balance text-2xl font-bold leading-snug text-foreground">
          {tr("welcome")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          ↓
        </p>

        <div className="mt-8 space-y-3">
          <button
            onClick={() => goHome(true)}
            className="flex w-full items-center gap-4 rounded-2xl bg-primary p-5 text-left text-primary-foreground shadow-md transition-transform active:scale-[0.98]"
          >
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15">
              <Mic className="size-6" />
            </div>
            <div>
              <div className="text-base font-bold">{tr("voiceStart")}</div>
              <div className="mt-0.5 text-xs text-primary-foreground/70">
                {tr("listening")}
              </div>
            </div>
          </button>

          <button
            onClick={() => goHome(false)}
            className="flex w-full items-center gap-4 rounded-2xl border-2 border-border bg-card p-5 text-left transition-colors active:bg-muted"
          >
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-foreground">
              <Keyboard className="size-6" />
            </div>
            <div>
              <div className="text-base font-bold text-foreground">{tr("textStart")}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{tr("searchPh")}</div>
            </div>
          </button>
        </div>
      </div>

      <div className="pb-4 pt-6">
        {/* Onboarding buttons end */}
      </div>
    </div>
  );
}

