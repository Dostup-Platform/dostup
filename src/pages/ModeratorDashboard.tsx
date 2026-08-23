import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, LogOut, Lock, Unlock, Trash2, KeyRound, MessageCircle, Users, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import SupportChat from "@/components/SupportChat";
import { AppLogoLink } from "@/components/auth/AuthMark";

interface CreatorRow {
  id: string;
  login: string;
  display_name: string;
  account_type: string;
  is_blocked: boolean;
  created_at: string;
  students_count: number;
  revenue: number;
  products_count: number;
}
interface Totals { creators: number; students: number; revenue: number; products: number }
interface Thread {
  id: string; user_type: string; user_ref: string; display_name: string;
  last_message_at: string; last_message_preview: string | null;
  unread_for_moderator: number;
}

const ModeratorDashboard = () => {
  const navigate = useNavigate();
  const baseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  const token = typeof window !== "undefined" ? localStorage.getItem("moderator_token") : null;

  const [tab, setTab] = useState<"creators" | "support">("creators");
  const [loading, setLoading] = useState(true);
  const [creators, setCreators] = useState<CreatorRow[]>([]);
  const [totals, setTotals] = useState<Totals>({ creators: 0, students: 0, revenue: 0, products: 0 });
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);

  const [resetTarget, setResetTarget] = useState<CreatorRow | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CreatorRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const call = useCallback(async (body: Record<string, unknown>) => {
    const resp = await fetch(`${baseUrl}/functions/v1/moderator-api`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify({ ...body, token }),
    });
    return resp.json();
  }, [baseUrl, anonKey, token]);

  const loadStats = useCallback(async () => {
    const data = await call({ action: "stats" });
    if (data?.success) {
      setCreators(data.creators);
      setTotals(data.totals);
    }
  }, [call]);

  const loadThreads = useCallback(async () => {
    const data = await call({ action: "support_list_threads" });
    if (data?.success) setThreads(data.threads);
  }, [call]);

  useEffect(() => {
    if (!token) {
      navigate("/");
      return;
    }
    (async () => {
      const v = await call({ action: "validate" });
      if (!v?.success) {
        localStorage.removeItem("moderator_token");
        navigate("/");
        return;
      }
      await Promise.all([loadStats(), loadThreads()]);
      setLoading(false);
    })();
  }, [token, navigate, call, loadStats, loadThreads]);

  // Realtime threads
  useEffect(() => {
    const ch = supabase
      .channel("mod-threads")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_threads" }, () => loadThreads())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadThreads]);

  const logout = () => {
    localStorage.removeItem("moderator_token");
    navigate("/");
  };

  const toggleBlock = async (c: CreatorRow) => {
    setBusyId(c.id);
    const data = await call({ action: "block_creator", creator_id: c.id, blocked: !c.is_blocked });
    setBusyId(null);
    if (data?.success) {
      toast.success(c.is_blocked ? "Разблокирован" : "Заблокирован");
      loadStats();
    } else {
      toast.error(data?.error || "Ошибка");
    }
  };

  const doReset = async () => {
    if (!resetTarget) return;
    if (resetPassword.length < 6) { toast.error("Минимум 6 символов"); return; }
    const data = await call({ action: "reset_creator_password", creator_id: resetTarget.id, new_password: resetPassword });
    if (data?.success) {
      toast.success(`Новый пароль для ${resetTarget.display_name} установлен`);
      setResetTarget(null);
      setResetPassword("");
    } else {
      toast.error(data?.error || "Ошибка");
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    const data = await call({ action: "delete_creator", creator_id: deleteTarget.id });
    setBusyId(null);
    if (data?.success) {
      toast.success("Аккаунт удалён");
      setDeleteTarget(null);
      loadStats();
    } else {
      toast.error(data?.error || "Ошибка");
    }
  };

  const totalUnread = useMemo(() => threads.reduce((s, t) => s + (t.unread_for_moderator || 0), 0), [threads]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AppLogoLink markClassName="h-auto w-20 sm:w-24" />
            <h1 className="text-lg font-bold">Панель модератора</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="w-4 h-4 mr-2" /> Выйти
          </Button>
        </div>
        <nav className="flex gap-1 px-4 pb-2">
          <Button variant={tab === "creators" ? "default" : "ghost"} size="sm" onClick={() => setTab("creators")}>
            <BarChart3 className="w-4 h-4 mr-2" /> Создатели
          </Button>
          <Button variant={tab === "support" ? "default" : "ghost"} size="sm" onClick={() => setTab("support")} className="relative">
            <MessageCircle className="w-4 h-4 mr-2" /> Поддержка
            {totalUnread > 0 && (
              <span className="ml-2 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full text-xs bg-destructive text-destructive-foreground">{totalUnread}</span>
            )}
          </Button>
        </nav>
      </header>

      <main className="px-4 py-6">
        {tab === "creators" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Создателей" value={totals.creators} />
              <StatCard label="Учеников" value={totals.students} />
              <StatCard label="Продуктов" value={totals.products} />
              <StatCard label="Доход, ₸" value={totals.revenue.toLocaleString("ru-RU")} />
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3">Создатель</th>
                        <th className="text-left p-3">Тип</th>
                        <th className="text-right p-3">Учеников</th>
                        <th className="text-right p-3">Доход, ₸</th>
                        <th className="text-right p-3">Продуктов</th>
                        <th className="text-left p-3">Статус</th>
                        <th className="text-right p-3">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {creators.map((c) => (
                        <tr key={c.id} className="border-t">
                          <td className="p-3">
                            <div className="font-medium">{c.display_name}</div>
                            <div className="text-xs text-muted-foreground">{c.login}</div>
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">{c.account_type === "online_school" ? "Школа" : "Создатель"}</td>
                          <td className="p-3 text-right">{c.students_count}</td>
                          <td className="p-3 text-right">{c.revenue.toLocaleString("ru-RU")}</td>
                          <td className="p-3 text-right">{c.products_count}</td>
                          <td className="p-3">
                            {c.is_blocked
                              ? <Badge variant="destructive">Заблокирован</Badge>
                              : <Badge variant="secondary">Активен</Badge>}
                          </td>
                          <td className="p-3">
                            <div className="flex gap-1 justify-end">
                              <Button size="sm" variant="ghost" onClick={() => setResetTarget(c)} title="Сбросить пароль">
                                <KeyRound className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => toggleBlock(c)} disabled={busyId === c.id} title={c.is_blocked ? "Разблокировать" : "Заблокировать"}>
                                {c.is_blocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                              </Button>
                              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteTarget(c)} title="Удалить">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {creators.length === 0 && (
                        <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Создателей пока нет</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {tab === "support" && (
          <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4">
            <Card>
              <CardContent className="p-0">
                <div className="max-h-[70vh] overflow-y-auto divide-y">
                  {threads.length === 0 && (
                    <div className="p-4 text-center text-muted-foreground text-sm">Чатов пока нет</div>
                  )}
                  {threads.map((t) => (
                    <button
                      key={t.id}
                      className={`w-full text-left p-3 hover:bg-muted/50 ${selectedThread?.id === t.id ? "bg-muted" : ""}`}
                      onClick={() => setSelectedThread(t)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium truncate">{t.display_name}</div>
                        {t.unread_for_moderator > 0 && (
                          <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full text-xs bg-destructive text-destructive-foreground">{t.unread_for_moderator}</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground capitalize">{t.user_type}</div>
                      {t.last_message_preview && (
                        <div className="text-xs text-muted-foreground truncate mt-1">{t.last_message_preview}</div>
                      )}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
            <div>
              {selectedThread ? (
                <SupportChat
                  key={selectedThread.id}
                  asModerator
                  threadId={selectedThread.id}
                  moderatorToken={token!}
                  userType={selectedThread.user_type as any}
                  userRef={selectedThread.user_ref}
                  displayName={selectedThread.display_name}
                />
              ) : (
                <Card><CardContent className="p-8 text-center text-muted-foreground">Выберите чат слева</CardContent></Card>
              )}
            </div>
          </div>
        )}
      </main>

      <Dialog open={!!resetTarget} onOpenChange={(o) => !o && setResetTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Сбросить пароль</DialogTitle>
            <DialogDescription>{resetTarget?.display_name} — введите новый пароль (минимум 6 символов).</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="newpwd">Новый пароль</Label>
            <Input id="newpwd" type="text" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetTarget(null)}>Отмена</Button>
            <Button onClick={doReset}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить аккаунт навсегда?</AlertDialogTitle>
            <AlertDialogDescription>
              Будут удалены продукты, расписания, материалы, объявления и покупки {deleteTarget?.display_name}. Действие необратимо.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-destructive text-destructive-foreground">Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const StatCard = ({ label, value }: { label: string; value: string | number }) => (
  <Card><CardContent className="p-4">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="text-2xl font-bold mt-1">{value}</div>
  </CardContent></Card>
);

export default ModeratorDashboard;