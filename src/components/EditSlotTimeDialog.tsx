import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface EditSlotTimeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: { newStartTime: string; newEndTime: string; maxParticipants?: number }) => void;
  slot: { start_time: string; end_time: string; max_participants?: number | null } | null;
  isPending?: boolean;
}

const EditSlotTimeDialog = ({
  isOpen,
  onClose,
  onConfirm,
  slot,
  isPending = false,
}: EditSlotTimeDialogProps) => {
  const { language } = useLanguage();
  const [newStartTime, setNewStartTime] = useState("");
  const [newEndTime, setNewEndTime] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("1");

  const addMinutes = (time: string, mins: number) => {
    const [h, m] = time.split(":").map(Number);
    const total = h * 60 + m + mins;
    const newH = Math.floor(total / 60) % 24;
    const newM = total % 60;
    return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
  };

  const getSlotDuration = () => {
    if (!slot) return 60;
    const [sh, sm] = slot.start_time.slice(0, 5).split(":").map(Number);
    const [eh, em] = slot.end_time.slice(0, 5).split(":").map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
  };

  useEffect(() => {
    if (isOpen && slot) {
      const duration = getSlotDuration();
      setNewStartTime(addMinutes(slot.start_time.slice(0, 5), duration));
      setNewEndTime(addMinutes(slot.end_time.slice(0, 5), duration));
      setMaxParticipants(String(slot.max_participants ?? 1));
    }
  }, [isOpen, slot]);

  const handleStartTimeChange = (value: string) => {
    setNewStartTime(value);
    const duration = getSlotDuration();
    setNewEndTime(addMinutes(value, duration));
  };

  const handleOpen = (open: boolean) => {
    if (!open) handleClose();
  };

  const handleClose = () => {
    setNewStartTime("");
    setNewEndTime("");
    setMaxParticipants("1");
    onClose();
  };

  const handleConfirm = () => {
    const participants = Math.max(1, parseInt(maxParticipants, 10) || 1);
    onConfirm({
      newStartTime: newStartTime + ":00",
      newEndTime: newEndTime + ":00",
      maxParticipants: participants,
    });
  };

  const isValid = newStartTime && newEndTime;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {language === "ru" ? "Редактировать слот" : "Слотты өңдеу"}
          </DialogTitle>
          <DialogDescription>
            {language === "ru"
              ? `Текущее время: ${slot?.start_time.slice(0, 5)} - ${slot?.end_time.slice(0, 5)}`
              : `Ағымдағы уақыт: ${slot?.start_time.slice(0, 5)} - ${slot?.end_time.slice(0, 5)}`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="space-y-2">
            <Label>
              {language === "ru" ? "Начало" : "Басталуы"}
            </Label>
            <Input
              type="time"
              value={newStartTime}
              onChange={(e) => handleStartTimeChange(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>
              {language === "ru" ? "Конец" : "Аяқталуы"}
            </Label>
            <Input
              type="time"
              value={newEndTime}
              onChange={(e) => setNewEndTime(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2 py-2">
          <Label>
            {language === "ru" ? "Количество участников" : "Қатысушылар саны"}
          </Label>
          <Input
            type="number"
            min="1"
            value={maxParticipants}
            onChange={(e) => {
              const val = e.target.value.replace(/^0+(?=\d)/, "");
              setMaxParticipants(val);
            }}
            placeholder="1"
          />
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            {language === "ru" ? "Отмена" : "Бас тарту"}
          </Button>
          <Button onClick={handleConfirm} disabled={isPending || !isValid}>
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            {language === "ru" ? "Сохранить" : "Сақтау"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditSlotTimeDialog;
