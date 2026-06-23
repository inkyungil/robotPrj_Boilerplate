import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { LANGS, useI18n } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { Book } from "@/lib/mock-data";
import { useSpeechRecognition } from "@/lib/use-speech";
import { Mic, Search as SearchIcon, MapPin, X } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Link } from "@tanstack/react-router";

const searchSchema = z.object({ q: z.string().optional() });

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      q: typeof search.q === "string" ? search.q : undefined,
    };
  },
  head: () => ({ meta: [{ title: "Libi Bot — 도서 검색" }] }),
  component: SearchPage,
});

function SearchPage() {
  const { lang, tr } = useI18n();
  const { q } = Route.useSearch();
  const navigate = useNavigate();
  const [query, setQuery] = useState(q ?? "");
  const speechLang = LANGS.find((l) => l.code === lang)?.speech ?? "ko-KR";
  const { listening, transcript, start, stop } = useSpeechRecognition(speechLang);
  const [selected, setSelected] = useState<string | null>(null);

  async function handleCallRobot(bookId: number) {
    const token = localStorage.getItem("libi.memberToken");
    if (!token) {
      // Hard redirect to clear browser cache and load the new login route directly
      window.location.href = "/login?redirect=/search";
      return;
    }

    try {
      const res = await fetch("/api/robot/call", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ book_id: bookId })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "로봇 호출에 실패했습니다.");
      }

      // Successfully called robot, redirect to monitor page
      void navigate({ to: "/robot" });
    } catch (err: any) {
      alert(err.message || "로봇을 호출할 수 없습니다.");
    }
  }

  useEffect(() => setQuery(q ?? ""), [q]);
  useEffect(() => {
    if (transcript) setQuery(transcript);
  }, [transcript]);

  const { data: results = [], isLoading } = useQuery<Book[]>({
    queryKey: ["books", query],
    queryFn: async () => {
      const qs = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
      const res = await fetch(`/api/books${qs}`);
      if (!res.ok) throw new Error("도서를 가져오는 데 실패했습니다.");
      return res.json();
    },
  });

  return (
    <AppShell>
      <div className="px-5 pb-8 pt-3">
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-2 shadow-card">
          <SearchIcon className="ml-2 size-5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onBlur={() => navigate({ to: "/search", search: { q: query } })}
            placeholder={tr("searchPh")}
            className="flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-muted-foreground">
              <X className="size-4" />
            </button>
          )}
          <button
            onClick={() => (listening ? stop() : start())}
            className={`flex size-10 items-center justify-center rounded-xl transition-colors ${
              listening ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground"
            }`}
            aria-label="voice search"
          >
            <Mic className="size-5" />
          </button>
        </div>

        {listening && (
          <p className="mt-3 text-center text-xs font-medium text-primary">
            🎙️ {tr("listening")}
          </p>
        )}

        <div className="mt-5 space-y-3">
          {isLoading ? (
            <div className="space-y-4 py-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3 rounded-2xl border border-border bg-card p-3 shadow-card animate-pulse">
                  <div className="size-20 shrink-0 rounded-xl bg-muted" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-4 w-3/4 rounded bg-muted" />
                    <div className="h-3 w-1/2 rounded bg-muted" />
                    <div className="h-3 w-1/4 rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : results.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">검색 결과가 없습니다.</p>
          ) : (
            results.map((b) => (
              <article
                key={b.id}
                className="overflow-hidden rounded-2xl border border-border bg-card shadow-card"
              >
                <div className="flex gap-3 p-3">
                  <div
                    className={`flex size-20 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${b.color} text-4xl`}
                  >
                    {b.cover}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-1 text-sm font-bold text-foreground">{b.title[lang]}</h3>
                    <p className="text-xs text-muted-foreground">{b.author}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          b.inStock
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-stone-200 text-stone-600"
                        }`}
                      >
                        {b.inStock ? tr("inStock") : tr("soldOut")}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                        <MapPin className="size-3" />
                        {b.zone} · {b.shelf}
                      </span>
                    </div>
                  </div>
                </div>
                {b.inStock && (
                  <div className="flex border-t border-border">
                    <button
                      onClick={() => setSelected(selected === b.id ? null : b.id)}
                      className="flex-1 bg-primary-soft/50 py-2.5 text-xs font-bold text-primary border-r border-border hover:bg-primary-soft transition-colors"
                    >
                      {tr("showOnMap")}
                    </button>
                    <button
                      onClick={() => handleCallRobot(b.id)}
                      className="flex-1 bg-gradient-to-r from-primary to-indigo-600 py-2.5 text-xs font-bold text-white hover:from-primary/95 hover:to-indigo-500 transition-all flex items-center justify-center gap-1 focus:outline-none"
                    >
                      <span>🤖 로봇 호출</span>
                    </button>
                  </div>
                )}
                {selected === b.id && <MiniMap zoneId={b.zone.split("-")[0]} />}
              </article>
            ))
          )}
        </div>


        <Link
          to="/chat"
          className="mt-6 block rounded-2xl border-2 border-dashed border-primary/30 bg-primary-soft/40 p-4 text-center"
        >
          <p className="text-sm font-semibold text-primary">못 찾으셨나요? Libi Bot에게 물어보세요</p>
          <p className="mt-1 text-xs text-muted-foreground">{tr("chatPh")}</p>
        </Link>
      </div>
    </AppShell>
  );
}

function MiniMap({ zoneId }: { zoneId: string }) {
  return (
    <div className="border-t border-border bg-muted/40 p-4">
      <div className="relative h-32 rounded-xl bg-paper ring-1 ring-border">
        {/* simplified zones */}
        {["A", "B", "C", "D", "E", "F"].map((id, i) => {
          const active = id === zoneId;
          return (
            <div
              key={id}
              className={`absolute flex items-center justify-center rounded text-[10px] font-bold ${
                active
                  ? "bg-accent text-accent-foreground ring-2 ring-primary"
                  : "bg-card text-muted-foreground"
              }`}
              style={{
                left: `${(i % 3) * 33 + 2}%`,
                top: `${Math.floor(i / 3) * 50 + 5}%`,
                width: "29%",
                height: "42%",
              }}
            >
              {id}
              {active && (
                <span className="absolute -top-2 right-1 size-3 animate-ping rounded-full bg-accent" />
              )}
            </div>
          );
        })}
        <div className="absolute bottom-1 left-1 rounded bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">
          📍 현위치
        </div>
      </div>
      <p className="mt-2 text-center text-xs font-medium text-foreground">
        현위치에서 도보 약 30초 · 코너 <b className="text-primary">{zoneId}</b>
      </p>
    </div>
  );
}
