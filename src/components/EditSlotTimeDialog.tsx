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
  onConfirm: (data: { newStartTime: string; newEndTime: string }) => void;
  slot: { start_time: string; end_time: string } | null;
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

  const addMinutes = (time: string, mins: number) => {
    const [h, m] = time.split(":").map(Number);
    const total = h * 60 + m + mins;
    const newH = Math.floor(total / 60) % 24;
    const newM = total % 60;
    return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
  };

  useEffect(() => {
    if (isOpen && slot) {
      setNewStartTime(addMinutes(slot.start_time.slice(0, 5), 30));
      setNewEndTime(addMinutes(slot.end_time.slice(0, 5), 30));
    }
  }, [isOpen, slot]);

  const handleOpen = (open: boolean) => {
    if (!open) handleClose();
  };

  const handleStartTimeChange = (value: string) => {
    setNewStartTime(value);
    setNewEndTime(addMinutes(value, 30));
  };

  const handleClose = () => {
    setNewStartTime("");
    setNewEndTime("");
    onClose();
  };

  const handleConfirm = () => {
    onConfirm({
      newStartTime: newStartTime + ":00",
      newEndTime: newEndTime + ":00",
    });
  };

  const isValid = newStartTime && newEndTime;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {language === "ru" ? "Изменить время" : "Уақытты өзгерту"}
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
              {language === "ru" ? "Начало (24ч)" : "Басталуы (24с)"}
            </Label>
            <Input
              type="time"
              value={newStartTime}
              onChange={(e) => handleStartTimeChange(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>
              {language === "ru" ? "Конец (24ч)" : "Аяқталуы (24с)"}
            </Label>
            <Input
              type="time"
              value={newEndTime}
              onChange={(e) => setNewEndTime(e.target.value)}
            />
          </div>
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
