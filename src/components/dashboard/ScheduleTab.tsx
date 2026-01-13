import { useState, useMemo } from "react";
import { useSimplePurchases, useSimpleSchedules } from "@/hooks/useSimplePurchases";
import { useTimeSlots, useUserBookings, useCreateBooking } from "@/hooks/useSchedules";
import { useLanguage } from "@/contexts/LanguageContext";
import { Calendar, Clock, Users, User, Check, Loader2 } from "lucide-react";
import { format, addDays, isSameDay, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "sonner";

const ScheduleTab = () => {
  const { data: purchases, isLoading: purchasesLoading } = useSimplePurchases();
  const { data: schedules, isLoading: schedulesLoading } = useSimpleSchedules();
  const { data: bookings, isLoading: bookingsLoading } = useUserBookings();
  const { t, language } = useLanguage();
  const createBooking = useCreateBooking();
  
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(addDays(new Date(), 1));

  const { data: timeSlots, isLoading: timeSlotsLoading } = useTimeSlots(selectedScheduleId || undefined);

  const days = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i + 1));

  const filteredSlots = useMemo(() => {
    if (!timeSlots) return [];
    return timeSlots.filter((slot) => 
      isSameDay(parseISO(slot.date), selectedDate)
    );
  }, [timeSlots, selectedDate]);

  const handleBookSlot = async (slotId: string) => {
    if (!selectedScheduleId) return;
    
    try {
      await createBooking.mutateAsync({
        timeSlotId: slotId,
        scheduleId: selectedScheduleId,
      });
      toast.success(t("bookingConfirmed"));
    } catch (error) {
      toast.error(t("bookingFailed"));
    }
  };

  const isSlotBooked = (slotId: string) => {
    return bookings?.some((b) => b.time_slot_id === slotId && b.status === "confirmed");
  };

  const isLoading = purchasesLoading || schedulesLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!purchases || purchases.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
        <p className="text-muted-foreground">{t("noPurchasedProducts")}</p>
        <p className="text-sm text-muted-foreground mt-1">
          {t("purchaseForSchedule")}
        </p>
      </div>
    );
  }

  if (!schedules || schedules.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
        <p className="text-muted-foreground">{t("noSchedules")}</p>
        <p className="text-sm text-muted-foreground mt-1">
          {t("noSchedulesEnabled")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">{t("scheduleSessions")}</h2>

      {/* Schedule Type Selection */}
      <div className="grid grid-cols-2 gap-3">
        {schedules.map((schedule) => (
          <button
            key={schedule.id}
            onClick={() => setSelectedScheduleId(schedule.id)}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              selectedScheduleId === schedule.id
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {schedule.event_type === "group" ? (
                <Users className="w-5 h-5 text-primary" />
              ) : (
                <User className="w-5 h-5 text-primary" />
              )}
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {schedule.event_type === "group" ? t("group") : t("individual")}
              </span>
            </div>
            <h3 className="font-medium text-foreground text-sm">{schedule.title}</h3>
            {schedule.max_participants && (
              <p className="text-xs text-muted-foreground mt-1">
                {t("upToParticipants").replace("{count}", String(schedule.max_participants))}
              </p>
            )}
          </button>
        ))}
      </div>

      {selectedScheduleId && (
        <>
          {/* Date Selection */}
          <div className="space-y-3">
            <h3 className="font-medium text-foreground">{t("selectDate")}</h3>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4">
              {days.map((day) => (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={`flex-shrink-0 p-3 rounded-xl text-center min-w-[72px] transition-all ${
                    isSameDay(day, selectedDate)
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border hover:border-primary/50"
                  }`}
                >
                  <div className="text-xs opacity-80">{format(day, "EEE", { locale: ru })}</div>
                  <div className="text-lg font-bold">{format(day, "d")}</div>
                  <div className="text-xs opacity-80">{format(day, "MMM", { locale: ru })}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Time Slots */}
          <div className="space-y-3">
            <h3 className="font-medium text-foreground">{t("availableTimes")}</h3>
            {timeSlotsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filteredSlots.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {filteredSlots.map((slot) => {
                  const booked = isSlotBooked(slot.id);
                  const available = slot.is_available && !booked;
                  
                  return (
                    <button
                      key={slot.id}
                      onClick={() => available && handleBookSlot(slot.id)}
                      disabled={!available || createBooking.isPending}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        booked
                          ? "bg-success/10 border-success text-success"
                          : available
                          ? "border-border hover:border-primary bg-card"
                          : "border-border bg-muted/50 text-muted-foreground opacity-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span className="font-medium">
                          {slot.start_time.slice(0, 5)}
                        </span>
                        {booked && <Check className="w-4 h-4 ml-auto" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                {t("noSlotsAvailable")}
              </p>
            )}
          </div>
        </>
      )}

      {!selectedScheduleId && (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-muted-foreground">{t("selectSessionType")}</p>
        </div>
      )}
    </div>
  );
};

export default ScheduleTab;
