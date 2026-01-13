import { useState, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  useSchedules, 
  useTimeSlots, 
  useCreateSchedule, 
  useDeleteSchedule,
  useCreateMultipleTimeSlots,
  useDeleteTimeSlot 
} from "@/hooks/useSchedules";
import { useLanguage } from "@/contexts/LanguageContext";
import { Plus, Calendar, Trash2, Loader2, Users, User, Clock } from "lucide-react";
import { toast } from "sonner";
import { format, addDays, parse } from "date-fns";
import { ru } from "date-fns/locale";

interface ProductScheduleManagerProps {
  productId: string;
  productTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

type EventType = "group" | "individual";

const ProductScheduleManager = forwardRef<HTMLDivElement, ProductScheduleManagerProps>(({ productId, productTitle, isOpen, onClose }, ref) => {
  const { t } = useLanguage();
  const { data: schedules = [], isLoading } = useSchedules(productId);
  const createSchedule = useCreateSchedule();
  const deleteSchedule = useDeleteSchedule();
  const createTimeSlots = useCreateMultipleTimeSlots();
  const deleteTimeSlot = useDeleteTimeSlot();
  
  const [isAddingSchedule, setIsAddingSchedule] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [deletingSchedule, setDeletingSchedule] = useState<{ id: string; title: string } | null>(null);
  const [isAddingSlots, setIsAddingSlots] = useState(false);
  
  const [scheduleForm, setScheduleForm] = useState({
    title: "",
    eventType: "individual" as EventType,
    maxParticipants: "10",
  });

  const [slotsForm, setSlotsForm] = useState({
    startDate: format(new Date(), "yyyy-MM-dd"),
    endDate: format(addDays(new Date(), 7), "yyyy-MM-dd"),
    startTime: "09:00",
    endTime: "18:00",
    slotDuration: "60", // minutes
  });

  const selectedSchedule = schedules.find(s => s.id === selectedScheduleId);
  const { data: timeSlots = [], isLoading: slotsLoading } = useTimeSlots(selectedScheduleId || undefined);

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleForm.title) {
      toast.error("Введите название");
      return;
    }

    try {
      await createSchedule.mutateAsync({
        product_id: productId,
        title: scheduleForm.title,
        event_type: scheduleForm.eventType,
        max_participants: scheduleForm.eventType === "group" ? Number(scheduleForm.maxParticipants) : null,
      });
      toast.success("Расписание создано!");
      setIsAddingSchedule(false);
      setScheduleForm({ title: "", eventType: "individual", maxParticipants: "10" });
    } catch (error) {
      toast.error("Ошибка при создании расписания");
    }
  };

  const handleDeleteSchedule = async () => {
    if (!deletingSchedule) return;
    try {
      await deleteSchedule.mutateAsync({ id: deletingSchedule.id, productId });
      toast.success("Расписание удалено!");
      setDeletingSchedule(null);
      if (selectedScheduleId === deletingSchedule.id) {
        setSelectedScheduleId(null);
      }
    } catch (error) {
      toast.error("Ошибка при удалении");
    }
  };

