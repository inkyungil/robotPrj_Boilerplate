import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Pencil, Plus, Search, Trash2, BookOpen, AlertCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin/AdminShell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminApi, type Book } from "@/lib/admin-api";

export const Route = createFileRoute("/admin/_authed/books/")({
  head: () => ({ meta: [{ title: "Libi Admin — 도서 관리" }] }),
  component: BooksListPage,
});

function BooksListPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Book | null>(null);

  const { data: books = [], isLoading, error } = useQuery({
    queryKey: ["admin", "books", query],
    queryFn: () => adminApi.listBooks(query || undefined),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminApi.deleteBook(id),
    onSuccess: () => {
      toast.success("도서가 삭제되었습니다.");
      void qc.invalidateQueries({ queryKey: ["admin", "books"] });
      void qc.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "도서 삭제에 실패했습니다.");
    },
  });

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setQuery(search.trim());
  }

  function confirmDelete() {
    if (deleteTarget) {
      deleteMutation.mutate(Number(deleteTarget.id));
      setDeleteTarget(null);
    }
  }

  const categoryMap: Record<string, string> = {
    fiction: "소설",
    self: "자기계발",
    foreign: "외국도서",
    humanities: "인문/사회",
    economy: "경제/경영",
    poetry: "시/에세이",
  };

  return (
    <AdminShell title="도서 관리">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-bold text-slate-800">도서 목록</h1>
          <Button asChild className="shrink-0 gap-1.5 bg-orange-600 hover:bg-orange-500 text-white shadow-sm cursor-pointer">
            <Link to="/admin/books/new">
              <Plus className="size-4" />
              신규 도서 등록
            </Link>
          </Button>
        </div>

        <Card className="border-slate-200 bg-white">
          <CardHeader className="pb-3">
            <form onSubmit={handleSearchSubmit} className="flex max-w-sm gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 size-4 text-slate-400" />
                <Input
                  placeholder="도서 제목, 저자, 카테고리..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 text-sm focus-visible:ring-orange-500"
                />
              </div>
              <Button type="submit" variant="secondary" className="cursor-pointer">
                검색
              </Button>
            </form>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="size-8 animate-spin text-slate-400" />
              </div>
            ) : error ? (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
                <AlertCircle className="size-4" />
                도서 목록을 불러오지 못했습니다: {(error as Error).message}
              </div>
            ) : (
              <div className="rounded-lg border border-slate-100 overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-[80px] text-center">표지</TableHead>
                      <TableHead>도서 정보</TableHead>
                      <TableHead>카테고리</TableHead>
                      <TableHead>서가 위치</TableHead>
                      <TableHead>대출 상태</TableHead>
                      <TableHead className="w-[120px] text-right">관리</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {books.map((b) => (
                      <TableRow key={b.id} className="hover:bg-slate-50/50">
                        <TableCell className="text-center">
                          <div className={`mx-auto flex size-10 items-center justify-center rounded-xl bg-gradient-to-tr ${b.color || 'from-orange-400 to-amber-500'} text-xl shadow-inner`}>
                            {b.cover || "📙"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-slate-900">{b.title.KR}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{b.author}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{b.title.EN}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-slate-100/50 text-slate-700 border-slate-200">
                            {categoryMap[b.category] || b.category}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-slate-800">{b.zone} 구역</div>
                          <div className="text-xs text-slate-500 mt-0.5">{b.shelf}</div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              b.inStock
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                                : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-100"
                            }
                            variant="outline"
                          >
                            {b.inStock ? "대출 가능" : "대출 중"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-slate-500 hover:text-slate-900"
                              onClick={() => {
                                void navigate({
                                  to: "/admin/books/edit",
                                  search: { id: b.id },
                                });
                              }}
                            >
                              <Pencil className="size-4" />
                              <span className="sr-only">수정</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-destructive hover:bg-destructive/5 hover:text-destructive"
                              onClick={() => setDeleteTarget(b)}
                            >
                              <Trash2 className="size-4" />
                              <span className="sr-only">삭제</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {books.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center text-slate-400">
                          <BookOpen className="mx-auto size-8 text-slate-300 mb-2" />
                          등록된 도서가 없습니다.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>도서 삭제 확인</AlertDialogTitle>
            <AlertDialogDescription>
              정말로 『{deleteTarget?.title.KR}』 도서를 삭제하시겠습니까? <br />
              삭제된 도서 정보는 복구할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}
