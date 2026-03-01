import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { Loader2, Calendar, ChevronLeft, ChevronRight, Plus, Trash2, Users, User, Clock, Pencil, UserPlus, Link, Copy } from "lucide-react";
import CancellationReasonDialog from "@/components/CancellationReasonDialog";
import RescheduleSlotDialog from "@/components/RescheduleSlotDialog";
import EditSlotTimeDialog from "@/components/EditSlotTimeDialog";
import { useCreatorCancelBooking, useRescheduleSlot, useEditSlotTime } from "@/hooks/useSimplePurchases";
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
  max_participants?: number | null;
  lesson_link?: string | null;
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
  const isMobile = useIsMobile();

  const [scheduleType, setScheduleType] = useState<EventType>("individual");
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [isAddingSchedule, setIsAddingSchedule] = useState(false);
  const [isAddingSlots, setIsAddingSlots] = useState(false);
  const [selectedScheduleForSlots, setSelectedScheduleForSlots] = useState<Schedule | null>(null);
  const [deletingSchedule, setDeletingSchedule] = useState<Schedule | null>(null);
  const [cancelingBooking, setCancelingBooking] = useState<Booking | null>(null);
  const [deletingSlot, setDeletingSlot] = useState<TimeSlot | null>(null);
  const [isDeletingSlots, setIsDeletingSlots] = useState(false);
  const [isDeletingSchedule, setIsDeletingSchedule] = useState(false);
  const [selectedScheduleForDelete, setSelectedScheduleForDelete] = useState<Schedule | null>(null);
  const [slotsToDeleteDates, setSlotsToDeleteDates] = useState<string[]>([]);
  const [availableDatesForDelete, setAvailableDatesForDelete] = useState<string[]>([]);
  const [confirmDeleteSlots, setConfirmDeleteSlots] = useState(false);
  const [confirmDeleteSchedule, setConfirmDeleteSchedule] = useState(false);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [editScheduleTitle, setEditScheduleTitle] = useState("");
  const [deletingSlotWithBookings, setDeletingSlotWithBookings] = useState<TimeSlot | null>(null);
  const [expandingSlot, setExpandingSlot] = useState<{ slot: TimeSlot; schedule: Schedule } | null>(null);
  const [reschedulingSlot, setReschedulingSlot] = useState<{ slot: TimeSlot; schedule: Schedule } | null>(null);
  const [editingSlotTime, setEditingSlotTime] = useState<TimeSlot | null>(null);
  
  // Lesson link states
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [selectedScheduleForLink, setSelectedScheduleForLink] = useState<Schedule | null>(null);
  const [slotsForLinkDates, setSlotsForLinkDates] = useState<string[]>([]);
  const [availableDatesForLink, setAvailableDatesForLink] = useState<string[]>([]);
  const [lessonLinkUrl, setLessonLinkUrl] = useState("");
  const [viewingLinkSlot, setViewingLinkSlot] = useState<TimeSlot | null>(null);

  const [scheduleForm, setScheduleForm] = useState({
    title: "",
    productId: "",
    maxParticipants: "10",
  });

  const [slotsForm, setSlotsForm] = useState({
    startDate: format(new Date(), "yyyy-MM-dd"),
    endDate: format(addDays(new Date(), 7), "yyyy-MM-dd"),
    startTime: "09:00",
    endTime: "10:00",
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

  // Update schedule title mutation
  const updateScheduleTitle = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { error } = await supabase
        .from("schedules")
        .update({ title })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-schedules-list"] });
      toast.success(language === "ru" ? "Название обновлено!" : "Атауы жаңартылды!");
      setEditingSchedule(null);
      setEditScheduleTitle("");
    },
    onError: () => toast.error(language === "ru" ? "Ошибка при обновлении" : "Жаңарту кезінде қате"),
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
    onError: (error) => {
      console.error("Slot creation error:", error);
      toast.error(language === "ru" ? "Ошибка при создании слотов" : "Слоттарды жасау кезінде қате");
    },
  });

  // Cancel booking mutation using shared hook
  const teacherCancelBooking = useCreatorCancelBooking();
  const rescheduleSlotMutation = useRescheduleSlot();
  const editSlotTimeMutation = useEditSlotTime();

  const handleCancelBookingWithReason = async (reasons: string[], comment: string) => {
    if (!cancelingBooking) return;
    try {
      await teacherCancelBooking.mutateAsync({
        bookingId: cancelingBooking.id,
        cancelledBy: "teacher",
        reasons,
        comment,
      });
      toast.success(language === "ru" ? "Запись отменена!" : "Жазба бас тартылды!");
      setCancelingBooking(null);
    } catch {
      toast.error(language === "ru" ? "Ошибка при отмене" : "Бас тарту кезінде қате");
    }
  };

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

  // Delete time slot with bookings (force delete)
  const deleteSlotWithBookings = useMutation({
    mutationFn: async ({ slotId, reasons, comment }: { slotId: string; reasons: string[]; comment: string }) => {
      // Get slot info
      const { data: slotData } = await supabase
        .from("time_slots")
        .select("date, start_time, schedule_id")
        .eq("id", slotId)
        .single();

      // Get bookings for this slot
      const { data: slotBookingsData } = await supabase
        .from("simple_bookings")
        .select("id, simple_user_id")
        .eq("time_slot_id", slotId);

      if (slotBookingsData?.length && slotData) {
        // Get schedule + product info
        const { data: scheduleData } = await supabase
          .from("schedules")
          .select("id, title, product_id, product:products(title)")
          .eq("id", slotData.schedule_id)
          .single();

        // Get user info
        const userIds = slotBookingsData.map(b => b.simple_user_id);
        const { data: usersData } = await supabase
          .from("simple_users")
          .select("id, name, phone")
          .in("id", userIds);

        // Create cancellation records
        const cancellationRecords = slotBookingsData.map(b => {
          const user = usersData?.find(u => u.id === b.simple_user_id);
          return {
            booking_id: b.id,
            product_id: scheduleData?.product_id || "",
            product_title: (scheduleData?.product as any)?.title || "",
            schedule_id: scheduleData?.id || null,
            schedule_title: scheduleData?.title || null,
            simple_user_id: b.simple_user_id,
            user_name: user?.name || "—",
            user_phone: user?.phone || null,
            slot_date: slotData.date,
            slot_time: slotData.start_time,
            cancelled_by: "teacher",
            cancellation_reasons: reasons,
            cancellation_comment: comment || null,
          };
        });

        const { error: cancError } = await supabase
          .from("booking_cancellations")
          .insert(cancellationRecords);
        if (cancError) throw cancError;
      }

      // First delete all bookings for this slot
      const { error: bookingsError } = await supabase
        .from("simple_bookings")
        .delete()
        .eq("time_slot_id", slotId);
      if (bookingsError) throw bookingsError;
      
      // Then delete the slot
      const { error: slotError } = await supabase
        .from("time_slots")
        .delete()
        .eq("id", slotId);
      if (slotError) throw slotError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-week-slots"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-week-bookings"] });
      toast.success(language === "ru" ? "Слот и записи удалены!" : "Слот пен жазбалар жойылды!");
      setDeletingSlotWithBookings(null);
    },
    onError: () => toast.error(language === "ru" ? "Ошибка при удалении" : "Жою кезінде қате"),
  });

  // Expand slot (increase max_participants for specific slot)
  const expandSlot = useMutation({
    mutationFn: async ({ slot, schedule }: { slot: TimeSlot; schedule: Schedule }) => {
      // Get current max for this slot (use slot override or schedule default)
      const currentMax = slot.max_participants ?? schedule.max_participants ?? 1;
      const newMax = currentMax + 1;
      const { error } = await supabase
        .from("time_slots")
        .update({ max_participants: newMax })
        .eq("id", slot.id);
      if (error) throw error;
      return newMax;
    },
    onSuccess: (newMax) => {
      queryClient.invalidateQueries({ queryKey: ["teacher-week-slots"] });
      toast.success(language === "ru" ? `Слот расширен до ${newMax} мест!` : `Слот ${newMax} орынға дейін кеңейтілді!`);
      setExpandingSlot(null);
    },
    onError: () => toast.error(language === "ru" ? "Ошибка при расширении" : "Кеңейту кезінде қате"),
  });

  // Delete multiple time slots mutation
  const deleteMultipleSlots = useMutation({
    mutationFn: async ({ scheduleId, dates }: { scheduleId: string; dates: string[] | "all" }) => {
      if (dates === "all") {
        const { error } = await supabase
          .from("time_slots")
          .delete()
          .eq("schedule_id", scheduleId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("time_slots")
          .delete()
          .eq("schedule_id", scheduleId)
          .in("date", dates);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-week-slots"] });
      toast.success(language === "ru" ? "Слоты удалены!" : "Слоттар жойылды!");
      setIsDeletingSlots(false);
      setSelectedScheduleForDelete(null);
      setSlotsToDeleteDates([]);
    },
    onError: () => toast.error(language === "ru" ? "Ошибка при удалении" : "Жою кезінде қате"),
  });

  // Fetch available dates for delete dialog
  const fetchAvailableDates = async (scheduleId: string) => {
    const { data } = await supabase
      .from("time_slots")
      .select("date")
      .eq("schedule_id", scheduleId)
      .order("date");
    if (data) {
      const uniqueDates = [...new Set(data.map(s => s.date))];
      setAvailableDatesForDelete(uniqueDates);
    }
  };

  // Fetch available dates for link dialog
  const fetchAvailableDatesForLink = async (scheduleId: string) => {
    const { data } = await supabase
      .from("time_slots")
      .select("date")
      .eq("schedule_id", scheduleId)
      .order("date");
    if (data) {
      const uniqueDates = [...new Set(data.map(s => s.date))];
      setAvailableDatesForLink(uniqueDates);
    }
  };

  // Add lesson link mutation
  const addLessonLink = useMutation({
    mutationFn: async ({ scheduleId, dates, link }: { scheduleId: string; dates: string[] | "all"; link: string }) => {
      if (dates === "all") {
        const { error } = await supabase
          .from("time_slots")
          .update({ lesson_link: link })
          .eq("schedule_id", scheduleId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("time_slots")
          .update({ lesson_link: link })
          .eq("schedule_id", scheduleId)
          .in("date", dates);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-week-slots"] });
      toast.success(language === "ru" ? "Ссылка добавлена!" : "Сілтеме қосылды!");
      setIsAddingLink(false);
      setSelectedScheduleForLink(null);
      setSlotsForLinkDates([]);
      setLessonLinkUrl("");
    },
    onError: () => toast.error(language === "ru" ? "Ошибка при добавлении ссылки" : "Сілтемені қосу кезінде қате"),
  });

  // Update single slot lesson link
  const updateSlotLink = useMutation({
    mutationFn: async ({ slotId, link }: { slotId: string; link: string | null }) => {
      const { error } = await supabase
        .from("time_slots")
        .update({ lesson_link: link })
        .eq("id", slotId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-week-slots"] });
      toast.success(language === "ru" ? "Ссылка обновлена!" : "Сілтеме жаңартылды!");
    },
    onError: () => toast.error(language === "ru" ? "Ошибка при обновлении ссылки" : "Сілтемені жаңарту кезінде қате"),
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
    
    const slot = timeSlots.find(s => s.id === slotId);
    const schedule = getScheduleForSlot(slotId);
    if (!schedule) return slotBookings.length > 0;
    
    if (schedule.event_type === "individual") {
      return slotBookings.length > 0;
    }
    
    // Use slot's max_participants if set, otherwise fall back to schedule's default
    const maxParticipants = slot?.max_participants ?? schedule.max_participants ?? 1;
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
      {/* Schedule Type Toggle + Create/Delete Buttons */}
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
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            if (products.length === 1) {
              setScheduleForm({ ...scheduleForm, productId: products[0].id });
            }
            setIsAddingSchedule(true);
          }}>
            <Plus className="w-4 h-4 mr-2" />
            {language === "ru" ? "Расписание" : "Кесте"}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="text-destructive border-destructive/50 hover:bg-destructive/10"
            onClick={() => setIsDeletingSchedule(true)}
            disabled={schedules.length === 0}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {language === "ru" ? "Выбрать" : "Таңдау"}
          </Button>
        </div>
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
              <CardContent className={`p-3 ${isMobile ? "space-y-2" : "flex items-center justify-between"}`}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    {schedule.event_type === "group" ? (
                      <Users className="w-4 h-4 text-primary" />
                    ) : (
                      <User className="w-4 h-4 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="text-sm font-medium truncate">{schedule.title}</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 shrink-0"
                        onClick={() => {
                          setEditingSchedule(schedule);
                          setEditScheduleTitle(schedule.title);
                        }}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {schedule.product?.title}
                      {schedule.event_type === "group" && schedule.max_participants && (
                        <span className="ml-1">• {schedule.max_participants} {language === "ru" ? "чел." : "адам"}</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className={`flex gap-1 ${isMobile ? "pl-10" : ""}`}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                      setSelectedScheduleForSlots(schedule);
                      setSlotsForm({
                        ...slotsForm,
                        startDate: format(new Date(), "yyyy-MM-dd"),
                        endDate: format(addDays(new Date(), 7), "yyyy-MM-dd"),
                      });
                      setIsAddingSlots(true);
                    }}
                    title={language === "ru" ? "Добавить слоты" : "Слоттар қосу"}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="ml-1">{language === "ru" ? "Слоты" : "Слоттар"}</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                      setSelectedScheduleForLink(schedule);
                      fetchAvailableDatesForLink(schedule.id);
                      setSlotsForLinkDates([]);
                      setLessonLinkUrl("");
                      setIsAddingLink(true);
                    }}
                    title={language === "ru" ? "Добавить ссылку" : "Сілтеме қосу"}
                  >
                    <Link className="w-3.5 h-3.5" />
                    <span className="ml-1">{language === "ru" ? "Ссылка" : "Сілтеме"}</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs text-destructive border-destructive/50 hover:bg-destructive/10"
                    onClick={() => {
                      setSelectedScheduleForDelete(schedule);
                      fetchAvailableDates(schedule.id);
                      setSlotsToDeleteDates([]);
                      setIsDeletingSlots(true);
                    }}
                    title={language === "ru" ? "Удалить слоты" : "Слоттарды жою"}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="ml-1">{language === "ru" ? "Выбрать" : "Таңдау"}</span>
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
                  {hasSlots && (
                    <span className={`absolute top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full ${getDotColor()}`} />
                  )}
                  <div className="text-xs font-medium mt-2">
                    {format(day, "EEE", { locale: ru })}
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
                  // Use slot's max_participants if set, otherwise fall back to schedule's default
                  const maxParticipants = slot.max_participants ?? schedule?.max_participants ?? 1;
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
                      className={`p-2 rounded-lg ${styles.bg}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                            </span>
                            {filteredSchedules.length > 1 && schedule && (
                              <span className="text-[10px] text-muted-foreground leading-tight">
                                {schedule.title}
                              </span>
                            )}
                          </div>
                          {isGroup && (
                            <span className="text-[10px] text-muted-foreground">
                              ({slotBookings.length}/{maxParticipants})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {/* Lesson link button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-7 w-7 ${slot.lesson_link ? "text-blue-600 hover:text-blue-600 hover:bg-blue-50" : "text-muted-foreground hover:text-primary hover:bg-primary/10"}`}
                            onClick={() => {
                              if (slot.lesson_link) {
                                setViewingLinkSlot(slot);
                              } else {
                                const newLink = prompt(language === "ru" ? "Введите ссылку на урок:" : "Сабаққа сілтемені енгізіңіз:");
                                if (newLink) {
                                  updateSlotLink.mutate({ slotId: slot.id, link: newLink });
                                }
                              }
                            }}
                            title={slot.lesson_link ? (language === "ru" ? "Просмотреть ссылку" : "Сілтемені көру") : (language === "ru" ? "Добавить ссылку" : "Сілтеме қосу")}
                          >
                            <Link className="w-4 h-4" />
                          </Button>
                          {/* Add spot button for ALL group sessions */}
                          {isGroup && schedule && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-primary hover:text-primary hover:bg-primary/10"
                              onClick={() => setExpandingSlot({ slot, schedule })}
                              title={language === "ru" ? "Добавить место" : "Орын қосу"}
                            >
                              <UserPlus className="w-4 h-4" />
                            </Button>
                          )}
                          {/* Delete slot button - always visible */}
                          {slotBookings.length === 0 ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                onClick={() => setEditingSlotTime(slot)}
                                title={t("editTime")}
                              >
                                <Clock className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setDeletingSlot(slot)}
                                title={language === "ru" ? "Удалить слот" : "Слотты жою"}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                onClick={() => setReschedulingSlot({ slot, schedule })}
                                title={language === "ru" ? "Перенести" : "Ауыстыру"}
                              >
                                <Clock className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setDeletingSlotWithBookings(slot)}
                                title={language === "ru" ? "Удалить слот" : "Слотты жою"}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {/* List of bookings with individual delete buttons */}
                      {slotBookings.length > 0 && (
                        <div className="mt-2 space-y-1 pl-5">
                          {slotBookings.map((booking) => (
                            <div key={booking.id} className="flex items-center justify-between py-1 px-2 bg-background/50 rounded">
                              <span className={`text-sm ${styles.text}`}>
                                {booking.user?.name || "—"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
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
            {products.length > 1 && (
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
            )}
            {products.length === 1 && (
              <div className="text-sm text-muted-foreground">
                {language === "ru" ? "Продукт" : "Өнім"}: <span className="font-medium text-foreground">{products[0].title}</span>
              </div>
            )}
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
                <Label>{language === "ru" ? "Время начала (24ч)" : "Басталу уақыты (24с)"}</Label>
                <Input
                  type="time"
                  value={slotsForm.startTime}
                  onChange={(e) => {
                    const newStart = e.target.value;
                    const [h, m] = newStart.split(":").map(Number);
                    const total = h * 60 + m + Number(slotsForm.slotDuration);
                    const endH = Math.floor(total / 60) % 24;
                    const endM = total % 60;
                    const newEnd = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
                    setSlotsForm({ ...slotsForm, startTime: newStart, endTime: newEnd });
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>{language === "ru" ? "Время окончания (24ч)" : "Аяқталу уақыты (24с)"}</Label>
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

      {/* Cancel Booking Confirmation with Reasons */}
      <CancellationReasonDialog
        isOpen={!!cancelingBooking}
        onClose={() => setCancelingBooking(null)}
        onConfirm={handleCancelBookingWithReason}
        isPending={teacherCancelBooking.isPending}
        title={language === "ru" ? "Отменить запись?" : "Жазбаны бас тарту керек пе?"}
        description={language === "ru"
          ? `Вы отменяете запись ученика "${cancelingBooking?.user?.name || "—"}". Укажите причину.`
          : `"${cancelingBooking?.user?.name || "—"}" оқушысының жазбасын бас тартасыз. Себебін көрсетіңіз.`}
      />

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

      {/* Delete Time Slot WITH Bookings - CancellationReasonDialog */}
      <CancellationReasonDialog
        isOpen={!!deletingSlotWithBookings}
        onClose={() => setDeletingSlotWithBookings(null)}
        onConfirm={(reasons, comment) => {
          if (deletingSlotWithBookings) {
            deleteSlotWithBookings.mutate({ slotId: deletingSlotWithBookings.id, reasons, comment });
          }
        }}
        isPending={deleteSlotWithBookings.isPending}
        title={language === "ru" ? "Отменить записи и удалить слот?" : "Жазбаларды жойып, слотты өшіру керек пе?"}
        description={language === "ru"
          ? `Слот ${deletingSlotWithBookings?.start_time.slice(0, 5)} - ${deletingSlotWithBookings?.end_time.slice(0, 5)} будет удалён вместе со всеми записями. Укажите причину отмены.`
          : `${deletingSlotWithBookings?.start_time.slice(0, 5)} - ${deletingSlotWithBookings?.end_time.slice(0, 5)} слоты барлық жазбалармен бірге жойылады. Бас тарту себебін көрсетіңіз.`}
      />

      {/* Expand Slot Confirmation */}
      <AlertDialog open={!!expandingSlot} onOpenChange={(open) => { if (!open) setExpandingSlot(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{language === "ru" ? "Добавить место в слот?" : "Слотқа орын қосу керек пе?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                if (!expandingSlot) return "";
                const currentMax = expandingSlot.slot.max_participants ?? expandingSlot.schedule.max_participants ?? 1;
                const newMax = currentMax + 1;
                return language === "ru"
                  ? `Максимальное количество участников для слота ${expandingSlot.slot.start_time.slice(0, 5)} - ${expandingSlot.slot.end_time.slice(0, 5)} будет увеличено с ${currentMax} до ${newMax}.`
                  : `${expandingSlot.slot.start_time.slice(0, 5)} - ${expandingSlot.slot.end_time.slice(0, 5)} слотындағы қатысушылардың максималды саны ${currentMax}-ден ${newMax}-ге дейін артады.`;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => expandingSlot && expandSlot.mutate(expandingSlot)}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {expandSlot.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : language === "ru" ? "Добавить место" : "Орын қосу"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Multiple Slots Dialog */}
      <Dialog open={isDeletingSlots} onOpenChange={(open) => { if (!open) { setIsDeletingSlots(false); setSelectedScheduleForDelete(null); setSlotsToDeleteDates([]); setAvailableDatesForDelete([]); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "ru" ? "Удалить слоты" : "Слоттарды жою"}</DialogTitle>
          </DialogHeader>
          
          {/* Schedule Selection (if not already selected) */}
          {!selectedScheduleForDelete ? (
            <div className="space-y-4 mt-4">
              <Label>{language === "ru" ? "Выберите расписание" : "Кестені таңдаңыз"}</Label>
              {schedules.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  {language === "ru" ? "Нет расписаний" : "Кестелер жоқ"}
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {schedules.map((schedule) => (
                    <Button
                      key={schedule.id}
                      variant="outline"
                      className="w-full justify-start gap-3 h-auto py-3"
                      onClick={() => {
                        setSelectedScheduleForDelete(schedule);
                        fetchAvailableDates(schedule.id);
                        setSlotsToDeleteDates([]);
                      }}
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        {schedule.event_type === "group" ? (
                          <Users className="w-4 h-4 text-primary" />
                        ) : (
                          <User className="w-4 h-4 text-primary" />
                        )}
                      </div>
                      <div className="text-left">
                        <p className="font-medium">{schedule.title}</p>
                        <p className="text-xs text-muted-foreground">{schedule.product?.title}</p>
                      </div>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mt-2 mb-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedScheduleForDelete(null);
                    setSlotsToDeleteDates([]);
                    setAvailableDatesForDelete([]);
                  }}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  {language === "ru" ? "Назад" : "Артқа"}
                </Button>
                <div className="flex items-center gap-2">
                  {selectedScheduleForDelete.event_type === "group" ? (
                    <Users className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <User className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className="font-medium">{selectedScheduleForDelete.title}</span>
                </div>
              </div>
          <div className="space-y-4">
            {availableDatesForDelete.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                {language === "ru" ? "Нет слотов для удаления" : "Жоюға слоттар жоқ"}
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>{language === "ru" ? "Выберите даты для удаления" : "Жою үшін күндерді таңдаңыз"}</Label>
                  <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 border rounded-md">
                    {availableDatesForDelete.map((date) => {
                      const isSelected = slotsToDeleteDates.includes(date);
                      return (
                        <Button
                          key={date}
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          className={!isSelected ? "hover:bg-background hover:text-foreground" : ""}
                          onClick={() => {
                            if (isSelected) {
                              setSlotsToDeleteDates(prev => prev.filter(d => d !== date));
                            } else {
                              setSlotsToDeleteDates(prev => [...prev, date]);
                            }
                          }}
                        >
                          {format(new Date(date), "d MMM", { locale: ru })}
                        </Button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {language === "ru" 
                      ? `Выбрано: ${slotsToDeleteDates.length} из ${availableDatesForDelete.length}` 
                      : `Таңдалды: ${slotsToDeleteDates.length} / ${availableDatesForDelete.length}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      if (slotsToDeleteDates.length === availableDatesForDelete.length) {
                        setSlotsToDeleteDates([]);
                      } else {
                        setSlotsToDeleteDates([...availableDatesForDelete]);
                      }
                    }}
                  >
                    {slotsToDeleteDates.length === availableDatesForDelete.length 
                      ? (language === "ru" ? "Снять всё" : "Барлығын алу") 
                      : (language === "ru" ? "Выбрать все" : "Барлығын таңдау")}
                  </Button>
                </div>
              </>
            )}
            <div className="flex gap-2 pt-2 border-t">
              <Button 
                type="button" 
                variant="outline" 
                className="flex-1" 
                onClick={() => { setIsDeletingSlots(false); setSelectedScheduleForDelete(null); setSlotsToDeleteDates([]); }}
              >
                {t("cancel")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="flex-1"
                disabled={slotsToDeleteDates.length === 0}
                onClick={() => setConfirmDeleteSlots(true)}
              >
                {t("delete")}
              </Button>
            </div>
          </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Multiple Slots */}
      <AlertDialog open={confirmDeleteSlots} onOpenChange={setConfirmDeleteSlots}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === "ru" ? "Удалить выбранные слоты?" : "Таңдалған слоттарды жою керек пе?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {slotsToDeleteDates.length === availableDatesForDelete.length
                ? (language === "ru" 
                    ? `Вы уверены, что хотите удалить ВСЕ слоты (${availableDatesForDelete.length} дней) в расписании "${selectedScheduleForDelete?.title}"? Это действие нельзя отменить.`
                    : `"${selectedScheduleForDelete?.title}" кестесіндегі БАРЛЫҚ слоттарды (${availableDatesForDelete.length} күн) жойғыңыз келетініне сенімдісіз бе? Бұл әрекетті болдырмау мүмкін емес.`)
                : (language === "ru"
                    ? `Вы уверены, что хотите удалить слоты за ${slotsToDeleteDates.length} дней? Это действие нельзя отменить.`
                    : `${slotsToDeleteDates.length} күн үшін слоттарды жойғыңыз келетініне сенімдісіз бе? Бұл әрекетті болдырмау мүмкін емес.`)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedScheduleForDelete) {
                  const isAll = slotsToDeleteDates.length === availableDatesForDelete.length;
                  deleteMultipleSlots.mutate({
                    scheduleId: selectedScheduleForDelete.id,
                    dates: isAll ? "all" : slotsToDeleteDates,
                  });
                  setConfirmDeleteSlots(false);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMultipleSlots.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Schedule Dialog */}
      <Dialog open={isDeletingSchedule} onOpenChange={(open) => { if (!open) { setIsDeletingSchedule(false); setSelectedScheduleForDelete(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "ru" ? "Удалить расписание" : "Кестені жою"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Label>{language === "ru" ? "Выберите расписание для удаления" : "Жою үшін кестені таңдаңыз"}</Label>
            {schedules.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                {language === "ru" ? "Нет расписаний" : "Кестелер жоқ"}
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {schedules.map((schedule) => (
                  <Button
                    key={schedule.id}
                    variant="outline"
                    className="w-full justify-start gap-3 h-auto py-3"
                    onClick={() => {
                      setSelectedScheduleForDelete(schedule);
                      setConfirmDeleteSchedule(true);
                    }}
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      {schedule.event_type === "group" ? (
                        <Users className="w-4 h-4 text-primary" />
                      ) : (
                        <User className="w-4 h-4 text-primary" />
                      )}
                    </div>
                    <div className="text-left">
                      <p className="font-medium">{schedule.title}</p>
                      <p className="text-xs text-muted-foreground">{schedule.product?.title}</p>
                    </div>
                  </Button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Schedule AlertDialog */}
      <AlertDialog open={confirmDeleteSchedule} onOpenChange={setConfirmDeleteSchedule}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === "ru" ? "Удалить расписание?" : "Кестені жою керек пе?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === "ru" 
                ? `Вы уверены, что хотите удалить расписание "${selectedScheduleForDelete?.title}"? Все слоты и записи будут удалены. Это действие нельзя отменить.`
                : `"${selectedScheduleForDelete?.title}" кестесін жойғыңыз келетініне сенімдісіз бе? Барлық слоттар мен жазбалар жойылады. Бұл әрекетті болдырмау мүмкін емес.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedScheduleForDelete) {
                  deleteSchedule.mutate(selectedScheduleForDelete.id);
                  setConfirmDeleteSchedule(false);
                  setIsDeletingSchedule(false);
                  setSelectedScheduleForDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSchedule.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Schedule Title Dialog */}
      <Dialog open={!!editingSchedule} onOpenChange={(open) => {
        if (!open) {
          setEditingSchedule(null);
          setEditScheduleTitle("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === "ru" ? "Редактировать название" : "Атауын өңдеу"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>{language === "ru" ? "Название расписания" : "Кесте атауы"}</Label>
              <Input
                value={editScheduleTitle}
                onChange={(e) => setEditScheduleTitle(e.target.value)}
                placeholder={language === "ru" ? "Введите название" : "Атауын енгізіңіз"}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEditingSchedule(null);
                  setEditScheduleTitle("");
                }}
              >
                {t("cancel")}
              </Button>
              <Button
                onClick={() => {
                  if (editingSchedule && editScheduleTitle.trim()) {
                    updateScheduleTitle.mutate({
                      id: editingSchedule.id,
                      title: editScheduleTitle.trim(),
                    });
                  }
                }}
                disabled={!editScheduleTitle.trim() || updateScheduleTitle.isPending}
              >
                {updateScheduleTitle.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  t("save")
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Lesson Link Dialog (by dates) */}
      <Dialog open={isAddingLink} onOpenChange={(open) => { if (!open) { setIsAddingLink(false); setSelectedScheduleForLink(null); setSlotsForLinkDates([]); setAvailableDatesForLink([]); setLessonLinkUrl(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "ru" ? "Добавить ссылку на урок" : "Сабаққа сілтеме қосу"}</DialogTitle>
          </DialogHeader>
          
          {!selectedScheduleForLink ? (
            <div className="space-y-4 mt-4">
              <Label>{language === "ru" ? "Выберите расписание" : "Кестені таңдаңыз"}</Label>
              {schedules.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  {language === "ru" ? "Нет расписаний" : "Кестелер жоқ"}
                </p>
              ) : (
                <div className="space-y-4 max-h-80 overflow-y-auto">
                  {/* Individual schedules */}
                  {schedules.filter(s => s.event_type === "individual").length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <User className="w-4 h-4" />
                        {language === "ru" ? "Индивидуальные" : "Жеке сабақтар"}
                      </div>
                      {schedules.filter(s => s.event_type === "individual").map((schedule) => (
                        <Button
                          key={schedule.id}
                          variant="outline"
                          className="w-full justify-start gap-3 h-auto py-3"
                          onClick={() => {
                            setSelectedScheduleForLink(schedule);
                            fetchAvailableDatesForLink(schedule.id);
                            setSlotsForLinkDates([]);
                          }}
                        >
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-primary" />
                          </div>
                          <div className="text-left">
                            <p className="font-medium">{schedule.title}</p>
                            <p className="text-xs text-muted-foreground">{schedule.product?.title}</p>
                          </div>
                        </Button>
                      ))}
                    </div>
                  )}
                  
                  {/* Group schedules */}
                  {schedules.filter(s => s.event_type === "group").length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <Users className="w-4 h-4" />
                        {language === "ru" ? "Групповые" : "Топтық сабақтар"}
                      </div>
                      {schedules.filter(s => s.event_type === "group").map((schedule) => (
                        <Button
                          key={schedule.id}
                          variant="outline"
                          className="w-full justify-start gap-3 h-auto py-3"
                          onClick={() => {
                            setSelectedScheduleForLink(schedule);
                            fetchAvailableDatesForLink(schedule.id);
                            setSlotsForLinkDates([]);
                          }}
                        >
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Users className="w-4 h-4 text-primary" />
                          </div>
                          <div className="text-left">
                            <p className="font-medium">{schedule.title}</p>
                            <p className="text-xs text-muted-foreground">{schedule.product?.title}</p>
                          </div>
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mt-2 mb-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedScheduleForLink(null);
                    setSlotsForLinkDates([]);
                    setAvailableDatesForLink([]);
                    setLessonLinkUrl("");
                  }}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  {language === "ru" ? "Назад" : "Артқа"}
                </Button>
                <div className="flex items-center gap-2">
                  {selectedScheduleForLink.event_type === "group" ? (
                    <Users className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <User className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className="font-medium">{selectedScheduleForLink.title}</span>
                </div>
              </div>
              <div className="space-y-4">
                {availableDatesForLink.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    {language === "ru" ? "Нет слотов для добавления ссылки" : "Сілтеме қосуға слоттар жоқ"}
                  </p>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>{language === "ru" ? "Ссылка на урок" : "Сабаққа сілтеме"}</Label>
                      <Input
                        placeholder="https://zoom.us/j/..."
                        value={lessonLinkUrl}
                        onChange={(e) => setLessonLinkUrl(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{language === "ru" ? "Выберите даты" : "Күндерді таңдаңыз"}</Label>
                      <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 border rounded-md">
                        {availableDatesForLink.map((date) => {
                          const isSelected = slotsForLinkDates.includes(date);
                          return (
                            <Button
                              key={date}
                              type="button"
                              variant={isSelected ? "default" : "outline"}
                              size="sm"
                              onClick={() => {
                                if (isSelected) {
                                  setSlotsForLinkDates(slotsForLinkDates.filter(d => d !== date));
                                } else {
                                  setSlotsForLinkDates([...slotsForLinkDates, date]);
                                }
                              }}
                            >
                              {format(new Date(date), "d MMM", { locale: ru })}
                            </Button>
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {language === "ru" 
                          ? `Выбрано: ${slotsForLinkDates.length} из ${availableDatesForLink.length}` 
                          : `Таңдалды: ${slotsForLinkDates.length} / ${availableDatesForLink.length}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          if (slotsForLinkDates.length === availableDatesForLink.length) {
                            setSlotsForLinkDates([]);
                          } else {
                            setSlotsForLinkDates([...availableDatesForLink]);
                          }
                        }}
                      >
                        {slotsForLinkDates.length === availableDatesForLink.length 
                          ? (language === "ru" ? "Снять всё" : "Барлығын алу") 
                          : (language === "ru" ? "Выбрать все" : "Барлығын таңдау")}
                      </Button>
                    </div>
                  </>
                )}
                <div className="flex gap-2 pt-2 border-t">
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="flex-1" 
                    onClick={() => { setIsAddingLink(false); setSelectedScheduleForLink(null); setSlotsForLinkDates([]); setLessonLinkUrl(""); }}
                  >
                    {t("cancel")}
                  </Button>
                  <Button
                    type="button"
                    className="flex-1"
                    disabled={slotsForLinkDates.length === 0 || !lessonLinkUrl.trim() || addLessonLink.isPending}
                    onClick={() => {
                      if (selectedScheduleForLink && lessonLinkUrl.trim()) {
                        const isAll = slotsForLinkDates.length === availableDatesForLink.length;
                        addLessonLink.mutate({
                          scheduleId: selectedScheduleForLink.id,
                          dates: isAll ? "all" : slotsForLinkDates,
                          link: lessonLinkUrl.trim(),
                        });
                      }
                    }}
                  >
                    {addLessonLink.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (language === "ru" ? "Добавить" : "Қосу")}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* View/Edit Lesson Link Dialog */}
      <Dialog open={!!viewingLinkSlot} onOpenChange={(open) => { if (!open) setViewingLinkSlot(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "ru" ? "Ссылка на урок" : "Сабаққа сілтеме"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">
                {viewingLinkSlot?.date && format(new Date(viewingLinkSlot.date), "d MMMM", { locale: ru })}, {viewingLinkSlot?.start_time.slice(0, 5)} - {viewingLinkSlot?.end_time.slice(0, 5)}
              </p>
              <a 
                href={viewingLinkSlot?.lesson_link || "#"} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline break-all"
              >
                {viewingLinkSlot?.lesson_link}
              </a>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  if (viewingLinkSlot?.lesson_link) {
                    navigator.clipboard.writeText(viewingLinkSlot.lesson_link);
                    toast.success(language === "ru" ? "Ссылка скопирована!" : "Сілтеме көшірілді!");
                  }
                }}
              >
                <Copy className="w-4 h-4 mr-2" />
                {language === "ru" ? "Копировать" : "Көшіру"}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  const newLink = prompt(language === "ru" ? "Введите новую ссылку:" : "Жаңа сілтемені енгізіңіз:", viewingLinkSlot?.lesson_link || "");
                  if (newLink !== null && viewingLinkSlot) {
                    updateSlotLink.mutate({ slotId: viewingLinkSlot.id, link: newLink || null });
                    setViewingLinkSlot(null);
                  }
                }}
              >
                <Pencil className="w-4 h-4 mr-2" />
                {language === "ru" ? "Изменить" : "Өзгерту"}
              </Button>
            </div>
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => {
                if (viewingLinkSlot) {
                  updateSlotLink.mutate({ slotId: viewingLinkSlot.id, link: null });
                  setViewingLinkSlot(null);
                }
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {language === "ru" ? "Удалить ссылку" : "Сілтемені жою"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Reschedule Slot Dialog */}
      <RescheduleSlotDialog
        isOpen={!!reschedulingSlot}
        onClose={() => setReschedulingSlot(null)}
        onConfirm={async (data) => {
          if (!reschedulingSlot) return;
          try {
            await rescheduleSlotMutation.mutateAsync({
              slotId: reschedulingSlot.slot.id,
              scheduleId: reschedulingSlot.schedule.id,
              newDate: data.newDate,
              newStartTime: data.newStartTime,
              newEndTime: data.newEndTime,
              reasons: data.reasons,
              comment: data.comment,
              rescheduledBy: "teacher",
            });
            toast.success(language === "ru" ? "Урок перенесён!" : "Сабақ ауыстырылды!");
            setReschedulingSlot(null);
          } catch {
            toast.error(language === "ru" ? "Ошибка при переносе" : "Ауыстыру кезінде қате");
          }
        }}
        slot={reschedulingSlot?.slot || null}
        isPending={rescheduleSlotMutation.isPending}
      />
      {/* Edit Slot Time Dialog (unbooked) */}
      <EditSlotTimeDialog
        isOpen={!!editingSlotTime}
        onClose={() => setEditingSlotTime(null)}
        onConfirm={async (data) => {
          if (!editingSlotTime) return;
          try {
            await editSlotTimeMutation.mutateAsync({
              slotId: editingSlotTime.id,
              newStartTime: data.newStartTime,
              newEndTime: data.newEndTime,
            });
            toast.success(t("timeUpdated"));
            setEditingSlotTime(null);
          } catch {
            toast.error(language === "ru" ? "Ошибка" : "Қате");
          }
        }}
        slot={editingSlotTime}
        isPending={editSlotTimeMutation.isPending}
      />
    </div>
  );
};


export default TeacherScheduleTab;
