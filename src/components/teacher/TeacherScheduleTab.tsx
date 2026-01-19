import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, ChevronLeft, ChevronRight, Plus, Trash2, Users, User, Clock, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, addDays, startOfWeek, parse } from "date-fns";
import { ru } from "date-fns/locale";
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

type EventType = "group" | "individual";

interface TeacherScheduleTabProps {
  teacherName: string;
  productIds: string[];
}

interface Schedule {
  id: string;
  product_id: string;
  title: string;
  event_type: EventType;
  max_participants: number | null;
  teacher_id: string | null;
  product?: { title: string };
}

interface TimeSlot {
  id: string;
  schedule_id: string;
  date: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

interface Booking {
  id: string;
  time_slot_id: string;
  simple_user_id: string;
  user?: { name: string };
}

const TeacherScheduleTab = ({ teacherName, productIds }: TeacherScheduleTabProps) => {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();

  const [scheduleType, setScheduleType] = useState<EventType>("individual");
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [isAddingSchedule, setIsAddingSchedule] = useState(false);
  const [isAddingSlots, setIsAddingSlots] = useState(false);
  const [selectedScheduleForSlots, setSelectedScheduleForSlots] = useState<Schedule | null>(null);
  const [deletingSchedule, setDeletingSchedule] = useState<Schedule | null>(null);
  const [cancelingBooking, setCancelingBooking] = useState<Booking | null>(null);
  const [deletingSlot, setDeletingSlot] = useState<TimeSlot | null>(null);
  const [teacherId, setTeacherId] = useState<string | null>(null);

  const [scheduleForm, setScheduleForm] = useState({
    title: "",
    productId: "",
    maxParticipants: "10",
  });

  const [slotsForm, setSlotsForm] = useState({
    startDate: format(new Date(), "yyyy-MM-dd"),
    endDate: format(addDays(new Date(), 7), "yyyy-MM-dd"),
    startTime: "09:00",
    endTime: "18:00",
    slotDuration: "60",
    breakDuration: "0",
  });

  // Get or create teacher's user ID
  useEffect(() => {
    const getOrCreateTeacherId = async () => {
      // First try to find existing user by name
      const { data: existingUser } = await supabase
        .from("simple_users")
        .select("id")
        .eq("name", teacherName)
        .maybeSingle();
      
      if (existingUser) {
        setTeacherId(existingUser.id);
        return;
      }
      
      // If not found, create a new simple_users entry for this teacher
      const { data: newUser, error } = await supabase
        .from("simple_users")
        .insert({
          name: teacherName,
          phone: `teacher_${Date.now()}`,
          role: "teacher",
        })
        .select("id")
        .single();
      
      if (!error && newUser) {
        setTeacherId(newUser.id);
      }
    };
    getOrCreateTeacherId();
  }, [teacherName]);

  // Fetch products info
  const { data: products = [] } = useQuery({
    queryKey: ["teacher-products-info", productIds],
    queryFn: async () => {
      if (!productIds.length) return [];
      const { data, error } = await supabase
        .from("products")
        .select("id, title")
        .in("id", productIds);
      if (error) throw error;
      return data || [];
    },
    enabled: productIds.length > 0,
  });

  // Fetch teacher's schedules only
  const { data: schedules = [], isLoading: schedulesLoading } = useQuery({
    queryKey: ["teacher-schedules-list", teacherId, productIds],
    queryFn: async () => {
      if (!teacherId || !productIds.length) return [];
      const { data, error } = await supabase
        .from("schedules")
        .select("*, product:products(title)")
        .in("product_id", productIds)
        .eq("teacher_id", teacherId);
      if (error) throw error;
      return data as Schedule[];
    },
    enabled: !!teacherId && productIds.length > 0,
  });

  const filteredSchedules = useMemo(() => 
    schedules.filter(s => s.event_type === scheduleType),
    [schedules, scheduleType]
  );

  const scheduleIds = useMemo(() => filteredSchedules.map(s => s.id), [filteredSchedules]);

  // Fetch time slots for the current week
  const weekEnd = addDays(currentWeekStart, 6);
  const { data: timeSlots = [], isLoading: slotsLoading } = useQuery({
    queryKey: ["teacher-week-slots", scheduleIds, format(currentWeekStart, "yyyy-MM-dd")],
    queryFn: async () => {
      if (!scheduleIds.length) return [];
      const { data, error } = await supabase
        .from("time_slots")
        .select("*")
        .in("schedule_id", scheduleIds)
        .gte("date", format(currentWeekStart, "yyyy-MM-dd"))
        .lte("date", format(weekEnd, "yyyy-MM-dd"))
        .order("date")
        .order("start_time");
      if (error) throw error;
      return data as TimeSlot[];
    },
    enabled: scheduleIds.length > 0,
  });

  // Fetch bookings for time slots
  const slotIds = useMemo(() => timeSlots.map(s => s.id), [timeSlots]);
  const { data: bookings = [] } = useQuery({
    queryKey: ["teacher-week-bookings", slotIds],
    queryFn: async () => {
      if (!slotIds.length) return [];
      const { data, error } = await supabase
        .from("simple_bookings")
        .select("id, time_slot_id, simple_user_id")
        .in("time_slot_id", slotIds);
      if (error) throw error;
      
      const userIds = [...new Set(data.map(b => b.simple_user_id))];
      if (userIds.length === 0) return data.map(b => ({ ...b, user: null }));
      
      const { data: users } = await supabase
        .from("simple_users")
        .select("id, name")
        .in("id", userIds);
      
      return data.map(b => ({
        ...b,
        user: users?.find(u => u.id === b.simple_user_id),
      })) as Booking[];
    },
    enabled: slotIds.length > 0,
  });

  // Create schedule mutation
  const createSchedule = useMutation({
    mutationFn: async () => {
      if (!teacherId) throw new Error("Teacher ID not found");
      
      const { data, error } = await supabase
        .from("schedules")
        .insert({
          product_id: scheduleForm.productId,
          title: scheduleForm.title,
          event_type: scheduleType,
          max_participants: scheduleType === "group" ? Number(scheduleForm.maxParticipants) : null,
          teacher_id: teacherId,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-schedules-list"] });
      toast.success(language === "ru" ? "Расписание создано!" : "Кесте жасалды!");
      setIsAddingSchedule(false);
      setScheduleForm({ title: "", productId: "", maxParticipants: "10" });
    },
    onError: (error) => {
      console.error("Schedule creation error:", error);
      toast.error(language === "ru" ? "Ошибка при создании" : "Жасау кезінде қате");
    },
  });

  // Delete schedule mutation
  const deleteSchedule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("schedules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-schedules-list"] });
      toast.success(language === "ru" ? "Расписание удалено!" : "Кесте жойылды!");
      setDeletingSchedule(null);
    },
    onError: () => toast.error(language === "ru" ? "Ошибка при удалении" : "Жою кезінде қате"),
  });

  // Create time slots mutation
  const createTimeSlots = useMutation({
    mutationFn: async () => {
      if (!selectedScheduleForSlots) throw new Error("No schedule selected");
      
      const startDate = new Date(slotsForm.startDate);
      const endDate = new Date(slotsForm.endDate);
      const duration = Number(slotsForm.slotDuration);
      const breakTime = Number(slotsForm.breakDuration);
      
      const slots: Omit<TimeSlot, "id">[] = [];
      
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
            schedule_id: selectedScheduleForSlots.id,
            date: dateStr,
            start_time: slotStart,
            end_time: slotEnd,
            is_available: true,
          });
          
          if (breakTime > 0) {
            currentTime = new Date(currentTime.getTime() + breakTime * 60000);
          }
        }
        
        currentDate = addDays(currentDate, 1);
      }

      if (slots.length === 0) throw new Error("No slots to create");

      const { error } = await supabase.from("time_slots").insert(slots);
      if (error) throw error;
      return slots.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["teacher-week-slots"] });
      toast.success(language === "ru" ? `Создано ${count} слотов!` : `${count} слот жасалды!`);
      setIsAddingSlots(false);
      setSelectedScheduleForSlots(null);
    },
    onError: () => toast.error(language === "ru" ? "Ошибка при создании слотов" : "Слоттарды жасау кезінде қате"),
  });

  // Cancel booking mutation
  const cancelBooking = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase
        .from("simple_bookings")
        .delete()
        .eq("id", bookingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-week-bookings"] });
      toast.success(language === "ru" ? "Запись отменена!" : "Жазба бас тартылды!");
      setCancelingBooking(null);
    },
    onError: () => toast.error(language === "ru" ? "Ошибка при отмене" : "Бас тарту кезінде қате"),
  });

  // Delete time slot mutation
  const deleteTimeSlot = useMutation({
    mutationFn: async (slotId: string) => {
      const { error } = await supabase
        .from("time_slots")
        .delete()
        .eq("id", slotId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-week-slots"] });
      toast.success(language === "ru" ? "Слот удалён!" : "Слот жойылды!");
      setDeletingSlot(null);
    },
    onError: () => toast.error(language === "ru" ? "Ошибка при удалении" : "Жою кезінде қате"),
  });

  // Week navigation
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  const getSlotsForDay = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return timeSlots.filter(slot => slot.date === dateStr);
  };

  const getBookingsForSlot = (slotId: string) => {
    return bookings.filter(b => b.time_slot_id === slotId);
  };

  const getScheduleForSlot = (slotId: string) => {
    const slot = timeSlots.find(s => s.id === slotId);
    if (!slot) return null;
    return schedules.find(s => s.id === slot.schedule_id);
  };

  const isSlotFullyBooked = (slotId: string) => {
    const slotBookings = getBookingsForSlot(slotId);
    if (slotBookings.length === 0) return false;
    
    const schedule = getScheduleForSlot(slotId);
    if (!schedule) return slotBookings.length > 0;
    
    if (schedule.event_type === "individual") {
      return slotBookings.length > 0;
    }
    
    const maxParticipants = schedule.max_participants || 1;
    return slotBookings.length >= maxParticipants;
  };

  const getDayStatus = (date: Date): "free" | "partial" | "full" => {
    const daySlots = getSlotsForDay(date);
    if (daySlots.length === 0) return "free";
    
    const fullyBookedCount = daySlots.filter(slot => isSlotFullyBooked(slot.id)).length;
    const partiallyBookedCount = daySlots.filter(slot => {
      const bookingsCount = getBookingsForSlot(slot.id).length;
      return bookingsCount > 0 && !isSlotFullyBooked(slot.id);
    }).length;
    
    if (fullyBookedCount === daySlots.length) return "full";
    if (fullyBookedCount > 0 || partiallyBookedCount > 0) return "partial";
    return "free";
  };

  const getSlotStatus = (slotId: string): "free" | "partial" | "full" => {
    const slotBookings = getBookingsForSlot(slotId);
    if (slotBookings.length === 0) return "free";
    if (isSlotFullyBooked(slotId)) return "full";
    return "partial";
  };

  const selectedDateSlots = useMemo(() => {
    if (!selectedDate) return [];
    return getSlotsForDay(selectedDate).sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [selectedDate, timeSlots]);

  const isLoading = schedulesLoading || slotsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (productIds.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
        <p className="text-muted-foreground">
          {language === "ru" ? "Нет доступных продуктов" : "Қол жетімді өнімдер жоқ"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Schedule Type Toggle + Create Button */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-2">
          <Button
            variant={scheduleType === "individual" ? "default" : "outline"}
            size="sm"
            onClick={() => setScheduleType("individual")}
            className="gap-2"
          >
            <User className="w-4 h-4" />
            {t("individual")}
          </Button>
          <Button
            variant={scheduleType === "group" ? "default" : "outline"}
            size="sm"
            onClick={() => setScheduleType("group")}
            className="gap-2"
          >
            <Users className="w-4 h-4" />
            {t("group")}
          </Button>
        </div>
        <Button size="sm" onClick={() => setIsAddingSchedule(true)}>
          <Plus className="w-4 h-4 mr-2" />
          {t("create")}
        </Button>
      </div>

      {/* Schedules List */}
      {filteredSchedules.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>{t("noSchedules")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredSchedules.map((schedule) => (
            <Card key={schedule.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    {schedule.event_type === "group" ? (
                      <Users className="w-5 h-5 text-primary" />
                    ) : (
                      <User className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{schedule.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {schedule.product?.title}
                      {schedule.event_type === "group" && schedule.max_participants && (
                        <span className="ml-2">• {language === "ru" ? "до" : "дейін"} {schedule.max_participants} {language === "ru" ? "чел." : "адам"}</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedScheduleForSlots(schedule);
                      setSlotsForm({
                        ...slotsForm,
                        startDate: format(new Date(), "yyyy-MM-dd"),
                        endDate: format(addDays(new Date(), 7), "yyyy-MM-dd"),
                      });
                      setIsAddingSlots(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    {language === "ru" ? "Слоты" : "Слоттар"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeletingSchedule(schedule)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Week Calendar */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{t("weeklySchedule")}</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentWeekStart(addDays(currentWeekStart, -7))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground min-w-[140px] text-center">
                {format(currentWeekStart, "d MMM", { locale: ru })} -{" "}
                {format(weekEnd, "d MMM", { locale: ru })}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day) => {
              const daySlots = getSlotsForDay(day);
              const bookedSessionsCount = daySlots.filter(slot => 
                bookings.some(b => b.time_slot_id === slot.id)
              ).length;
              const isSelected = selectedDate && format(selectedDate, "yyyy-MM-dd") === format(day, "yyyy-MM-dd");
              const isToday = format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
              const hasSlots = daySlots.length > 0;
              const dayStatus = getDayStatus(day);
              
              const getDotColor = () => {
                if (isSelected) return "bg-primary-foreground";
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
                  className={`p-2 rounded-lg text-center transition-colors relative ${
                    isSelected 
                      ? "bg-primary text-primary-foreground" 
                      : isToday
                        ? "bg-primary/10 hover:bg-primary/20"
                        : "hover:bg-muted"
                  }`}
                >
                  <div className="text-xs font-medium flex items-center justify-center gap-1">
                    {format(day, "EEE", { locale: ru })}
                    {hasSlots && (
                      <span className={`w-1.5 h-1.5 rounded-full ${getDotColor()}`} />
                    )}
                  </div>
                  <div className="text-lg font-bold">{format(day, "d")}</div>
                  {bookedSessionsCount > 0 && (
                    <div className="flex justify-center mt-1">
                      <span className={`text-xs font-medium ${isSelected ? "text-primary-foreground/80" : "text-green-600"}`}>
                        {bookedSessionsCount}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected Day Slots */}
      {selectedDate && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {format(selectedDate, "d MMMM", { locale: ru })}
              <Badge variant="secondary">{selectedDateSlots.length} {language === "ru" ? "слотов" : "слот"}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedDateSlots.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t("noSlotsAvailable")}
              </p>
            ) : (
              <div className="space-y-2">
                {selectedDateSlots.map((slot) => {
                  const slotBookings = getBookingsForSlot(slot.id);
                  const slotStatus = getSlotStatus(slot.id);
                  const schedule = getScheduleForSlot(slot.id);
                  const maxParticipants = schedule?.max_participants || 1;
                  const isGroup = schedule?.event_type === "group";
                  
                  const getSlotStyles = () => {
                    switch (slotStatus) {
                      case "full": return { bg: "bg-green-50 border border-green-200", dot: "bg-green-500", text: "text-green-700" };
                      case "partial": return { bg: "bg-orange-50 border border-orange-200", dot: "bg-orange-500", text: "text-orange-700" };
                      case "free": return { bg: "bg-red-50 border border-red-200", dot: "bg-red-500", text: "text-red-700" };
                    }
                  };
                  
                  const styles = getSlotStyles();
                  
                  return (
                    <div
                      key={slot.id}
                      className={`flex items-center justify-between p-3 rounded-lg ${styles.bg}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${styles.dot}`} />
                        <span className="font-medium">
                          {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                        </span>
                        {isGroup && (
                          <span className="text-xs text-muted-foreground">
                            ({slotBookings.length}/{maxParticipants})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {slotBookings.length > 0 ? (
                          <>
                            <span className={`text-sm ${styles.text}`}>
                              {slotBookings.map(b => b.user?.name || "—").join(", ")}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setCancelingBooking(slotBookings[0])}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className={`text-sm ${styles.text}`}>
                              {language === "ru" ? "Свободно" : "Бос"}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDeletingSlot(slot)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Schedule Dialog */}
      <Dialog open={isAddingSchedule} onOpenChange={setIsAddingSchedule}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "ru" ? "Создать расписание" : "Кесте жасау"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createSchedule.mutate(); }} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>{language === "ru" ? "Продукт" : "Өнім"} *</Label>
              <Select value={scheduleForm.productId} onValueChange={(v) => setScheduleForm({ ...scheduleForm, productId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={language === "ru" ? "Выберите продукт" : "Өнімді таңдаңыз"} />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{language === "ru" ? "Название" : "Атауы"} *</Label>
              <Input
                placeholder={language === "ru" ? "Например: Индивидуальные консультации" : "Мысалы: Жеке кеңестер"}
                value={scheduleForm.title}
                onChange={(e) => setScheduleForm({ ...scheduleForm, title: e.target.value })}
                required
              />
            </div>
            {scheduleType === "group" && (
              <div className="space-y-2">
                <Label>{language === "ru" ? "Макс. участников" : "Макс. қатысушылар"}</Label>
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
              <Button type="submit" className="flex-1" disabled={createSchedule.isPending || !scheduleForm.productId || !scheduleForm.title}>
                {createSchedule.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t("create")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Slots Dialog */}
      <Dialog open={isAddingSlots} onOpenChange={(open) => { if (!open) { setIsAddingSlots(false); setSelectedScheduleForSlots(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "ru" ? "Добавить слоты" : "Слоттар қосу"}: {selectedScheduleForSlots?.title}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createTimeSlots.mutate(); }} className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === "ru" ? "Дата начала" : "Басталу күні"}</Label>
                <Input
                  type="date"
                  value={slotsForm.startDate}
                  onChange={(e) => setSlotsForm({ ...slotsForm, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{language === "ru" ? "Дата окончания" : "Аяқталу күні"}</Label>
                <Input
                  type="date"
                  value={slotsForm.endDate}
                  onChange={(e) => setSlotsForm({ ...slotsForm, endDate: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === "ru" ? "Время начала" : "Басталу уақыты"}</Label>
                <Input
                  type="time"
                  value={slotsForm.startTime}
                  onChange={(e) => setSlotsForm({ ...slotsForm, startTime: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{language === "ru" ? "Время окончания" : "Аяқталу уақыты"}</Label>
                <Input
                  type="time"
                  value={slotsForm.endTime}
                  onChange={(e) => setSlotsForm({ ...slotsForm, endTime: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{language === "ru" ? "Длительность (мин)" : "Ұзақтығы (мин)"}</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="1"
                  value={slotsForm.slotDuration}
                  onChange={(e) => {
                    const val = e.target.value.replace(/^0+(?=\d)/, "");
                    setSlotsForm({ ...slotsForm, slotDuration: val });
                  }}
                  className="flex-1"
                />
                <div className="flex gap-1">
                  {[50, 60, 90, 120].map((duration) => (
                    <Button
                      key={duration}
                      type="button"
                      variant={slotsForm.slotDuration === String(duration) ? "default" : "outline"}
                      size="sm"
                      className="px-2 text-xs"
                      onClick={() => setSlotsForm({ ...slotsForm, slotDuration: String(duration) })}
                    >
                      {duration}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{language === "ru" ? "Перерыв (мин)" : "Үзіліс (мин)"}</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  value={slotsForm.breakDuration}
                  onChange={(e) => {
                    const val = e.target.value.replace(/^0+(?=\d)/, "");
                    setSlotsForm({ ...slotsForm, breakDuration: val });
                  }}
                  className="flex-1"
                />
                <div className="flex gap-1">
                  {[0, 5, 10, 15].map((duration) => (
                    <Button
                      key={duration}
                      type="button"
                      variant={slotsForm.breakDuration === String(duration) ? "default" : "outline"}
                      size="sm"
                      className="px-2 text-xs"
                      onClick={() => setSlotsForm({ ...slotsForm, breakDuration: String(duration) })}
                    >
                      {duration}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => { setIsAddingSlots(false); setSelectedScheduleForSlots(null); }}>
                {t("cancel")}
              </Button>
              <Button type="submit" className="flex-1" disabled={createTimeSlots.isPending}>
                {createTimeSlots.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : language === "ru" ? "Создать слоты" : "Слоттарды жасау"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Schedule Confirmation */}
      <AlertDialog open={!!deletingSchedule} onOpenChange={(open) => { if (!open) setDeletingSchedule(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{language === "ru" ? "Удалить расписание?" : "Кестені жою керек пе?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {language === "ru" 
                ? `Вы уверены, что хотите удалить "${deletingSchedule?.title}"? Все связанные слоты будут также удалены.`
                : `"${deletingSchedule?.title}" жойғыңыз келетініне сенімдісіз бе? Барлық байланысты слоттар да жойылады.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingSchedule && deleteSchedule.mutate(deletingSchedule.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSchedule.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Booking Confirmation */}
      <AlertDialog open={!!cancelingBooking} onOpenChange={(open) => { if (!open) setCancelingBooking(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{language === "ru" ? "Отменить запись?" : "Жазбаны бас тарту керек пе?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {language === "ru"
                ? `Вы уверены, что хотите отменить запись ученика "${cancelingBooking?.user?.name || "—"}"? Слот станет снова свободным.`
                : `"${cancelingBooking?.user?.name || "—"}" оқушысының жазбасын бас тартқыңыз келетініне сенімдісіз бе?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelingBooking && cancelBooking.mutate(cancelingBooking.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelBooking.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : language === "ru" ? "Отменить запись" : "Жазбаны бас тарту"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Time Slot Confirmation */}
      <AlertDialog open={!!deletingSlot} onOpenChange={(open) => { if (!open) setDeletingSlot(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{language === "ru" ? "Удалить слот?" : "Слотты жою керек пе?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {language === "ru"
                ? `Вы уверены, что хотите удалить слот ${deletingSlot?.start_time.slice(0, 5)} - ${deletingSlot?.end_time.slice(0, 5)}?`
                : `${deletingSlot?.start_time.slice(0, 5)} - ${deletingSlot?.end_time.slice(0, 5)} слотын жойғыңыз келетініне сенімдісіз бе?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingSlot && deleteTimeSlot.mutate(deletingSlot.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTimeSlot.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TeacherScheduleTab;
