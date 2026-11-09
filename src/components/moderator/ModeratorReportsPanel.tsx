import { incomingReport, type ProductReport } from "@/lib/moderationTypes";
import type { ModeratorCall, ModeratorThread } from "@/lib/moderationTypes";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import ModerationCountdown from "./ModerationCountdown";
import ModeratorProductPreview from "./ModeratorProductPreview";
const labels = {
  pending: "Поступившая",
  correction_requested: "Ожидает исправления",
  dismissed: "Отклонена",
  blocked: "Аккаунт заблокирован",
  resolved: "Рассмотрена ранее",
};
export default function ModeratorReportsPanel({
  reports,
  loading,
  call,
  onChange,
  onThread,
}: {
  reports: ProductReport[];
  loading: boolean;
  call: ModeratorCall;
  onChange: () => Promise<void>;
  onThread: (thread: ModeratorThread) => void;
}) {
  const [filter, setFilter] = useState("incoming");
  const [busy, setBusy] = useState<string | null>(null);
  const [correction, setCorrection] = useState<ProductReport | null>(null);
  const [text, setText] = useState("");
  const [block, setBlock] = useState<ProductReport | null>(null);
  const [preview, setPreview] = useState<ProductReport | null>(null);
  async function decide(report: ProductReport, status: string) {
    setBusy(report.id);
    try {
      const r = await call({
        action: "update_report_status",
        report_id: report.id,
        status,
        correction_text: text.trim(),
      });
      if (!r.success) throw new Error(r.error);
      setCorrection(null);
      setBlock(null);
      setText("");
      await onChange();
      toast.success(
        status === "dismissed"
          ? "Жалоба отклонена"
          : status === "blocked"
          ? "Аккаунт заблокирован"
          : "Исправление запрошено. Срок — 72 часа",
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Не удалось принять решение",
      );
    } finally {
      setBusy(null);
    }
  }
  async function message(r: ProductReport) {
    setBusy(r.id);
    try {
      const data = await call({ action: "reporter_thread", report_id: r.id });
      if (!data.success || !data.thread) {
        throw new Error(data.error || "Диалог не найден");
      }
      onThread(data.thread);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось открыть диалог");
    } finally {
      setBusy(null);
    }
  }
  const visible = reports.filter((r) =>
    filter === "all" ||
    (filter === "incoming" ? incomingReport(r) : r.status === filter)
  );
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">Жалобы на продукты и продавцов</h2>
        <p className="text-sm text-muted-foreground">
          Ограничения действуют до решения по всем открытым жалобам продавца.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {[["incoming", "Поступившие"], ["dismissed", "Отклонённые"], [
          "blocked",
          "Заблокированные",
        ], ["all", "Все"]].map(([id, label]) => (
          <Button
            key={id}
            size="sm"
            variant={filter === id ? "default" : "outline"}
            onClick={() => setFilter(id)}
          >
            {label} ({reports.filter((r) =>
              id === "all" ||
              (id === "incoming" ? incomingReport(r) : r.status === id)
            ).length})
          </Button>
        ))}
      </div>
      {loading && !reports.length
        ? <Loader2 className="animate-spin" />
        : !visible.length
        ? (
          <p className="py-12 text-center text-muted-foreground">
            В этом разделе нет жалоб
          </p>
        )
        : (
          <div className="grid gap-4 xl:grid-cols-2">
            {visible.map((r) => (
              <Card
                key={r.id}
                className={incomingReport(r) ? "border-amber-300" : ""}
              >
                <CardContent className="space-y-4 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("ru-RU")}
                    </span>
                    <Badge variant="outline">{labels[r.status]}</Badge>
                  </div>
                  <div>
                    <h3 className="font-semibold">
                      {r.target_type === "account"
                        ? "Жалоба на профиль"
                        : r.product_title || "Продукт удалён"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Продавец: {r.seller_name || "Удалён"}{" "}
                      · Жалоба №{r.report_number}{" "}
                      на продавца{r.target_type === "product" &&
                        ` · №${r.product_report_number || 1} на продукт`}
                    </p>
                  </div>
                  <div className="rounded-xl bg-amber-500/10 p-3">
                    <p className="text-sm font-semibold">Причина: {r.reason}</p>
                    {r.description && (
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                        Комментарии: {r.description}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span>
                      Пожаловался:{" "}
                      {r.reporter_name || "Пользователь старой жалобы"}
                    </span>
                    {r.reporter_user_ref && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === r.id}
                        onClick={() => void message(r)}
                      >
                        <MessageSquare className="mr-2 h-4 w-4" />Написать
                      </Button>
                    )}
                  </div>
                  {r.correction_deadline && (
                    <div className="space-y-2 rounded-xl border p-3 text-sm">
                      <p className="whitespace-pre-wrap">
                        Исправить: {r.correction_text}
                      </p>
                      {incomingReport(r)
                        ? (
                          <ModerationCountdown
                            deadline={r.correction_deadline}
                          />
                        )
                        : (
                          <p className="text-muted-foreground">
                            Срок исправления:{" "}
                            {new Date(r.correction_deadline).toLocaleString(
                              "ru-RU",
                            )}
                          </p>
                        )}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 border-t pt-3">
                    {r.creator_account_id && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPreview(r)}
                      >
                        Перейти к продукту
                      </Button>
                    )}
                    {incomingReport(r) && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === r.id}
                          onClick={() => void decide(r, "dismissed")}
                        >
                          Отклонить жалобу
                        </Button>
                        {r.status === "pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy === r.id}
                            onClick={() => {
                              setText("");
                              setCorrection(r);
                            }}
                          >
                            🛠️ Запросить исправление (72 часа)
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={busy === r.id}
                          onClick={() => setBlock(r)}
                        >
                          Заблокировать аккаунт
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      <Dialog
        open={!!correction}
        onOpenChange={(open) => {
          if (!open && !busy) setCorrection(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Запросить исправление (72 часа)</DialogTitle>
            <DialogDescription>
              Опишите нарушение и необходимые изменения. Продавец получит
              сообщение от техподдержки и уведомление.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (correction) void decide(correction, "correction_requested");
            }}
          >
            <Textarea
              autoFocus
              required
              maxLength={4000}
              rows={7}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Что нужно исправить?"
            />
            <Button disabled={!!busy || !text.trim()}>Отправить запрос</Button>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!block}
        onOpenChange={(open) => {
          if (!open && !busy) setBlock(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Заблокировать аккаунт {block?.seller_name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Вход и все связанные профили будут заблокированы. Продажи и
              покупки станут недоступны. Сохранённые идентификаторы почты,
              Google, браузера и доступный IP попадут в список блокировки.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!busy}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              disabled={!!busy}
              onClick={(e) => {
                e.preventDefault();
                if (block) void decide(block, "blocked");
              }}
            >
              Заблокировать
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {preview && (
        <ModeratorProductPreview
          reportId={preview.id}
          initialProductId={preview.product_id}
          call={call}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
