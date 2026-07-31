import { useMemo, useState } from "react";
import { Loader2, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCreatorPurchases, useRevokeAccess, type PurchaseWithProduct } from "@/hooks/usePurchases";

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU");
};

const formatKZT = (n: number) =>
  new Intl.NumberFormat("ru-RU", { style: "currency", currency: "KZT", minimumFractionDigits: 0 }).format(n);

export default function CreatorUsersTab({ userId }: { userId: string }) {
  const { data: purchases = [], isLoading } = useCreatorPurchases(userId);
  const revoke = useRevokeAccess();
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<PurchaseWithProduct | null>(null);

  const activeUsers = useMemo(
    () => purchases.filter((p) => p.status === "completed"),
    [purchases],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activeUsers;
    return activeUsers.filter((p) => {
      const name = (p.buyer?.name ?? "").toLowerCase();
      const email = (p.buyer?.email ?? "").toLowerCase();
      const title = (p.product?.title ?? "").toLowerCase();
      return name.includes(q) || email.includes(q) || title.includes(q);
    });
  }, [activeUsers, search]);

  const handleRevoke = async () => {
    if (!target) return;
    try {
      await revoke.mutateAsync(target.id);
      toast.success("Доступ закрыт");
      setTarget(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Пользователи ({activeUsers.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по имени, email или продукту"
        />
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground">Пока нет учеников с доступом.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center gap-3 p-3 border rounded-lg"
              >
                <div className="flex-1 min-w-[200px]">
                  <div className="font-medium">
                    {p.buyer?.name ?? p.buyer?.email ?? p.user_id.slice(0, 8)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {p.product?.title ?? "—"} · {formatKZT(Number(p.amount))} · {fmtDate(p.created_at)}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => setTarget(p)}>
                  <ShieldOff className="w-4 h-4 mr-1" />
                  Закрыть доступ
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={!!target} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Закрыть доступ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Вы уверены, что хотите закрыть доступ пользователю{" "}
            <span className="font-medium text-foreground">
              {target?.buyer?.name ?? target?.buyer?.email}
            </span>{" "}
            к продукту «{target?.product?.title}»? Покупка будет отмечена как отклонённая, ученик
            потеряет доступ к материалам и расписанию.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              Отмена
            </Button>
            <Button variant="destructive" disabled={revoke.isPending} onClick={handleRevoke}>
              Закрыть доступ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
