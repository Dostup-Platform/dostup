import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { Booking, Schedule, TimeSlot } from "@/hooks/useSchedule";
import { useCreateRescheduleRequest } from "@/hooks/useReschedule";

const fmtDate = (d: string) => {
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
};
const fmtTime = (t: string) => t.slice(0, 5);

const REASON_OPTIONS = [
  "Не могу в это время",
  "Личные обстоятельства",
  "Болезнь",
  "Другое",
];

export interface RescheduleLessonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: Booking;
  currentSlot: TimeSlot;
  schedule: Schedule;
  productId: string;
  productTitle: string;
  userId: string;
  slots: TimeSlot[];
  schedules: Schedule[];
  bookingsCountBySlot: Map<string, number>;
}

export function RescheduleLessonDialog({
  open,
  onOpenChange,
  booking,
  currentSlot,
  schedule,
  productId,
  productTitle,
  userId,
  slots,
  schedules,
  bookingsCountBySlot,
}: RescheduleLessonDialogProps) {
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const createRequest = useCreateRescheduleRequest();

  const scheduleMap = new Map(schedules.map((s) => [s.id, s]));

  const alternativeSlots = slots
    .filter((s) => {
      if (s.id === currentSlot.id) return false;
      if (s.schedule_id !== booking.schedule_id) return false;
      if (!s.is_available) return false;
      const dt = new Date(`${s.date}T${s.start_time}`);
      if (dt.getTime() <= Date.now()) return false;
      const sch = scheduleMap.get(s.schedule_id);
      const cap =
        s.max_participants ??
        sch?.max_participants ??
        (sch?.event_type === "individual" ? 1 : null);
      const count = bookingsCountBySlot.get(s.id) ?? 0;
      if (cap !== null && count >= cap) return false;
      return true;
    })
    .sort((a, b) => {
      const da = `${a.date}T${a.start_time}`;
      const db = `${b.date}T${b.start_time}`;
      return da.localeCompare(db);
    });

  const resetForm = () => {
    setSelectedSlotId(null);
    setReasons([]);
    setComment("");
  };

  const toggleReason = (reason: string, checked: boolean) => {
    setReasons((prev) =>
      checked ? [...prev, reason] : prev.filter((r) => r !== reason),
    );
  };

  const handleSubmit = async () => {
    const newSlot = slots.find((s) => s.id === selectedSlotId);
    if (!newSlot) return;
    try {
      await createRequest.mutateAsync({
        booking,
        currentSlot,
        newSlot,
        schedule,
        productId,
        productTitle,
        userId,
        reasons,
        comment,
      });
      resetForm();
      onOpenChange(false);
      toast.success("Запрос на перенос отправлен");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Перенести урок</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border p-3 text-sm bg-muted/40">
            <div className="text-muted-foreground text-xs mb-1">Текущее время</div>
            <div className="font-medium">
              {fmtDate(currentSlot.date)} · {fmtTime(currentSlot.start_time)}–
              {fmtTime(currentSlot.end_time)}
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Новый слот</Label>
            {alternativeSlots.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Нет доступных слотов для переноса в этом расписании.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {alternativeSlots.map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => setSelectedSlotId(slot.id)}
                    className={`w-full text-left p-3 border rounded-lg text-sm transition-colors ${
                      selectedSlotId === slot.id
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="font-medium">
                      {fmtDate(slot.date)} · {fmtTime(slot.start_time)}–
                      {fmtTime(slot.end_time)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label className="mb-2 block">Причина (опционально)</Label>
            <div className="space-y-2">
              {REASON_OPTIONS.map((reason) => (
                <label key={reason} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={reasons.includes(reason)}
                    onCheckedChange={(v) => toggleReason(reason, v === true)}
                  />
                  {reason}
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="reschedule-comment">Комментарий</Label>
            <Textarea
              id="reschedule-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Дополнительная информация для преподавателя"
              rows={3}
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            disabled={!selectedSlotId || createRequest.isPending}
            onClick={handleSubmit}
          >
            {createRequest.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            Отправить запрос
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PendingRescheduleBadge() {
  return <Badge variant="secondary">Ожидает переноса</Badge>;
}
