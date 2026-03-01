import { useState, useMemo, useEffect } from "react";
import { useSimplePurchases, useSimpleSchedules, useSimpleTimeSlots, useSimpleBookings, useCreateSimpleBooking, useCancelSimpleBooking, useAllBookingsForSchedule } from "@/hooks/useSimplePurchases";
import { useLanguage } from "@/contexts/LanguageContext";
import { Calendar, Clock, Users, User, Check, Loader2, X, CalendarCheck, GraduationCap, Link as LinkIcon, Copy } from "lucide-react";
import { format, addDays, isSameDay, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import CancellationReasonDialog from "@/components/CancellationReasonDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Teacher {
  id: string;
  name: string;
}

const ScheduleTab = () => {
  const { data: purchases, isLoading: purchasesLoading } = useSimplePurchases();
  const { data: schedules, isLoading: schedulesLoading } = useSimpleSchedules();
  const { data: bookings, isLoading: bookingsLoading } = useSimpleBookings();
  const { t } = useLanguage();
  const createBooking = useCreateSimpleBooking();
  const cancelBooking = useCancelSimpleBooking();
  
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [bookingToCancel, setBookingToCancel] = useState<string | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [canChooseTeacher, setCanChooseTeacher] = useState(false);

  const { data: timeSlots, isLoading: timeSlotsLoading } = useSimpleTimeSlots(selectedScheduleId || undefined);
  const { data: allBookingsForSchedule } = useAllBookingsForSchedule(selectedScheduleId || undefined);
  
  // Получить текущий выбранный schedule для проверки event_type
  const selectedSchedule = schedules?.find(s => s.id === selectedScheduleId);

  // Загрузить учителей для продуктов с can_choose_teacher
  useEffect(() => {
    const loadTeachers = async () => {
      if (!purchases || purchases.length === 0) return;
      
      console.log("ScheduleTab: Loading teachers for purchases:", purchases);
      
      // Проверяем, есть ли покупки с can_choose_teacher
      const purchaseWithChoice = purchases.find(p => p.can_choose_teacher);
      setCanChooseTeacher(!!purchaseWithChoice);
      
      if (!purchaseWithChoice) {
        // Если нельзя выбирать учителя, используем assigned_teacher_id
        const assignedTeacherId = purchases.find(p => p.assigned_teacher_id)?.assigned_teacher_id;
        console.log("ScheduleTab: No choice mode, assigned_teacher_id:", assignedTeacherId);
        if (assignedTeacherId) {
          setSelectedTeacherId(assignedTeacherId);
        }
        return;
      }
      
      // Загружаем всех учителей для продуктов
      const productIds = purchases.map(p => p.product_id);
      const { data: teacherRecords } = await supabase
        .from("product_teachers")
        .select("id, teacher_name, product_id")
        .in("product_id", productIds);
      
      if (teacherRecords && teacherRecords.length > 0) {
        // Ищем simple_users с ролью teacher по имени
        const teacherNames = teacherRecords.map(t => t.teacher_name);
        const { data: teacherUsers } = await supabase
          .from("simple_users")
          .select("id, name")
          .in("name", teacherNames)
          .eq("role", "teacher");
        
        if (teacherUsers) {
          console.log("ScheduleTab: Found teachers:", teacherUsers);
          setTeachers(teacherUsers.map(u => ({ id: u.id, name: u.name })));
        }
      }
    };
    
    loadTeachers();
  }, [purchases]);

  // Фильтруем schedules по выбранному учителю
  const filteredSchedules = useMemo(() => {
    if (!schedules) return [];
    
    console.log("ScheduleTab: Filtering schedules. selectedTeacherId:", selectedTeacherId, "canChooseTeacher:", canChooseTeacher);
    console.log("ScheduleTab: All schedules:", schedules);
    
    // Если назначен конкретный учитель - показываем только его расписания
    if (selectedTeacherId) {
      const filtered = schedules.filter(s => s.teacher_id === selectedTeacherId);
      console.log("ScheduleTab: Filtered by assigned teacher:", filtered);
      return filtered;
    }
    
    // Если можно выбирать учителя - показываем ВСЕ расписания (всех учителей)
    if (canChooseTeacher) {
      console.log("ScheduleTab: canChooseTeacher=true, showing all teacher schedules:", schedules);
      return schedules;
    }
    
    // Если нельзя выбирать и нет назначенного учителя - сначала ищем расписания автора (без teacher_id)
    const authorSchedules = schedules.filter(s => !s.teacher_id);
    console.log("ScheduleTab: Author schedules (no teacher_id):", authorSchedules);
    
    // Если расписаний автора нет, но есть расписания учителей — показываем ВСЕ расписания
    // (это случай когда автор создал ссылку без параметра учителя, но расписания ведут учителя)
    if (authorSchedules.length === 0 && schedules.length > 0) {
      console.log("ScheduleTab: No author schedules found, showing all schedules as fallback");
      return schedules;
    }
    
    return authorSchedules;
  }, [schedules, selectedTeacherId, canChooseTeacher]);

  // Показывать 7 дней начиная с сегодня (i начинается с 0)
  const days = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i));

  const filteredSlots = useMemo(() => {
    if (!timeSlots) return [];
    return timeSlots.filter((slot) => 
      isSameDay(parseISO(slot.date), selectedDate)
    );
  }, [timeSlots, selectedDate]);

  // Получить количество бронирований для слота
  const getBookingsCountForSlot = (slotId: string) => {
    return allBookingsForSchedule?.filter(b => b.time_slot_id === slotId).length || 0;
  };

  // Проверить, полностью ли занят слот
  const isSlotFullyBooked = (slotId: string) => {
    const bookingsCount = getBookingsCountForSlot(slotId);
    if (bookingsCount === 0) return false;
    
    if (!selectedSchedule) return bookingsCount > 0;
    
    if (selectedSchedule.event_type === "individual") {
      return bookingsCount > 0;
    }
    
    // Для групповых - проверяем достигнут ли max_participants
    const maxParticipants = selectedSchedule.max_participants || 1;
    return bookingsCount >= maxParticipants;
  };

  // Получить статус дня: "free" | "partial" | "full"
  const getDayStatus = (date: Date): "free" | "partial" | "full" => {
    if (!timeSlots) return "free";
    
    const daySlots = timeSlots.filter(slot => isSameDay(parseISO(slot.date), date));
    if (daySlots.length === 0) return "free";
    
    const fullyBookedCount = daySlots.filter(slot => isSlotFullyBooked(slot.id)).length;
    const partiallyBookedCount = daySlots.filter(slot => {
      const bookingsCount = getBookingsCountForSlot(slot.id);
      return bookingsCount > 0 && !isSlotFullyBooked(slot.id);
    }).length;
    
    if (fullyBookedCount === daySlots.length) return "full";
    if (fullyBookedCount > 0 || partiallyBookedCount > 0) return "partial";
    return "free";
  };

  // Получить статус слота: "free" | "partial" | "full"
  const getSlotStatus = (slotId: string): "free" | "partial" | "full" => {
    const bookingsCount = getBookingsCountForSlot(slotId);
    if (bookingsCount === 0) return "free";
    if (isSlotFullyBooked(slotId)) return "full";
    return "partial";
  };

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

  const handleCancelBooking = async (reasons: string[], comment: string) => {
    if (!bookingToCancel) return;
    try {
      await cancelBooking.mutateAsync({ 
        bookingId: bookingToCancel,
        reasons,
        comment 
      });
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
                className="p-4 rounded-xl border border-green-500/30 bg-green-500/5"
              >
                <div className="flex items-center justify-between">
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
                {/* Lesson link if available */}
                {booking.time_slot?.lesson_link && (
                  <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 text-sm font-medium">
                        <LinkIcon className="w-4 h-4" />
                        {t("lessonLink")}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900"
                        onClick={() => {
                          navigator.clipboard.writeText(booking.time_slot.lesson_link!);
                          toast.success(t("linkCopied"));
                        }}
                      >
                        <Copy className="w-3.5 h-3.5 mr-1" />
                        {t("copy")}
                      </Button>
                    </div>
                    <a 
                      href={booking.time_slot.lesson_link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline text-sm break-all"
                    >
                      {booking.time_slot.lesson_link}
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="text-lg font-semibold text-foreground">{t("scheduleSessions")}</h2>

      {/* Выбор учителя - если можно выбирать */}
      {canChooseTeacher && teachers.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <GraduationCap className="w-4 h-4" />
            <span>{t("selectTeacher")}</span>
          </div>
          <Select
            value={selectedTeacherId || "all"}
            onValueChange={(value) => setSelectedTeacherId(value === "all" ? null : value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("selectTeacher")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allTeachers")}</SelectItem>
              {teachers.map((teacher) => (
                <SelectItem key={teacher.id} value={teacher.id}>
                  {teacher.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {!filteredSchedules || filteredSchedules.length === 0 ? (
        <div className="text-center py-8">
          <Calendar className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-muted-foreground">{t("noSchedules")}</p>
          <p className="text-sm text-muted-foreground mt-1">{t("noSchedulesEnabled")}</p>
        </div>
      ) : (
        <>
          {/* Schedule Type Selection - разделяем на групповые и индивидуальные */}
          {(() => {
            const groupSchedules = filteredSchedules.filter(s => s.event_type === "group");
            const individualSchedules = filteredSchedules.filter(s => s.event_type === "individual");
            
            return (
              <div className="space-y-4">
                {/* Групповые занятия */}
                {groupSchedules.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span>{t("group")}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {groupSchedules.map((schedule) => (
                        <button
                          key={schedule.id}
                          onClick={() => setSelectedScheduleId(schedule.id)}
                          className={`p-4 rounded-xl border-2 text-left transition-all ${
                            selectedScheduleId === schedule.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <h3 className="font-medium text-foreground text-sm">{schedule.title}</h3>
                          {schedule.max_participants && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {t("upToParticipants").replace("{count}", String(schedule.max_participants))}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Индивидуальные занятия */}
                {individualSchedules.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="w-4 h-4" />
                      <span>{t("individual")}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {individualSchedules.map((schedule) => (
                        <button
                          key={schedule.id}
                          onClick={() => setSelectedScheduleId(schedule.id)}
                          className={`p-4 rounded-xl border-2 text-left transition-all ${
                            selectedScheduleId === schedule.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <h3 className="font-medium text-foreground text-sm">{schedule.title}</h3>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {selectedScheduleId && (
            <>
              {/* Date Selection */}
              <div className="space-y-3">
                <h3 className="font-medium text-foreground">{t("selectDate")}</h3>
                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4">
                  {days.map((day) => {
                    const dayHasSlots = timeSlots?.some(slot => isSameDay(parseISO(slot.date), day));
                    const dayStatus = getDayStatus(day);
                    
                    // Цвета точки: красный - все свободны, оранжевый - частично, зеленый - все заняты
                    const getDotColor = () => {
                      switch (dayStatus) {
                        case "full": return "bg-green-500";
                        case "partial": return "bg-orange-500";
                        case "free": return "bg-red-500";
                      }
                    };
                    
                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => setSelectedDate(day)}
                        className={`flex-shrink-0 p-3 rounded-xl text-center min-w-[72px] transition-all relative ${
                          isSameDay(day, selectedDate)
                            ? "bg-primary text-primary-foreground"
                            : "bg-card border border-border hover:border-primary/50"
                        }`}
                      >
                        {dayHasSlots && (
                          <span className={`absolute top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full ${getDotColor()}`} />
                        )}
                        <div className="text-xs opacity-80 mt-2">
                          {format(day, "EEE", { locale: ru })}
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
                      const slotStatus = getSlotStatus(slot.id);
                      
                      // Для индивидуальных сессий - слот недоступен если занят кем-то
                      const isTaken = isIndividual && takenByOther;
                      // Для групповых - слот недоступен только если полностью заполнен
                      const isGroupFull = !isIndividual && slotStatus === "full" && !bookedByMe;
                      const available = slot.is_available && !bookedByMe && !isTaken && !isGroupFull;
                      
                      // Цвета слота
                      const getSlotStyles = () => {
                        if (bookedByMe) return "bg-green-500/10 border-green-500 text-green-600";
                        if (isTaken || isGroupFull) return "bg-red-500/10 border-red-300 text-red-500";
                        
                        // Для доступных групповых слотов показать оранжевый если частично заняты
                        if (!isIndividual && slotStatus === "partial") {
                          return "border-orange-300 bg-orange-50 hover:border-orange-400";
                        }
                        
                        return "border-border hover:border-primary bg-card";
                      };
                      
                      const maxParticipants = selectedSchedule?.max_participants || 1;
                      const bookingsCount = getBookingsCountForSlot(slot.id);
                      
                      return (
                        <button
                          key={slot.id}
                          onClick={() => available && handleBookSlot(slot.id)}
                          disabled={!available || createBooking.isPending}
                          className={`p-4 rounded-xl border text-left transition-all ${getSlotStyles()} ${!available && !bookedByMe ? 'opacity-50' : ''}`}
                        >
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span className="font-medium">
                              {slot.start_time.slice(0, 5)}-{slot.end_time.slice(0, 5)}
                            </span>
                            {bookedByMe && <Check className="w-4 h-4 ml-auto" />}
                            {isTaken && <span className="text-xs ml-auto">{t("slotTaken")}</span>}
                            {isGroupFull && !bookedByMe && <span className="text-xs ml-auto">{t("slotTaken")}</span>}
                            {!isIndividual && !bookedByMe && !isGroupFull && (
                              <span className="text-xs ml-auto text-muted-foreground">
                                {bookingsCount}/{maxParticipants}
                              </span>
                            )}
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

        </>
      )}

      {/* Confirm Cancel Dialog with Reasons */}
      <CancellationReasonDialog
        isOpen={!!bookingToCancel}
        onClose={() => setBookingToCancel(null)}
        onConfirm={handleCancelBooking}
        isPending={cancelBooking.isPending}
      />
    </div>
  );
};

export default ScheduleTab;
