import { useState, useMemo } from "react";
import { useSimplePurchases, useSimpleSchedules, useSimpleTimeSlots, useSimpleBookings, useCreateSimpleBooking, useCancelSimpleBooking, useAllBookingsForSchedule } from "@/hooks/useSimplePurchases";
import { useLanguage } from "@/contexts/LanguageContext";
import { Calendar, Clock, Users, User, Check, Loader2, X, CalendarCheck } from "lucide-react";
import { format, addDays, isSameDay, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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

const ScheduleTab = () => {
  const { data: purchases, isLoading: purchasesLoading } = useSimplePurchases();
  const { data: schedules, isLoading: schedulesLoading } = useSimpleSchedules();
  const { data: bookings, isLoading: bookingsLoading } = useSimpleBookings();
  const { t } = useLanguage();
  const createBooking = useCreateSimpleBooking();
  const cancelBooking = useCancelSimpleBooking();
  
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date()); // Начинать с сегодня
  const [bookingToCancel, setBookingToCancel] = useState<string | null>(null);

  const { data: timeSlots, isLoading: timeSlotsLoading } = useSimpleTimeSlots(selectedScheduleId || undefined);
  const { data: allBookingsForSchedule } = useAllBookingsForSchedule(selectedScheduleId || undefined);
  
  // Получить текущий выбранный schedule для проверки event_type
  const selectedSchedule = schedules?.find(s => s.id === selectedScheduleId);

  // Показывать 7 дней начиная с сегодня (i начинается с 0)
  const days = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i));

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

  const handleCancelBooking = async () => {
    if (!bookingToCancel) return;
    try {
      await cancelBooking.mutateAsync(bookingToCancel);
      toast.success(t("bookingCancelled"));
    } catch (error) {
      toast.error(t("cancelFailed"));
    } finally {
      setBookingToCancel(null);
    }
  };

  // Проверить, забронирован ли слот текущим пользователем
  const isSlotBookedByMe = (slotId: string) => {
    return bookings?.some((b) => b.time_slot_id === slotId && b.status === "confirmed");
  };

  // Проверить, занят ли слот другим пользователем (для индивидуальных сессий)
  const isSlotTakenByOther = (slotId: string) => {
    const myBooking = bookings?.find(b => b.time_slot_id === slotId);
    const anyBooking = allBookingsForSchedule?.find(b => b.time_slot_id === slotId);
    // Слот занят другим, если есть бронирование, но не моё
    return !!anyBooking && !myBooking;
  };

  const isLoading = purchasesLoading || schedulesLoading || bookingsLoading;

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

  // Фильтруем будущие бронирования (включая сегодня)
  const upcomingBookings = bookings?.filter(b => {
    if (!b.time_slot?.date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const slotDate = parseISO(b.time_slot.date);
    slotDate.setHours(0, 0, 0, 0);
    return slotDate >= today;
  }) || [];

  return (
    <div className="space-y-6">
      {/* Мои записи */}
      {upcomingBookings.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-primary" />
            {t("myBookings")}
          </h2>
          <div className="space-y-2">
            {upcomingBookings.map((booking) => (
              <div
                key={booking.id}
                className="p-4 rounded-xl border border-green-500/30 bg-green-500/5 flex items-center justify-between"
              >
                <div className="flex-1">
                  <div className="font-medium text-foreground">
                    {booking.product?.title || booking.schedule?.title}
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {booking.time_slot?.date && format(parseISO(booking.time_slot.date), "d MMM", { locale: ru })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {booking.time_slot?.start_time?.slice(0, 5)}-{booking.time_slot?.end_time?.slice(0, 5)}
                    </span>
                    <span className="flex items-center gap-1">
                      {booking.schedule?.event_type === "group" ? (
                        <Users className="w-3.5 h-3.5" />
                      ) : (
                        <User className="w-3.5 h-3.5" />
                      )}
                      {booking.schedule?.event_type === "group" ? t("group") : t("individual")}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setBookingToCancel(booking.id)}
                  disabled={cancelBooking.isPending}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="text-lg font-semibold text-foreground">{t("scheduleSessions")}</h2>

      {!schedules || schedules.length === 0 ? (
        <div className="text-center py-8">
          <Calendar className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-muted-foreground">{t("noSchedules")}</p>
          <p className="text-sm text-muted-foreground mt-1">{t("noSchedulesEnabled")}</p>
        </div>
      ) : (
        <>
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
                  {days.map((day) => {
                    const dayHasSlots = timeSlots?.some(slot => isSameDay(parseISO(slot.date), day));
                    
                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => setSelectedDate(day)}
                        className={`flex-shrink-0 p-3 rounded-xl text-center min-w-[72px] transition-all ${
                          isSameDay(day, selectedDate)
                            ? "bg-primary text-primary-foreground"
                            : "bg-card border border-border hover:border-primary/50"
                        }`}
                      >
                        <div className="text-xs opacity-80 flex items-center justify-center gap-1">
                          {format(day, "EEE", { locale: ru })}
                          {dayHasSlots && (
                            <span className={`w-1.5 h-1.5 rounded-full ${isSameDay(day, selectedDate) ? "bg-primary-foreground" : "bg-primary"}`} />
                          )}
                        </div>
                        <div className="text-lg font-bold">{format(day, "d")}</div>
                        <div className="text-xs opacity-80">{format(day, "MMM", { locale: ru })}</div>
                      </button>
                    );
                  })}
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
                      const bookedByMe = isSlotBookedByMe(slot.id);
                      const takenByOther = isSlotTakenByOther(slot.id);
                      const isIndividual = selectedSchedule?.event_type === "individual";
                      // Для индивидуальных сессий - слот недоступен если занят кем-то
                      const isTaken = isIndividual && takenByOther;
                      const available = slot.is_available && !bookedByMe && !isTaken;
                      
                      return (
                        <button
                          key={slot.id}
                          onClick={() => available && handleBookSlot(slot.id)}
                          disabled={!available || createBooking.isPending}
                          className={`p-4 rounded-xl border text-left transition-all ${
                            bookedByMe
                              ? "bg-green-500/10 border-green-500 text-green-600"
                              : isTaken
                              ? "bg-red-500/10 border-red-300 text-red-500"
                              : available
                              ? "border-border hover:border-primary bg-card"
                              : "border-border bg-muted/50 text-muted-foreground opacity-50"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span className="font-medium">
                              {slot.start_time.slice(0, 5)}-{slot.end_time.slice(0, 5)}
                            </span>
                            {bookedByMe && <Check className="w-4 h-4 ml-auto" />}
                            {isTaken && <span className="text-xs ml-auto">{t("slotTaken")}</span>}
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
            <div className="text-center py-8">
              <Calendar className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-muted-foreground">{t("selectSessionType")}</p>
            </div>
          )}
        </>
      )}

      {/* Confirm Cancel Dialog */}
      <AlertDialog open={!!bookingToCancel} onOpenChange={(open) => !open && setBookingToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmCancelBookingStudent")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirmCancelBookingStudentDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("no")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelBooking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("yes")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ScheduleTab;
