import { useState } from "react";
import { Flag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { invokeApi, sessionCreds } from "@/lib/sessionApi";
import { toast } from "sonner";

const REASONS = [
  ["❌", "Продукт не соответствует описанию"],
  ["🔞", "Неприемлемый контент"],
  ["👤", "Выдаёт себя за другого человека"],
  ["", "Другое"],
];
interface Props {
  productId?: string;
  productTitle: string;
  sellerHandle?: string;
  variant?: "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "icon";
  className?: string;
}
export function ReportProductDialog(
  {
    productId,
    productTitle,
    sellerHandle,
    variant = "ghost",
    size = "sm",
    className,
  }: Props,
) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const other = reason === "Другое";
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason || (other && !comment.trim())) return;
    if (!localStorage.getItem("creator_token")) {
      toast.error("Войдите в аккаунт, чтобы подать жалобу");
      return;
    }
    setBusy(true);
    try {
      await invokeApi("support-api", {
        ...sessionCreds(),
        action: sellerHandle ? "report_account" : "report_product",
        product_id: productId,
        seller_handle: sellerHandle,
        reason,
        description: comment.trim(),
      }, 0);
      toast.success("Жалоба отправлена в кабинет модератора");
      setOpen(false);
      setReason("");
      setComment("");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Не удалось отправить жалобу",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={size}
          className={className}
        >
          <Flag className="mr-2 h-4 w-4" />Пожаловаться
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>
              Пожаловаться {sellerHandle ? "на продавца" : "на продукт"}
            </DialogTitle>
            <DialogDescription>{productTitle}</DialogDescription>
          </DialogHeader>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-semibold">
              Причина жалобы
            </legend>
            {REASONS.map(([emoji, text]) => (
              <label
                key={text}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${
                  reason === text
                    ? "border-primary bg-primary/5"
                    : "border-border"
                }`}
              >
                <input
                  type="radio"
                  name="reason"
                  required
                  checked={reason === text}
                  onChange={() => setReason(text)}
                />
                {emoji} {text}
              </label>
            ))}
          </fieldset>
          <div className="space-y-2">
            <label htmlFor="report-comment" className="text-sm font-semibold">
              Комментарии: {other ? "(обязательно)" : "(необязательно)"}
            </label>
            <Textarea
              id="report-comment"
              placeholder="Это поможет решить проблему быстрее."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              required={other}
              maxLength={4000}
              rows={7}
              className="min-h-[180px] resize-y rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Отмена
            </Button>
            <Button disabled={busy || !reason || (other && !comment.trim())}>
              {busy &&
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Отправить
              жалобу
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export default ReportProductDialog;
