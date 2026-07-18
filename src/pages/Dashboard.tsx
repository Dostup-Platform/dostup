import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import { useProducts } from "@/hooks/useProducts";
import { supabase } from "@/integrations/supabase/client";
import {
  useMyPurchases,
  useCreatorPurchases,
  useApprovePurchase,
  useRejectPurchase,
} from "@/hooks/usePurchases";
import { useQuery } from "@tanstack/react-query";
import { Loader2, CheckCircle2, XCircle, Clock, ExternalLink, BookOpen, FolderOpen, Calendar } from "lucide-react";
import { toast } from "sonner";

const roleLabels: Record<AppRole, string> = {
  admin: "Администратор",
  creator: "Автор",
  school_admin: "Школа",
  teacher: "Преподаватель",
  moderator: "Модератор",
  student: "Ученик",
  user: "Пользователь",
};

const statusLabel = (s: string) =>
  s === "completed" ? "Оплачено" : s === "pending" ? "Ожидание" : s === "rejected" ? "Отклонено" : s;

const formatKZT = (n: number) =>
  new Intl.NumberFormat("ru-RU", { style: "currency", currency: "KZT", minimumFractionDigits: 0 }).format(n);

const StudentView = ({ userId }: { userId: string }) => {
  const { data: purchases = [], isLoading } = useMyPurchases(userId);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Мои продукты</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : purchases.length === 0 ? (
          <p className="text-muted-foreground">У вас пока нет покупок. <Link to="/" className="text-primary underline">Посмотреть каталог</Link></p>
        ) : (
          <div className="space-y-3">
            {purchases.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-3 border rounded-lg">
                {p.product?.image_url ? (
                  <img src={p.product.image_url} alt="" className="w-16 h-16 rounded object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded bg-muted" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{p.product?.title ?? "Продукт удалён"}</div>
                  <div className="text-sm text-muted-foreground">{formatKZT(Number(p.amount))}</div>
                </div>
                <Badge variant={p.status === "completed" ? "default" : p.status === "rejected" ? "destructive" : "secondary"}>
                  {p.status === "pending" && <Clock className="w-3 h-3 mr-1" />}
                  {p.status === "completed" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                  {p.status === "rejected" && <XCircle className="w-3 h-3 mr-1" />}
                  {statusLabel(p.status)}
                </Badge>
                {p.product?.id && p.status === "completed" ? (
                  <div className="flex gap-1">
                    <Button asChild size="sm">
                      <Link to={`/materials/${p.product.id}`}><BookOpen className="w-4 h-4 mr-1" />Открыть</Link>
                    </Button>
                    {p.product?.has_schedule && (
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/schedule/${p.product.id}`}><Calendar className="w-4 h-4" /></Link>
                      </Button>
                    )}
                  </div>
                ) : p.product?.id ? (
                  <Button asChild size="sm" variant="ghost">
                    <Link to={`/product/${p.product.id}`}><ExternalLink className="w-4 h-4" /></Link>
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const CreatorView = ({ userId }: { userId: string }) => {
  const { data: purchases = [], isLoading } = useCreatorPurchases(userId);
  const approve = useApprovePurchase();
  const reject = useRejectPurchase();

  const { data: myProducts = [] } = useQuery({
    queryKey: ["my-products", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products").select("id,title,is_active,is_paused,price,image_url,has_schedule")
        .eq("owner_id", userId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const pending = purchases.filter((p) => p.status === "pending");
  const history = purchases.filter((p) => p.status !== "pending").slice(0, 20);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Заявки на покупку ({pending.length})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : pending.length === 0 ? (
            <p className="text-muted-foreground">Новых заявок нет.</p>
          ) : (
            <div className="space-y-3">
              {pending.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center gap-3 p-3 border rounded-lg">
                  <div className="flex-1 min-w-[200px]">
                    <div className="font-medium">{p.product?.title ?? "—"}</div>
                    <div className="text-sm text-muted-foreground">
                      {p.buyer?.name ?? p.buyer?.email ?? p.user_id.slice(0, 8)} · {formatKZT(Number(p.amount))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={async () => {
                      try { await approve.mutateAsync(p.id); toast.success("Подтверждено"); }
                      catch (e) { toast.error((e as Error).message); }
                    }}>Подтвердить</Button>
                    <Button size="sm" variant="outline" onClick={async () => {
                      if (!confirm("Отклонить заявку?")) return;
                      try { await reject.mutateAsync(p.id); toast.success("Отклонено"); }
                      catch (e) { toast.error((e as Error).message); }
                    }}>Отклонить</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Мои продукты ({myProducts.length})</CardTitle></CardHeader>
        <CardContent>
          {myProducts.length === 0 ? (
            <p className="text-muted-foreground">У вас пока нет продуктов.</p>
          ) : (
            <div className="space-y-2">
              {myProducts.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  {p.image_url ? <img src={p.image_url} alt="" className="w-12 h-12 rounded object-cover" /> : <div className="w-12 h-12 rounded bg-muted" />}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{p.title}</div>
                    <div className="text-sm text-muted-foreground">{formatKZT(Number(p.price))}</div>
                  </div>
                  {p.is_paused && <Badge variant="secondary">На паузе</Badge>}
                  {!p.is_active && <Badge variant="destructive">Скрыт</Badge>}
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/creator/products/${p.id}/materials`}><FolderOpen className="w-4 h-4 mr-1" />Материалы</Link>
                  </Button>
                  {p.has_schedule && (
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/creator/products/${p.id}/schedule`}><Calendar className="w-4 h-4 mr-1" />Расписание</Link>
                    </Button>
                  )}
                  <Button asChild size="sm" variant="ghost">
                    <Link to={`/product/${p.id}`}><ExternalLink className="w-4 h-4" /></Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardHeader><CardTitle>История заявок</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {history.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-2 border rounded-lg text-sm">
                  <div className="flex-1 min-w-0 truncate">
                    <span className="font-medium">{p.product?.title}</span>
                    <span className="text-muted-foreground"> · {p.buyer?.name ?? p.buyer?.email ?? p.user_id.slice(0,8)}</span>
                  </div>
                  <Badge variant={p.status === "completed" ? "default" : "destructive"}>{statusLabel(p.status)}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { data: publicProducts } = useProducts();
  const { user, loading, roles, activeRole, switchRole, signOut } = useAuth();

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const isCreator = activeRole === "creator" || roles.includes("creator");
  const showCreator = activeRole === "creator";

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _ = publicProducts;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <Link to="/" className="text-xl font-bold">Доступ</Link>
          <div className="flex items-center gap-2">
            {roles.length > 1 && (
              <div className="flex gap-1">
                {roles.map((r) => (
                  <Button key={r} size="sm" variant={r === activeRole ? "default" : "outline"}
                    onClick={() => switchRole(r)}>{roleLabels[r] ?? r}</Button>
                ))}
              </div>
            )}
            <span className="text-sm text-muted-foreground hidden md:inline">{user.email}</span>
            <Button variant="outline" size="sm" onClick={() => signOut()}>Выйти</Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {showCreator ? (
          <CreatorView userId={user.id} />
        ) : (
          <>
            <StudentView userId={user.id} />
            {isCreator && (
              <p className="text-sm text-muted-foreground text-center">
                Переключитесь на роль «Автор» в шапке, чтобы управлять продуктами и заявками.
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Dashboard;