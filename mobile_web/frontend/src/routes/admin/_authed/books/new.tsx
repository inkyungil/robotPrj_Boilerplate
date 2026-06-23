import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { adminApi, type CreateBookInput } from "@/lib/admin-api";

export const Route = createFileRoute("/admin/_authed/books/new")({
  head: () => ({ meta: [{ title: "Libi Admin — 도서 등록" }] }),
  component: AddBookPage,
});

const GRADIENTS = [
  { name: "Sky Indigo", value: "from-blue-500 to-indigo-500" },
  { name: "Mint Teal", value: "from-emerald-400 to-teal-500" },
  { name: "Warm Amber", value: "from-orange-400 to-amber-500" },
  { name: "Rose Pink", value: "from-pink-500 to-rose-500" },
  { name: "Violet Night", value: "from-purple-500 to-violet-600" },
  { name: "Dark Slate", value: "from-slate-600 to-slate-800" },
];

const EMOJIS = ["📙", "📘", "📗", "📕", "📓", "📔", "📖", "📚", "🧠", "💡", "🌍", "📈", "🎨", "🌿"];

const CATEGORIES = [
  { value: "fiction", label: "소설" },
  { value: "self", label: "자기계발" },
  { value: "foreign", label: "외국도서" },
  { value: "humanities", label: "인문/사회" },
  { value: "economy", label: "경제/경영" },
  { value: "poetry", label: "시/에세이" },
];

function AddBookPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Form State
  const [titleKr, setTitleKr] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [titleZh, setTitleZh] = useState("");
  const [titleVi, setTitleVi] = useState("");
  const [author, setAuthor] = useState("");
  const [category, setCategory] = useState("fiction");
  const [cover, setCover] = useState("📙");
  const [color, setColor] = useState("from-blue-500 to-indigo-500");
  const [zone, setZone] = useState("");
  const [shelf, setShelf] = useState("");
  const [inStock, setInStock] = useState(true);
  const [summaryKr, setSummaryKr] = useState("");
  const [summaryEn, setSummaryEn] = useState("");
  const [summaryZh, setSummaryZh] = useState("");
  const [summaryVi, setSummaryVi] = useState("");
  const [forWhomKr, setForWhomKr] = useState("");
  const [forWhomEn, setForWhomEn] = useState("");
  const [forWhomZh, setForWhomZh] = useState("");
  const [forWhomVi, setForWhomVi] = useState("");

  const createMutation = useMutation({
    mutationFn: (data: CreateBookInput) => adminApi.createBook(data),
    onSuccess: () => {
      toast.success("신규 도서가 성공적으로 등록되었습니다.");
      void qc.invalidateQueries({ queryKey: ["admin", "books"] });
      void qc.invalidateQueries({ queryKey: ["admin", "stats"] });
      void navigate({ to: "/admin/books" });
    },
    onError: (err: any) => {
      toast.error(err.message || "도서 등록에 실패했습니다.");
      setLoading(false);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const parseTags = (s: string) =>
      s
        ? s
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [];

    const payload: CreateBookInput = {
      title: {
        KR: titleKr.trim(),
        EN: titleEn.trim() || titleKr.trim(),
        ZH: titleZh.trim() || titleKr.trim(),
        VI: titleVi.trim() || titleKr.trim(),
      },
      author: author.trim(),
      category,
      cover,
      color,
      zone: zone.trim().toUpperCase(),
      shelf: shelf.trim(),
      inStock,
      summary: {
        KR: summaryKr.trim(),
        EN: summaryEn.trim(),
        ZH: summaryZh.trim(),
        VI: summaryVi.trim(),
      },
      forWhom: {
        KR: parseTags(forWhomKr),
        EN: parseTags(forWhomEn),
        ZH: parseTags(forWhomZh),
        VI: parseTags(forWhomVi),
      },
    };

    createMutation.mutate(payload);
  }

  return (
    <AdminShell title="도서 등록">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="size-8">
            <Link to="/admin/books">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <h1 className="text-xl font-bold text-slate-800">신규 도서 등록</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Left Column: Cover & Visuals */}
            <div className="md:col-span-1 space-y-6">
              <Card className="border-slate-200 bg-white">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">도서 비주얼</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Visual Preview */}
                  <div className="flex justify-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <div className={`flex size-24 items-center justify-center rounded-3xl bg-gradient-to-tr ${color} text-5xl shadow-lg shadow-indigo-500/10`}>
                      {cover}
                    </div>
                  </div>

                  {/* Emoji Selection */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-500">이모지 커버</Label>
                    <div className="grid grid-cols-7 gap-1.5">
                      {EMOJIS.map((e) => (
                        <button
                          key={e}
                          type="button"
                          onClick={() => setCover(e)}
                          className={`flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-all ${
                            cover === e
                              ? "bg-orange-100 border-2 border-orange-500 scale-105"
                              : "bg-slate-50 border border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Gradient Background Selection */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-500">그라디언트 테마</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {GRADIENTS.map((g) => (
                        <button
                          key={g.name}
                          type="button"
                          onClick={() => setColor(g.value)}
                          className={`flex h-9 items-center justify-between rounded-lg px-2 text-[11px] font-medium text-white transition-all shadow-sm ${g.value} ${
                            color === g.value
                              ? "ring-2 ring-orange-500 ring-offset-2 scale-[1.02]"
                              : "hover:opacity-95"
                          }`}
                        >
                          <span>{g.name}</span>
                          <span className="h-2 w-2 rounded-full bg-white/40" />
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Book Details */}
            <div className="md:col-span-2 space-y-6">
              <Card className="border-slate-200 bg-white">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">기본 도서 정보</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Title (KR) */}
                  <div className="grid gap-2">
                    <Label htmlFor="titleKr">도서 제목 (한국어) *</Label>
                    <Input
                      id="titleKr"
                      required
                      placeholder="예: 불편한 편의점"
                      value={titleKr}
                      onChange={(e) => setTitleKr(e.target.value)}
                    />
                  </div>

                  {/* Title (EN) */}
                  <div className="grid gap-2">
                    <Label htmlFor="titleEn">도서 제목 (영어)</Label>
                    <Input
                      id="titleEn"
                      placeholder="예: Uncanny Convenience Store"
                      value={titleEn}
                      onChange={(e) => setTitleEn(e.target.value)}
                    />
                  </div>

                  {/* Title (ZH) */}
                  <div className="grid gap-2">
                    <Label htmlFor="titleZh">도서 제목 (중국어)</Label>
                    <Input
                      id="titleZh"
                      placeholder="예: 不便的便利店"
                      value={titleZh}
                      onChange={(e) => setTitleZh(e.target.value)}
                    />
                  </div>

                  {/* Title (VI) */}
                  <div className="grid gap-2">
                    <Label htmlFor="titleVi">도서 제목 (베트남어)</Label>
                    <Input
                      id="titleVi"
                      placeholder="예: Cửa Hàng Tiện Lợi Bất Tiện"
                      value={titleVi}
                      onChange={(e) => setTitleVi(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Author */}
                    <div className="grid gap-2">
                      <Label htmlFor="author">저자명 *</Label>
                      <Input
                        id="author"
                        required
                        placeholder="예: 김호연"
                        value={author}
                        onChange={(e) => setAuthor(e.target.value)}
                      />
                    </div>

                    {/* Category */}
                    <div className="grid gap-2">
                      <Label htmlFor="category">카테고리 *</Label>
                      <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger id="category">
                          <SelectValue placeholder="카테고리 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Zone */}
                    <div className="grid gap-2">
                      <Label htmlFor="zone">보관 구역 (Zone) *</Label>
                      <Input
                        id="zone"
                        required
                        placeholder="예: A-2, E-1"
                        value={zone}
                        onChange={(e) => setZone(e.target.value)}
                      />
                    </div>

                    {/* Shelf */}
                    <div className="grid gap-2">
                      <Label htmlFor="shelf">서가 위치 설명 *</Label>
                      <Input
                        id="shelf"
                        required
                        placeholder="예: 셋째 줄, 첫째 줄"
                        value={shelf}
                        onChange={(e) => setShelf(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* In Stock */}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                    <div className="space-y-0.5">
                      <Label htmlFor="inStock" className="cursor-pointer">대출 가능 여부</Label>
                      <p className="text-xs text-muted-foreground">활성화 시 모바일에서 로봇 호출 및 대출 신청이 가능해집니다.</p>
                    </div>
                    <Switch id="inStock" checked={inStock} onCheckedChange={setInStock} />
                  </div>
                </CardContent>
              </Card>

              {/* Multilingual Summaries */}
              <Card className="border-slate-200 bg-white">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">도서 요약 설명</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="summaryKr">한국어 요약</Label>
                    <Input
                      id="summaryKr"
                      placeholder="도서 요약 설명을 한국어로 적어주세요."
                      value={summaryKr}
                      onChange={(e) => setSummaryKr(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="summaryEn">영어 요약</Label>
                    <Input
                      id="summaryEn"
                      placeholder="Summary in English"
                      value={summaryEn}
                      onChange={(e) => setSummaryEn(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="summaryZh">중국어 요약</Label>
                    <Input
                      id="summaryZh"
                      placeholder="Summary in Chinese"
                      value={summaryZh}
                      onChange={(e) => setSummaryZh(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="summaryVi">베트남어 요약</Label>
                    <Input
                      id="summaryVi"
                      placeholder="Summary in Vietnamese"
                      value={summaryVi}
                      onChange={(e) => setSummaryVi(e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Recommendations / Tags */}
              <Card className="border-slate-200 bg-white">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">추천 대상 / 태그 설정 (쉼표로 구분)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="forWhomKr">한국어 추천태그 (예: 힐링, 위로, 소소한 행복)</Label>
                    <Input
                      id="forWhomKr"
                      placeholder="힐링, 위로, 동네 사랑방"
                      value={forWhomKr}
                      onChange={(e) => setForWhomKr(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="forWhomEn">영어 추천태그</Label>
                    <Input
                      id="forWhomEn"
                      placeholder="healing, comfort, neighborhood"
                      value={forWhomEn}
                      onChange={(e) => setForWhomEn(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="forWhomZh">중국어 추천태그</Label>
                    <Input
                      id="forWhomZh"
                      placeholder="治愈, 安慰, 邻里"
                      value={forWhomZh}
                      onChange={(e) => setForWhomZh(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="forWhomVi">베트남어 추천태그</Label>
                    <Input
                      id="forWhomVi"
                      placeholder="chữa lành, an ủi, hàng xóm"
                      value={forWhomVi}
                      onChange={(e) => setForWhomVi(e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3">
                <Button asChild variant="outline" className="cursor-pointer">
                  <Link to="/admin/books">취소</Link>
                </Button>
                <Button type="submit" disabled={loading} className="gap-1.5 bg-orange-600 hover:bg-orange-500 text-white cursor-pointer">
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  도서 등록 완료
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </AdminShell>
  );
}
