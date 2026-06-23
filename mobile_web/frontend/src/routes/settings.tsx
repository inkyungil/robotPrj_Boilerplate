import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { Bot, RefreshCw, QrCode, X, ExternalLink, User } from "lucide-react";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

const SHARE_URL = "https://sanora-wretched-lenard.ngrok-free.dev/";

type OllamaModel = {
  name: string;
  size: number;
  details?: { parameter_size?: string; quantization_level?: string };
};

const OLLAMA_URL = import.meta.env.VITE_OLLAMA_URL ?? "/ollama";
const OLLAMA_MODEL_KEY = "labi.ollamaModel";
const DEFAULT_OLLAMA_MODEL = import.meta.env.VITE_OLLAMA_MODEL ?? "qwen3:1.7b";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Libi Bot — 설정" }] }),
  component: Settings,
});

function Settings() {
  const { lang, tr } = useI18n();
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_OLLAMA_MODEL);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [member, setMember] = useState<{ id: number; username: string; full_name?: string } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(OLLAMA_MODEL_KEY);
    if (saved) setSelectedModel(saved);
    void loadModels(saved || DEFAULT_OLLAMA_MODEL);

    const info = localStorage.getItem("libi.memberInfo");
    if (info) {
      try {
        setMember(JSON.parse(info));
      } catch (e) {
        localStorage.removeItem("libi.memberInfo");
      }
    }
  }, []);

  function handleLogout() {
    localStorage.removeItem("libi.memberToken");
    localStorage.removeItem("libi.memberInfo");
    setMember(null);
  }

  async function loadModels(currentModel: string) {
    setModelLoading(true);
    setModelError(null);
    try {
      const endpoint = OLLAMA_URL.endsWith("/") ? OLLAMA_URL.slice(0, -1) : OLLAMA_URL;
      const res = await fetch(endpoint + "/api/tags", {
        headers: { "ngrok-skip-browser-warning": "true" },
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = (await res.json()) as { models: OllamaModel[] };
      const list = data.models ?? [];
      setModels(list);
      if (list.length > 0 && !list.find((m) => m.name === currentModel)) {
        const first = list[0].name;
        setSelectedModel(first);
        localStorage.setItem(OLLAMA_MODEL_KEY, first);
      }
    } catch (e) {
      setModelError("Ollama 서버에 연결할 수 없어요. 서버가 실행 중인지 확인해주세요.");
    } finally {
      setModelLoading(false);
    }
  }

  function selectModel(name: string) {
    setSelectedModel(name);
    localStorage.setItem(OLLAMA_MODEL_KEY, name);
  }

  return (
    <AppShell>
      <div className="px-5 pb-8 pt-3">
        <h1 className="text-xl font-bold text-foreground">{tr("settings")}</h1>

        <Section title="모바일 로봇 서비스" icon={Bot}>
          {member ? (
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-full bg-primary-soft flex items-center justify-center text-primary">
                    <User className="size-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-foreground">{member.full_name || member.username}님</div>
                    <div className="text-[10px] text-muted-foreground font-mono">ID: {member.username}</div>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="rounded-lg border border-border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground hover:text-red-500 hover:border-red-200 transition-colors"
                >
                  로그아웃
                </button>
              </div>
              <Link
                to="/robot"
                className="inline-flex w-full h-10 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-primary to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:from-primary/95 hover:to-indigo-500 transition-all"
              >
                <Bot className="size-3.5 animate-bounce" />
                로봇 호출 모니터 바로가기
              </Link>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-xs text-muted-foreground mb-3">
                로그인하시면 모바일로 도서관 로봇을 호출하여 책을 전달받을 수 있습니다.
              </p>
              <button
                onClick={() => {
                  window.location.href = "/login?redirect=/settings";
                }}
                className="inline-flex w-full h-10 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary/90 transition-colors cursor-pointer"
              >
                로그인 / 회원가입
              </button>
            </div>
          )}
        </Section>

        <Section title="AI 모델 선택" icon={Bot}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {modelLoading ? "모델 목록 로딩 중..." : `${models.length}개 모델 발견`}
            </span>
            <button
              onClick={() => void loadModels(selectedModel)}
              disabled={modelLoading}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            >
              <RefreshCw className={`size-3 ${modelLoading ? "animate-spin" : ""}`} />
              새로고침
            </button>
          </div>

          {modelError && (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              {modelError}
            </div>
          )}

          {models.length > 0 ? (
            <div className="space-y-2">
              {models.map((m) => (
                <button
                  key={m.name}
                  onClick={() => selectModel(m.name)}
                  className={`w-full rounded-xl border-2 p-3 text-left transition-colors ${
                    selectedModel === m.name
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border bg-card text-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{m.name}</span>
                    {selectedModel === m.name && (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                        사용 중
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex gap-2 text-[11px] text-muted-foreground">
                    {m.details?.parameter_size && <span>{m.details.parameter_size}</span>}
                    {m.details?.quantization_level && <span>{m.details.quantization_level}</span>}
                    <span>{(m.size / 1e9).toFixed(1)} GB</span>
                  </div>
                </button>
              ))}
            </div>
          ) : !modelLoading && !modelError ? (
            <div className="rounded-xl border border-border bg-card px-3 py-4 text-center text-xs text-muted-foreground">
              설치된 모델이 없습니다.
            </div>
          ) : null}
        </Section>


        <Section title="공유 / QR 코드" icon={QrCode}>
          <button
            onClick={() => setQrOpen(true)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <QrCode className="size-4" />
            QR 코드 보기
          </button>
          <p className="mt-2 break-all text-center text-[11px] text-muted-foreground">{SHARE_URL}</p>
        </Section>

        <p className="mt-8 text-center text-[11px] text-muted-foreground">
          Libi Bot v0.1 · made with 📚 by Lovable
        </p>
      </div>

      {/* QR code modal */}
      {qrOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
          onClick={() => setQrOpen(false)}
        >
          <div
            className="w-full max-w-xs rounded-3xl bg-card p-6 shadow-float"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-bold text-foreground">📱 QR 코드</h3>
              <button onClick={() => setQrOpen(false)} aria-label="close">
                <X className="size-5 text-muted-foreground" />
              </button>
            </div>
            <div className="flex justify-center rounded-2xl bg-white p-4">
              <QRCodeSVG value={SHARE_URL} size={200} level="M" marginSize={2} />
            </div>
            <p className="mt-3 break-all text-center text-[11px] text-muted-foreground">{SHARE_URL}</p>
            <a
              href={SHARE_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground"
            >
              <ExternalLink className="size-4" />
              페이지 열기
            </a>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Bot;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-4 text-primary" />
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
