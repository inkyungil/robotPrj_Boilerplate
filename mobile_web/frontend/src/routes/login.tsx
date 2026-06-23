import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useState, type FormEvent } from "react";
import { User, Lock, ArrowRight, Sparkles, CheckCircle2, Mail } from "lucide-react";
import { z } from "zod";

const loginSearchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      redirect: typeof search.redirect === "string" ? search.redirect : undefined,
    };
  },
  head: () => ({ meta: [{ title: "Libi Bot — 사용자 로그인" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    if (isRegister && !agreeTerms) {
      setError("이용약관 및 개인정보 처리방침에 동의해 주세요.");
      setLoading(false);
      return;
    }

    const url = isRegister 
      ? "/api/member/auth/register" 
      : "/api/member/auth/login";

    const body = isRegister 
      ? { username, password, full_name: fullName, email: email || null } 
      : { username, password };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "오류가 발생했습니다.");
      }

      if (isRegister) {
        setSuccess("회원가입이 완료되었습니다! 로그인해 주세요.");
        setIsRegister(false);
        setPassword("");
      } else {
        // Save auth data
        localStorage.setItem("libi.memberToken", data.access_token);
        localStorage.setItem("libi.memberInfo", JSON.stringify(data.member));
        
        // Redirect to intended route or default to /home
        const target = redirect || "/home";
        void navigate({ to: target });
      }
    } catch (err: any) {
      setError(err.message || "연결에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="flex min-h-[calc(100vh-140px)] flex-col justify-center px-6 py-8">
        <div className="mx-auto w-full max-w-sm rounded-3xl border border-border bg-card/60 p-6 shadow-xl backdrop-blur-md">
          {/* Logo / Header */}
          <div className="mb-8 text-center">
            <div className="inline-flex size-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-indigo-500 text-white shadow-lg shadow-primary/20">
              <Sparkles className="size-7 animate-pulse" />
            </div>
            <h2 className="mt-4 text-xl font-bold tracking-tight text-foreground animate-fade-in">
              {isRegister ? "Libi 회원가입" : "Libi 로그인"}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {isRegister 
                ? "계정을 생성하여 로봇 호출 서비스를 이용해보세요" 
                : "도서관 모바일 로봇 서비스를 위해 로그인해주세요"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground" htmlFor="fullName">이름</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 size-4 text-muted-foreground" />
                    <input
                      id="fullName"
                      type="text"
                      required
                      placeholder="홍길동"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="h-10 w-full rounded-xl border border-border bg-background px-9 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground" htmlFor="email">이메일</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 size-4 text-muted-foreground" />
                    <input
                      id="email"
                      type="email"
                      required
                      placeholder="example@libi.org"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-10 w-full rounded-xl border border-border bg-background px-9 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground" htmlFor="username">아이디</label>
              <div className="relative">
                <User className="absolute left-3 top-3 size-4 text-muted-foreground" />
                <input
                  id="username"
                  type="text"
                  required
                  placeholder="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-10 w-full rounded-xl border border-border bg-background px-9 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground" htmlFor="password">비밀번호</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 size-4 text-muted-foreground" />
                <input
                  id="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 w-full rounded-xl border border-border bg-background px-9 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {isRegister && (
              <div className="flex items-start gap-2.5 pt-1">
                <input
                  id="agreeTerms"
                  type="checkbox"
                  required
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-1 size-4 rounded border-border bg-background text-primary focus:ring-primary/20"
                />
                <label htmlFor="agreeTerms" className="text-xs text-muted-foreground leading-tight">
                  <span className="font-semibold text-foreground">서비스 이용약관</span> 및 <span className="font-semibold text-foreground">개인정보 처리방침</span>에 동의합니다. (필수)
                </label>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-600">
                ⚠️ {error}
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-xs font-medium text-green-700">
                <CheckCircle2 className="size-4 shrink-0" />
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-indigo-600 text-sm font-bold text-white shadow-md transition-all hover:from-primary/95 hover:to-indigo-500 hover:shadow-lg disabled:opacity-50"
            >
              {loading ? "처리 중..." : isRegister ? "가입하기" : "로그인"}
              <ArrowRight className="size-4" />
            </button>
          </form>

          {/* Toggle */}
          <div className="mt-6 text-center text-xs">
            <span className="text-muted-foreground">
              {isRegister ? "이미 계정이 있으신가요?" : "처음이신가요?"}
            </span>{" "}
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setError(null);
                setSuccess(null);
              }}
              className="font-bold text-primary hover:underline focus:outline-none"
            >
              {isRegister ? "로그인하기" : "회원가입하기"}
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
