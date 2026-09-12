import { useState } from "react";
import { Flag, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { toast } from "sonner";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";

const REPORT_REASONS = [
  "Мошенничество или обман",
  "Нарушение авторских прав",
  "Несоответствие описанию / некачественный контент",
  "Запрещенный или оскорбительный материал",
  "Спам или ввод в заблуждение",
  "Другая причина",
];

interface ReportProductDialogProps {
  productId: string;
  productTitle: string;
  variant?: "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "icon";
  className?: string;
}

export const ReportProductDialog = ({
  productId,
  productTitle,
  variant = "ghost",
  size = "sm",
  className,
}: ReportProductDialogProps) => {
  const { user } = useSimpleAuth();
  const [open, setOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState(REPORT_REASONS[0]);
  const [description, setDescription] = useState("");
  const [reporterContact, setReporterContact] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReason) {
      toast.error("Пожалуйста, выберите причину жалобы");
      return;
    }

    setSubmitting(true);
    try {
      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const resp = await fetch(`${baseUrl}/functions/v1/support-api`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          action: "report_product",
          product_id: productId,
          reason: selectedReason,
          description: description.trim() || undefined,
          reporter_name: user?.name || undefined,
          reporter_contact: reporterContact.trim() || undefined,
          user_id: user?.id || undefined,
        }),
      });

      const data = await resp.json();
      if (!resp.ok || data?.error) {
        throw new Error(data?.error || "Не удалось отправить жалобу");
      }

      toast.success("Жалоба отправлена. Модераторы проверят этот продукт.");
      setOpen(false);
      setDescription("");
      setReporterContact("");
      setSelectedReason(REPORT_REASONS[0]);
    } catch (err: any) {
      console.error("Report error:", err);
      toast.error(err.message || "Ошибка при отправке жалобы");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={size}
          className={className}
          title="Пожаловаться на продукт"
        >
          <Flag className="w-3.5 h-3.5 text-muted-foreground mr-1.5" />
          <span className="text-xs text-muted-foreground hover:text-foreground">
            Пожаловаться
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Пожаловаться на продукт
            </DialogTitle>
            <DialogDescription className="text-xs">
              Если курс или продукт «{productTitle}» нарушает правила или законы,
              сообщите нам.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <label className="text-xs font-semibold text-foreground block">
              Причина жалобы
            </label>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {REPORT_REASONS.map((r) => (
                <label
                  key={r}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                    selectedReason === r
                      ? "border-primary bg-primary/5 font-medium text-foreground"
                      : "border-border hover:bg-muted/40 text-muted-foreground"
                  }`}
                >
                  <input
                    type="radio"
                    name="report_reason"
                    checked={selectedReason === r}
                    onChange={() => setSelectedReason(r)}
                    className="text-primary focus:ring-primary h-3.5 w-3.5"
                  />
                  <span>{r}</span>
                </label>
              ))}
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-semibold text-foreground block">
                Подробности (необязательно)
              </label>
              <Textarea
                placeholder="Опишите подробнее, что не так с продуктом..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground block">
                Контакт для связи (необязательно)
              </label>
              <Input
                placeholder="Номер телефона или email"
                value={reporterContact}
                onChange={(e) => setReporterContact(e.target.value)}
                className="text-xs rounded-xl h-9"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={submitting}
              className="rounded-xl"
            >
              Отмена
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting}
              className="bg-[#FF6B00] hover:bg-[#E86000] text-white rounded-xl"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Отправка...
                </>
              ) : (
                "Отправить жалобу"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ReportProductDialog;