  const handleCreateSlots = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedScheduleId) return;

    const startDate = new Date(slotsForm.startDate);
    const endDate = new Date(slotsForm.endDate);
    const duration = Number(slotsForm.slotDuration);
    
    const slots: { schedule_id: string; date: string; start_time: string; end_time: string; is_available: boolean }[] = [];
    
    let currentDate = startDate;
    while (currentDate <= endDate) {
      const dateStr = format(currentDate, "yyyy-MM-dd");
      let currentTime = parse(slotsForm.startTime, "HH:mm", new Date());
      const dayEndTime = parse(slotsForm.endTime, "HH:mm", new Date());
      
      while (currentTime < dayEndTime) {
        const slotStart = format(currentTime, "HH:mm:ss");
        currentTime = new Date(currentTime.getTime() + duration * 60000);
        if (currentTime > dayEndTime) break;
        const slotEnd = format(currentTime, "HH:mm:ss");
        
        slots.push({
          schedule_id: selectedScheduleId,
          date: dateStr,
          start_time: slotStart,
          end_time: slotEnd,
          is_available: true,
        });
      }
      
      currentDate = addDays(currentDate, 1);
    }

    if (slots.length === 0) {
      toast.error("Нет слотов для создания");
      return;
    }

    try {
      await createTimeSlots.mutateAsync({ slots, scheduleId: selectedScheduleId });
      toast.success(`Создано ${slots.length} слотов!`);
      setIsAddingSlots(false);
    } catch (error) {
      toast.error("Ошибка при создании слотов");
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!selectedScheduleId) return;
    try {
      await deleteTimeSlot.mutateAsync({ id: slotId, scheduleId: selectedScheduleId });
      toast.success("Слот удалён");
    } catch (error) {
      toast.error("Ошибка при удалении");
    }
  };

  // Group slots by date
  const slotsByDate = timeSlots.reduce((acc, slot) => {
    const date = slot.date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(slot);
    return acc;
  }, {} as Record<string, typeof timeSlots>);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Расписание: {productTitle}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Schedules list */}
            {!selectedScheduleId ? (
              <>
                {!isAddingSchedule && (
                  <Button onClick={() => setIsAddingSchedule(true)} variant="outline" className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Создать расписание
                  </Button>
                )}

                {isAddingSchedule && (
                  <Card>
                    <CardContent className="pt-4">
                      <form onSubmit={handleCreateSchedule} className="space-y-4">
                        <div className="space-y-2">
                          <Label>Название *</Label>
                          <Input
                            placeholder="Например: Индивидуальные консультации"
                            value={scheduleForm.title}
                            onChange={(e) => setScheduleForm({ ...scheduleForm, title: e.target.value })}
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Тип записи</Label>
                          <Select
                            value={scheduleForm.eventType}
                            onValueChange={(value: EventType) => setScheduleForm({ ...scheduleForm, eventType: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="individual">
                                <span className="flex items-center gap-2">
                                  <User className="w-4 h-4" />
                                  Индивидуальный
                                </span>
                              </SelectItem>
                              <SelectItem value="group">
                                <span className="flex items-center gap-2">
                                  <Users className="w-4 h-4" />
                                  Групповой
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {scheduleForm.eventType === "group" && (
                          <div className="space-y-2">
                            <Label>Макс. участников</Label>
                            <Input
                              type="number"
                              min="2"
                              value={scheduleForm.maxParticipants}
                              onChange={(e) => setScheduleForm({ ...scheduleForm, maxParticipants: e.target.value })}
                            />
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button type="button" variant="outline" className="flex-1" onClick={() => setIsAddingSchedule(false)}>
                            {t("cancel")}
                          </Button>
                          <Button type="submit" variant="cta" className="flex-1" disabled={createSchedule.isPending}>
                            {createSchedule.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t("create")}
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                )}

                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : schedules.length === 0 && !isAddingSchedule ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>Расписаний пока нет</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {schedules.map((schedule) => (
                      <Card key={schedule.id} className="cursor-pointer hover:border-primary transition-colors" onClick={() => setSelectedScheduleId(schedule.id)}>
                        <CardContent className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              {schedule.event_type === "group" ? <Users className="w-5 h-5 text-primary" /> : <User className="w-5 h-5 text-primary" />}
                            </div>
                            <div>
                              <p className="font-medium">{schedule.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {schedule.event_type === "group" ? `Групповой (до ${schedule.max_participants} чел.)` : "Индивидуальный"}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); setDeletingSchedule({ id: schedule.id, title: schedule.title }); }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            ) : (
              /* Time slots view */
              <>
                <Button variant="ghost" onClick={() => setSelectedScheduleId(null)} className="mb-2">
                  ← Назад к расписаниям
                </Button>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{selectedSchedule?.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedSchedule?.event_type === "group" ? "Групповой" : "Индивидуальный"}
                    </p>
                  </div>
                  <Button onClick={() => setIsAddingSlots(true)} size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Добавить слоты
                  </Button>
                </div>

                {isAddingSlots && (
                  <Card>
                    <CardContent className="pt-4">
                      <form onSubmit={handleCreateSlots} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>С даты</Label>
                            <Input
                              type="date"
                              value={slotsForm.startDate}
                              onChange={(e) => setSlotsForm({ ...slotsForm, startDate: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>По дату</Label>
                            <Input
                              type="date"
                              value={slotsForm.endDate}
                              onChange={(e) => setSlotsForm({ ...slotsForm, endDate: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Начало дня</Label>
                            <Input
                              type="time"
                              value={slotsForm.startTime}
                              onChange={(e) => setSlotsForm({ ...slotsForm, startTime: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Конец дня</Label>
                            <Input
                              type="time"
                              value={slotsForm.endTime}
                              onChange={(e) => setSlotsForm({ ...slotsForm, endTime: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Длит. (мин)</Label>
                            <Select
                              value={slotsForm.slotDuration}
                              onValueChange={(value) => setSlotsForm({ ...slotsForm, slotDuration: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="30">30 мин</SelectItem>
                                <SelectItem value="45">45 мин</SelectItem>
                                <SelectItem value="60">1 час</SelectItem>
                                <SelectItem value="90">1.5 часа</SelectItem>
                                <SelectItem value="120">2 часа</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" className="flex-1" onClick={() => setIsAddingSlots(false)}>
                            {t("cancel")}
                          </Button>
                          <Button type="submit" variant="cta" className="flex-1" disabled={createTimeSlots.isPending}>
                            {createTimeSlots.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Создать слоты"}
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                )}

                {slotsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : Object.keys(slotsByDate).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>Слотов пока нет</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(slotsByDate).sort().map(([date, slots]) => (
                      <div key={date}>
                        <p className="text-sm font-medium text-muted-foreground mb-2">
                          {format(new Date(date), "d MMMM, EEEE", { locale: ru })}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {slots.map((slot) => (
                            <div
                              key={slot.id}
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm ${
                                slot.is_available 
                                  ? "bg-primary/10 text-primary" 
                                  : "bg-muted text-muted-foreground line-through"
                              }`}
                            >
                              <span>{slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}</span>
                              <button
                                onClick={() => handleDeleteSlot(slot.id)}
                                className="ml-1 hover:text-destructive"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete schedule confirmation */}
      <AlertDialog open={!!deletingSchedule} onOpenChange={(open) => { if (!open) setDeletingSchedule(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить расписание?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить "{deletingSchedule?.title}"? Все слоты также будут удалены.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSchedule}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSchedule.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});

ProductScheduleManager.displayName = "ProductScheduleManager";

export default ProductScheduleManager;
