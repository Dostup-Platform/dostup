import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { Loader2, Calendar, ChevronLeft, ChevronRight, Plus, Trash2, Users, User, Clock, Pencil, UserPlus, Link, Copy, X, Settings2 } from "lucide-react";
import CancellationReasonDialog from "@/components/CancellationReasonDialog";
import RescheduleSlotDialog from "@/components/RescheduleSlotDialog";
import EditSlotTimeDialog from "@/components/EditSlotTimeDialog";
import { useCreatorProducts } from "@/hooks/useProducts";
import ProductSwitcher from "./ProductSwitcher";
import NoProductsEmptyState from "./NoProductsEmptyState";
import { useLanguage } from "@/contexts/LanguageContext";
import { creatorCreds, invokeApi } from "@/lib/sessionApi";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { 
  format, 
  addDays, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  addMonths, 
  isSameMonth, 
  isSameDay, 
  isToday, 
  parse, 
  parseISO 
} from "date-fns";
import { ru } from "date-fns/locale";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  user?: { name: string; phone?: string | null };
}

interface CreatorScheduleTabProps {
  creatorName: string;
  onGoToProducts?: () => void;
}

const CreatorScheduleTab = ({ creatorName, onGoToProducts }: CreatorScheduleTabProps) => {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [currentMonth, setCurrentMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [isDayScheduleDialogOpen, setIsDayScheduleDialogOpen] = useState(false);
  const [isAddingSchedule, setIsAddingSchedule] = useState(false);
  const [isAddingSlots, setIsAddingSlots] = useState(false);
  const [isManagingSlots, setIsManagingSlots] = useState(false);
  const [manageTab, setManageTab] = useState<"link" | "delete">("link");
  const [quickAddSlotHour, setQuickAddSlotHour] = useState<number | null>(null);
  const [quickAddParticipants, setQuickAddParticipants] = useState("1");
  const [quickAddLessonLink, setQuickAddLessonLink] = useState("");
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
    maxParticipants: "1",
  });

  // Fetch products
  const { data: products = [], isLoading: productsLoading } = useCreatorProducts(creatorName);
  const allProductIds = useMemo(() => products.map(p => p.id), [products]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedProductId && products.length > 0) {
      setSelectedProductId(products[0].id);
    }
    if (selectedProductId && !products.some(p => p.id === selectedProductId) && products.length > 0) {
      setSelectedProductId(products[0].id);
    }
  }, [products, selectedProductId]);
  const productIds = useMemo(() => selectedProductId ? [selectedProductId] : [], [selectedProductId]);

  // Fetch creator's own schedules (where teacher_id IS NULL)
  const { data: schedules = [], isLoading: schedulesLoading } = useQuery({
    queryKey: ["creator-own-schedules", productIds],
    queryFn: async () => {
      if (!productIds.length) return [];
      const data = await invokeApi<{ schedules: Schedule[] }>("manage-schedules", {
        action: "list_schedules",
        ...creatorCreds(),
        productIds,
        creatorOnly: true,
      });
      return data.schedules ?? [];
    },
    enabled: productIds.length > 0,
  });

  const scheduleIds = useMemo(() => schedules.map(s => s.id), [schedules]);

  // Week bounds & days
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);
  const weekEnd = useMemo(() => addDays(currentWeekStart, 6), [currentWeekStart]);

  // Month bounds & calendar days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = useMemo(() => eachDayOfInterval({ start: calendarStart, end: calendarEnd }), [calendarStart, calendarEnd]);

  const queryRange = useMemo(() => {
    if (viewMode === "week") {
      return {
        from: format(currentWeekStart, "yyyy-MM-dd"),
        to: format(weekEnd, "yyyy-MM-dd"),
      };
    } else {
      return {
        from: format(calendarStart, "yyyy-MM-dd"),
        to: format(calendarEnd, "yyyy-MM-dd"),
      };
    }
  }, [viewMode, currentWeekStart, weekEnd, calendarStart, calendarEnd]);

  // Fetch time slots for visible range
  const { data: timeSlots = [], isLoading: slotsLoading } = useQuery({
    queryKey: ["creator-slots", scheduleIds, queryRange.from, queryRange.to],
    queryFn: async () => {
      if (!scheduleIds.length) return [];
      const data = await invokeApi<{ slots: TimeSlot[] }>("manage-schedules", {
        action: "list_slots",
        ...creatorCreds(),
        scheduleIds,
        fromDate: queryRange.from,
        toDate: queryRange.to,
      });
      return data.slots ?? [];
    },
    enabled: scheduleIds.length > 0,
  });

  // Fetch bookings for time slots
  const slotIds = useMemo(() => timeSlots.map(s => s.id), [timeSlots]);
  const { data: bookings = [] } = useQuery({
    queryKey: ["creator-bookings", slotIds],
    queryFn: async () => {
      if (!slotIds.length) return [];
      const data = await invokeApi<{ bookings: Booking[] }>("manage-schedules", {
        action: "list_bookings_for_slots",
        ...creatorCreds(),
        slotIds,
      });
      return data.bookings ?? [];
    },
    enabled: slotIds.length > 0,
  });

  const invalidateSlotsAndBookings = () => {
    queryClient.invalidateQueries({ queryKey: ["creator-slots"] });
    queryClient.invalidateQueries({ queryKey: ["creator-bookings"] });
    queryClient.invalidateQueries({ queryKey: ["creator-month-slots"] });
    queryClient.invalidateQueries({ queryKey: ["creator-month-bookings"] });
    queryClient.invalidateQueries({ queryKey: ["creator-week-slots"] });
    queryClient.invalidateQueries({ queryKey: ["creator-week-bookings"] });
  };

  // Fetch pending outgoing reschedule requests (creator -> student)
  const { data: outgoingReschedules = [] } = useQuery({
    queryKey: ["creator-outgoing-reschedules", productIds],
    queryFn: async () => {
      if (!productIds.length) return [];
      const data = await invokeApi<{ requests: { id: string; booking_id: string; new_date: string; new_time: string; status: string }[] }>("manage-schedules", {
        action: "list_outgoing_reschedules",
        ...creatorCreds(),
      });
      return data.requests ?? [];
    },
    enabled: productIds.length > 0,
  });

  const cancelOutgoingReschedule = useMutation({
    mutationFn: async (requestId: string) => {
      await invokeApi("manage-bookings", {
        action: "cancel_reschedule_request",
        ...creatorCreds(),
        requestId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-outgoing-reschedules"] });
      toast.success(language === "ru" ? "Запрос на перенос отменён" : "Ауыстыру сұранысы жойылды");
    },
  });

  // Create schedule mutation
  const createSchedule = useMutation({
    mutationFn: async () => {
      const activeProductId = scheduleForm.productId || selectedProductId || "";
      if (!activeProductId) throw new Error(language === "ru" ? "Выберите продукт" : "Өнімді таңдаңыз");
      const data = await invokeApi<{ schedule: Schedule }>("manage-schedules", {
        action: "create_schedule",
        ...creatorCreds(),
        productId: activeProductId,
        title: scheduleForm.title.trim(),
        eventType: "individual",
        maxParticipants: null,
      });
      return data.schedule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-own-schedules"] });
      toast.success(language === "ru" ? "Расписание создано!" : "Кесте жасалды!");
      setIsAddingSchedule(false);
      setScheduleForm({ title: "", productId: "", maxParticipants: "10" });
    },
    onError: (error: any) => {
      console.error("Schedule creation error:", error);
      toast.error(error?.message || (language === "ru" ? "Ошибка при создании" : "Жасау кезінде қате"));
    },
  });

  // Delete schedule mutation
  const deleteSchedule = useMutation({
    mutationFn: async (id: string) => {
      await invokeApi("manage-schedules", {
        action: "delete_schedule",
        ...creatorCreds(),
        id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-own-schedules"] });
      toast.success(language === "ru" ? "Расписание удалено!" : "Кесте жойылды!");
      setDeletingSchedule(null);
    },
    onError: () => toast.error(language === "ru" ? "Ошибка при удалении" : "Жою кезінде қате"),
  });

  // Update schedule title mutation
  const updateScheduleTitle = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      await invokeApi("manage-schedules", {
        action: "update_schedule",
        ...creatorCreds(),
        id,
        updates: { title },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-own-schedules"] });
      toast.success(language === "ru" ? "Название обновлено!" : "Атауы жаңартылды!");
      setEditingSchedule(null);
      setEditScheduleTitle("");
    },
    onError: () => toast.error(language === "ru" ? "Ошибка при обновлении" : "Жаңарту кезінде қате"),
  });

  const ensureScheduleId = async (): Promise<string> => {
    if (schedules.length > 0) return schedules[0].id;
    const activeProductId = selectedProductId || "";
    if (!activeProductId) throw new Error(language === "ru" ? "Выберите продукт" : "Өнімді таңдаңыз");
    const data = await invokeApi<{ schedule: Schedule }>("manage-schedules", {
      action: "create_schedule",
      ...creatorCreds(),
      productId: activeProductId,
      title: language === "ru" ? "Расписание" : "Кесте",
      eventType: "individual",
      maxParticipants: null,
    });
    queryClient.invalidateQueries({ queryKey: ["creator-own-schedules"] });
    return data.schedule.id;
  };

  // Create time slots mutation
  const createTimeSlots = useMutation({
    mutationFn: async () => {
      const scheduleId = selectedScheduleForSlots?.id || (await ensureScheduleId());
      
      const startDate = new Date(slotsForm.startDate);
      const endDate = new Date(slotsForm.endDate);
      const duration = Number(slotsForm.slotDuration);
      const breakTime = Number(slotsForm.breakDuration);
      const participants = Math.max(1, parseInt(slotsForm.maxParticipants, 10) || 1);
      
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
          
          const exists = timeSlots.some(
            (s) => s.date === dateStr && parseInt(s.start_time.split(":")[0], 10) === parseInt(slotStart.split(":")[0], 10)
          );
          if (!exists) {
            slots.push({
              schedule_id: scheduleId,
              date: dateStr,
              start_time: slotStart,
              end_time: slotEnd,
              is_available: true,
              max_participants: participants,
            });
          }
          
          if (breakTime > 0) {
            currentTime = new Date(currentTime.getTime() + breakTime * 60000);
          }
        }
        
        currentDate = addDays(currentDate, 1);
      }

      if (slots.length === 0) {
        throw new Error(language === "ru" ? "На выбранное время слоты уже существуют" : "Таңдалған уақытқа слоттар бар");
      }

      await invokeApi("manage-schedules", {
        action: "create_slots",
        ...creatorCreds(),
        slots,
        scheduleId: scheduleId,
      });
      return slots.length;
    },
    onSuccess: (count) => {
      invalidateSlotsAndBookings();
      queryClient.invalidateQueries({ queryKey: ["creator-own-schedules"] });
      toast.success(language === "ru" ? `Создано ${count} слотов!` : `${count} слот жасалды!`);
      setIsAddingSlots(false);
      setSelectedScheduleForSlots(null);
    },
    onError: (error: any) => {
      console.error("Slot creation error:", error);
      toast.error(error?.message || (language === "ru" ? "Ошибка при создании слотов" : "Слоттарды жасау кезінде қате"));
    },
  });

  // Create single slot mutation for a specific hour
  const createSingleSlot = useMutation({
    mutationFn: async ({ hour, participants, link }: { hour: number; participants: number; link?: string }) => {
      const scheduleId = schedules[0]?.id || (await ensureScheduleId());
      if (!selectedDate) throw new Error("No date selected");
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const startH = String(hour).padStart(2, "0");
      const startTime = `${startH}:00:00`;
      const endHour = (hour + 1) % 24;
      const endTime = `${String(endHour).padStart(2, "0")}:00:00`;

      // Strictly allow only 1 slot per time interval
      const alreadyExists = timeSlots.some(
        (s) => s.date === dateStr && parseInt(s.start_time.split(":")[0], 10) === hour
      );
      if (alreadyExists) {
        throw new Error(language === "ru" ? "На это время уже есть слот!" : "Бұл уақытқа слот бар!");
      }

      await invokeApi("manage-schedules", {
        action: "create_slots",
        ...creatorCreds(),
        slots: [{
          schedule_id: scheduleId,
          date: dateStr,
          start_time: startTime,
          end_time: endTime,
          is_available: true,
          max_participants: participants,
        }],
        scheduleId,
      });

      if (link?.trim()) {
        await invokeApi("manage-schedules", {
          action: "set_lesson_link",
          ...creatorCreds(),
          scheduleId,
          dates: [dateStr],
          link: link.trim(),
        });
      }
    },
    onSuccess: () => {
      invalidateSlotsAndBookings();
      queryClient.invalidateQueries({ queryKey: ["creator-own-schedules"] });
      toast.success(language === "ru" ? "Слот создан!" : "Слот жасалды!");
      setQuickAddSlotHour(null);
      setQuickAddParticipants("1");
      setQuickAddLessonLink("");
    },
    onError: (err: any) => {
      toast.error(err?.message || (language === "ru" ? "Ошибка при создании слота" : "Слот жасау кезінде қате"));
    },
  });

  // Cancel booking mutation using shared hook
  const creatorCancelBooking = useMutation({
    mutationFn: async ({ bookingId, cancelledBy, reasons, comment }: {
      bookingId: string;
      cancelledBy: "creator" | "teacher";
      reasons?: string[];
      comment?: string;
    }) => {
      await invokeApi("manage-bookings", {
        action: "cancel",
        ...creatorCreds(),
        bookingId,
        cancelledBy,
        reasons,
        comment,
      });
    },
    onSuccess: () => {
      invalidateSlotsAndBookings();
    },
  });
  const rescheduleRequestMutation = useMutation({
    mutationFn: async ({
      slotId,
      scheduleId,
      newDate,
      newStartTime,
      newEndTime,
      reasons,
      comment,
    }: {
      slotId: string;
      scheduleId: string;
      newDate: string;
      newStartTime: string;
      newEndTime: string;
      reasons: string[];
      comment: string;
      requestedBy: "creator" | "teacher";
    }) => {
      await invokeApi("manage-bookings", {
        action: "create_reschedule_request",
        ...creatorCreds(),
        slotId,
        scheduleId,
        newDate,
        newStartTime,
        newEndTime,
        reasons,
        comment,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-outgoing-reschedules"] });
      invalidateSlotsAndBookings();
    },
  });
  const editSlotTimeMutation = useMutation({
    mutationFn: async ({
      slotId,
      newStartTime,
      newEndTime,
      maxParticipants,
    }: {
      slotId: string;
      newStartTime: string;
      newEndTime: string;
      maxParticipants?: number;
    }) => {
      await invokeApi("manage-schedules", {
        action: "update_slot",
        ...creatorCreds(),
        slotId,
        updates: {
          start_time: newStartTime,
          end_time: newEndTime,
          ...(maxParticipants !== undefined ? { max_participants: maxParticipants } : {}),
        },
      });
    },
    onSuccess: () => {
      invalidateSlotsAndBookings();
    },
  });

  const handleCancelBookingWithReason = async (reasons: string[], comment: string) => {
    if (!cancelingBooking) return;
    try {
      await creatorCancelBooking.mutateAsync({
        bookingId: cancelingBooking.id,
        cancelledBy: "creator",
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
      await invokeApi("manage-schedules", {
        action: "delete_slot",
        ...creatorCreds(),
        slotId,
      });
    },
    onSuccess: () => {
      invalidateSlotsAndBookings();
      toast.success(language === "ru" ? "Слот удалён!" : "Слот жойылды!");
      setDeletingSlot(null);
    },
    onError: () => toast.error(language === "ru" ? "Ошибка при удалении" : "Жою кезінде қате"),
  });

  // Delete time slot with bookings (force delete)
  const deleteSlotWithBookings = useMutation({
    mutationFn: async ({ slotId, reasons, comment }: { slotId: string; reasons: string[]; comment: string }) => {
      await invokeApi("manage-schedules", {
        action: "delete_slot_with_bookings",
        ...creatorCreds(),
        slotId,
        reasons,
        comment,
      });
    },
    onSuccess: () => {
      invalidateSlotsAndBookings();
      toast.success(language === "ru" ? "Слот и записи удалены!" : "Слот пен жазбалар жойылды!");
      setDeletingSlotWithBookings(null);
    },
    onError: () => toast.error(language === "ru" ? "Ошибка при удалении" : "Жою кезінде қате"),
  });

  // Expand slot (increase max_participants for specific slot)
  const expandSlot = useMutation({
    mutationFn: async ({ slot, schedule }: { slot: TimeSlot; schedule: Schedule }) => {
      const currentMax = slot.max_participants ?? schedule.max_participants ?? 1;
      const newMax = currentMax + 1;
      await invokeApi("manage-schedules", {
        action: "update_slot",
        ...creatorCreds(),
        slotId: slot.id,
        updates: { max_participants: newMax },
      });
      return newMax;
    },
    onSuccess: (newMax) => {
      invalidateSlotsAndBookings();
      toast.success(language === "ru" ? `Слот расширен до ${newMax} мест!` : `Слот ${newMax} орынға дейін кеңейтілді!`);
      setExpandingSlot(null);
    },
    onError: () => toast.error(language === "ru" ? "Ошибка при расширении" : "Кеңейту кезінде қате"),
  });

  // Delete multiple time slots mutation
  const deleteMultipleSlots = useMutation({
    mutationFn: async ({ scheduleId, dates }: { scheduleId: string; dates: string[] | "all" }) => {
      await invokeApi("manage-schedules", {
        action: "delete_slots",
        ...creatorCreds(),
        scheduleId,
        dates,
      });
    },
    onSuccess: () => {
      invalidateSlotsAndBookings();
      toast.success(language === "ru" ? "Слоты удалены!" : "Слоттар жойылды!");
      setIsDeletingSlots(false);
      setSelectedScheduleForDelete(null);
      setSlotsToDeleteDates([]);
    },
    onError: () => toast.error(language === "ru" ? "Ошибка при удалении" : "Жою кезінде қате"),
  });

  // Fetch available dates for delete dialog
  const fetchAvailableDates = async (scheduleId: string) => {
    const data = await invokeApi<{ dates: string[] }>("manage-schedules", {
      action: "list_slot_dates",
      ...creatorCreds(),
      scheduleId,
    });
    setAvailableDatesForDelete(data.dates ?? []);
  };

  // Fetch available dates for link dialog
  const fetchAvailableDatesForLink = async (scheduleId: string) => {
    const data = await invokeApi<{ dates: string[] }>("manage-schedules", {
      action: "list_slot_dates",
      ...creatorCreds(),
      scheduleId,
    });
    setAvailableDatesForLink(data.dates ?? []);
  };

  // Add lesson link mutation
  const addLessonLink = useMutation({
    mutationFn: async ({ scheduleId, dates, link }: { scheduleId: string; dates: string[] | "all"; link: string }) => {
      await invokeApi("manage-schedules", {
        action: "set_lesson_link",
        ...creatorCreds(),
        scheduleId,
        dates,
        link,
      });
    },
    onSuccess: () => {
      invalidateSlotsAndBookings();
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
      await invokeApi("manage-schedules", {
        action: "update_slot",
        ...creatorCreds(),
        slotId,
        updates: { lesson_link: link },
      });
    },
    onSuccess: () => {
      invalidateSlotsAndBookings();
      toast.success(language === "ru" ? "Ссылка обновлена!" : "Сілтеме жаңартылды!");
    },
    onError: () => toast.error(language === "ru" ? "Ошибка при обновлении ссылки" : "Сілтемені жаңарту кезінде қате"),
  });

  const displayHours = useMemo(() => {
    const hours: number[] = [];
    const hasEarlySlot = timeSlots.some((s) => {
      const h = parseInt(s.start_time.split(":")[0], 10);
      return h < 5;
    });
    const startHour = hasEarlySlot ? 0 : 5;
    for (let h = startHour; h < 24; h++) {
      hours.push(h);
    }
    return hours;
  }, [timeSlots]);

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
    const maxParticipants = slot?.max_participants ?? (schedule?.event_type === "group" ? (schedule.max_participants ?? 1) : 1);
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

  const bookedSlotsInMonth = useMemo(() => {
    const monthPrefix = format(currentMonth, "yyyy-MM");
    return timeSlots
      .filter((slot) => {
        if (!slot.date.startsWith(monthPrefix)) return false;
        const b = getBookingsForSlot(slot.id);
        return b.length > 0;
      })
      .sort((a, b) => {
        const cmpDate = a.date.localeCompare(b.date);
        if (cmpDate !== 0) return cmpDate;
        return a.start_time.localeCompare(b.start_time);
      });
  }, [timeSlots, bookings, currentMonth]);

  const renderHourlySchedule = () => {
    if (!selectedDate) return null;

    return (
      <div className="space-y-2.5">
        {displayHours.map((h) => {
          const hourSlots = selectedDateSlots.filter((s) => {
            const startH = parseInt(s.start_time.split(":")[0], 10);
            return startH === h;
          });

          const hourLabel = `${h}:00 – ${h + 1 === 24 ? "00:00" : `${h + 1}:00`}`;
          const shortLabel = `${h}–${h + 1 === 24 ? "0" : h + 1}`;

          if (hourSlots.length === 0) {
            return (
              <div
                key={h}
                className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg border border-dashed border-border/70 bg-muted/20 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="font-semibold text-xs sm:text-sm w-24 sm:w-28 text-foreground">
                    {hourLabel}
                  </div>
                  <Badge variant="outline" className="text-[10px] sm:text-[11px] font-normal text-muted-foreground border-muted-foreground/30">
                    {shortLabel}
                  </Badge>
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    {language === "ru" ? "Свободное время" : "Бос уақыт"}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1 text-primary hover:text-primary hover:bg-primary/10"
                  onClick={() => {
                    setQuickAddSlotHour(h);
                    setQuickAddParticipants("1");
                    setQuickAddLessonLink("");
                  }}
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-xs font-medium">{language === "ru" ? "Слот" : "Слот"}</span>
                </Button>
              </div>
            );
          }

          return (
            <div key={h} className="p-3 rounded-xl border border-border bg-card space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="font-semibold text-xs sm:text-sm w-24 sm:w-28 text-foreground">
                    {hourLabel}
                  </div>
                  <Badge variant="secondary" className="text-[10px] sm:text-[11px] font-medium">
                    {shortLabel}
                  </Badge>
                </div>
                {/* No + button here: only 1 slot per time interval */}
              </div>

              <div className="space-y-2 pt-1">
                {hourSlots.map((slot) => {
                  const slotBookings = getBookingsForSlot(slot.id);
                  const slotStatus = getSlotStatus(slot.id);
                  const schedule = getScheduleForSlot(slot.id);
                  const maxParticipants = slot.max_participants ?? (schedule?.event_type === "group" ? (schedule.max_participants ?? 1) : 1);
                  const isGroup = maxParticipants > 1;

                  const getSlotStyles = () => {
                    switch (slotStatus) {
                      case "full": return { bg: "bg-green-50/80 dark:bg-green-950/20 border border-green-200 dark:border-green-900/50", dot: "bg-green-500", text: "text-green-700 dark:text-green-300" };
                      case "partial": return { bg: "bg-orange-50/80 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/50", dot: "bg-orange-500", text: "text-orange-700 dark:text-orange-300" };
                      case "free": return { bg: "bg-red-50/60 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50", dot: "bg-red-500", text: "text-red-700 dark:text-red-300" };
                    }
                  };

                  const styles = getSlotStyles();

                  return (
                    <div
                      key={slot.id}
                      className={`p-2.5 rounded-lg ${styles.bg}`}
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${styles.dot}`} />
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold">
                              {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                            </span>
                            {schedules.length > 1 && schedule && (
                              <span className="text-[10px] text-muted-foreground leading-tight">
                                {schedule.title}
                              </span>
                            )}
                          </div>
                          {isGroup ? (
                            <Badge variant="outline" className="text-[11px] font-medium ml-1">
                              {slotBookings.length}/{maxParticipants} {language === "ru" ? "мест" : "орын"}
                            </Badge>
                          ) : (
                            <span className={`text-xs ${styles.text}`}>
                              {slotBookings.length > 0
                                ? (language === "ru" ? "Занято" : "Жазылған")
                                : (language === "ru" ? "Свободно" : "Бос")}
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
                          {isGroup && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-primary hover:text-primary hover:bg-primary/10"
                              onClick={() => setExpandingSlot({ slot, schedule: schedule || (schedules[0] as Schedule) })}
                              title={language === "ru" ? "Добавить место" : "Орын қосу"}
                            >
                              <UserPlus className="w-4 h-4" />
                            </Button>
                          )}

                          {/* Delete slot button */}
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

                      {/* List of bookings */}
                      {slotBookings.length > 0 && (
                        <div className="mt-2 space-y-1 pl-4 border-l-2 border-primary/20">
                          {slotBookings.map((booking) => (
                            <div key={booking.id}>
                              <div className="flex items-center justify-between py-1 px-2 bg-background/50 rounded">
                                <span className={`text-sm ${styles.text}`}>
                                  {booking.user?.name || "—"}
                                </span>
                              </div>
                              {(() => {
                                const pendingReq = outgoingReschedules.find(r => r.booking_id === booking.id);
                                if (!pendingReq) return null;
                                return (
                                  <div className="mt-1 flex items-center gap-2 px-2">
                                    <span className="text-orange-500 text-sm font-medium">
                                      {language === "ru" 
                                        ? `Ожидание подтверждения переноса на ${format(parseISO(pendingReq.new_date), "d MMM", { locale: ru })} ${pendingReq.new_time?.slice(0, 5)}`
                                        : `Ауыстыруды растау күтілуде ${format(parseISO(pendingReq.new_date), "d MMM", { locale: ru })} ${pendingReq.new_time?.slice(0, 5)}`}
                                    </span>
                                    <button
                                      className="text-orange-500 hover:text-destructive p-0.5 rounded"
                                      onClick={() => cancelOutgoingReschedule.mutate(pendingReq.id)}
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                );
                              })()}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const isLoading = productsLoading || schedulesLoading || slotsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (productIds.length === 0) {
    if (allProductIds.length === 0) {
      return <NoProductsEmptyState section="schedule" onGoToProducts={onGoToProducts} />;
    }
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">
        {language === "kk" ? "Кесте" : "Расписание"}
      </h2>

      {/* Top Bar: Product Switcher & Actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <ProductSwitcher
          products={products.map((p) => ({ id: p.id, title: p.title }))}
          selectedId={selectedProductId}
          onChange={setSelectedProductId}
        />
        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Switcher: Неделя | Месяц */}
          <div className="inline-flex items-center rounded-lg bg-muted p-1 text-muted-foreground">
            <button
              type="button"
              onClick={() => {
                setViewMode("week");
                if (selectedDate) setCurrentWeekStart(startOfWeek(selectedDate, { weekStartsOn: 1 }));
              }}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                viewMode === "week"
                  ? "bg-background text-foreground shadow-sm"
                  : "hover:text-foreground"
              }`}
            >
              {language === "kk" ? "Апта" : "Неделя"}
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode("month");
                if (selectedDate) setCurrentMonth(startOfMonth(selectedDate));
              }}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                viewMode === "month"
                  ? "bg-background text-foreground shadow-sm"
                  : "hover:text-foreground"
              }`}
            >
              {language === "kk" ? "Ай" : "Месяц"}
            </button>
          </div>

          <Button 
            size="sm"
            onClick={() => {
              setSelectedScheduleForSlots(schedules[0] || null);
              setSlotsForm((prev) => ({
                ...prev,
                startDate: format(selectedDate || new Date(), "yyyy-MM-dd"),
                endDate: format(addDays(selectedDate || new Date(), 7), "yyyy-MM-dd"),
                maxParticipants: "1",
              }));
              setIsAddingSlots(true);
            }}
            className="gap-1.5"
          >
            <Plus className="w-4 h-4" />
            {language === "ru" ? "Слоты" : "Слоттар"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const targetSchedule = schedules[0];
              if (targetSchedule) {
                setSelectedScheduleForDelete(targetSchedule);
                fetchAvailableDates(targetSchedule.id);
                setSelectedScheduleForLink(targetSchedule);
                fetchAvailableDatesForLink(targetSchedule.id);
              }
              setIsManagingSlots(true);
            }}
            className="gap-1.5"
          >
            <Settings2 className="w-4 h-4" />
            {language === "ru" ? "Управлять" : "Басқару"}
          </Button>
        </div>
      </div>

      {/* Week Calendar Mode */}
      {viewMode === "week" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">
                {t("weeklySchedule")}
              </CardTitle>
              <div className="flex items-center gap-1 sm:gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    const newStart = addDays(currentWeekStart, -7);
                    setCurrentWeekStart(newStart);
                    setSelectedDate(newStart);
                  }}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs sm:text-sm font-medium min-w-[140px] text-center">
                  {format(currentWeekStart, "d MMM", { locale: ru })} – {format(weekEnd, "d MMM yyyy", { locale: ru })}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    const newStart = addDays(currentWeekStart, 7);
                    setCurrentWeekStart(newStart);
                    setSelectedDate(newStart);
                  }}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2.5 text-xs ml-1"
                  onClick={() => {
                    const today = new Date();
                    setCurrentWeekStart(startOfWeek(today, { weekStartsOn: 1 }));
                    setSelectedDate(today);
                  }}
                >
                  {language === "ru" ? "Сегодня" : "Бүгін"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {weekDays.map((day) => {
                const dayKey = format(day, "yyyy-MM-dd");
                const daySlots = getSlotsForDay(day);
                const bookedSessionsCount = daySlots.filter((slot) =>
                  bookings.some((b) => b.time_slot_id === slot.id)
                ).length;
                const isSelected = selectedDate && isSameDay(selectedDate, day);
                const isTodayDate = isToday(day);
                const hasSlots = daySlots.length > 0;
                const dayStatus = getDayStatus(day);

                return (
                  <button
                    key={dayKey}
                    type="button"
                    onClick={() => setSelectedDate(day)}
                    className={`p-2 sm:p-2.5 rounded-xl text-center transition-all relative border flex flex-col justify-between items-center min-h-[56px] sm:min-h-[68px] ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : isTodayDate
                          ? "bg-primary/5 border-primary/40 text-foreground font-semibold hover:bg-primary/10"
                          : "bg-card border-border/40 text-foreground hover:bg-muted/60"
                    }`}
                  >
                    <div className={`text-xs font-semibold ${isSelected ? "text-primary-foreground/90" : "text-muted-foreground"}`}>
                      {format(day, "EEE", { locale: ru })}
                    </div>
                    <div className={`text-sm sm:text-base font-bold my-0.5 ${isSelected ? "text-primary-foreground" : "text-foreground"}`}>
                      {format(day, "d")}
                    </div>
                    <div className="flex items-center justify-center gap-1 min-h-[14px]">
                      {hasSlots && (
                        <span
                          className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${
                            dayStatus === "full"
                              ? "bg-green-500"
                              : dayStatus === "partial"
                                ? "bg-orange-500"
                                : "bg-red-500"
                          } ${isSelected ? "ring-1 ring-white/90" : ""}`}
                        />
                      )}
                      {bookedSessionsCount > 0 && (
                        <span className={`text-[10px] sm:text-xs font-bold ${isSelected ? "text-white" : "text-green-600 dark:text-green-400"}`}>
                          {bookedSessionsCount}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Week Calendar: Hourly Schedule Directly Underneath */}
      {viewMode === "week" && selectedDate && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2 capitalize">
                <Clock className="w-4 h-4 text-primary" />
                {(() => {
                  const dayTitle = format(selectedDate, "EEEE, d MMMM", { locale: ru });
                  return dayTitle.charAt(0).toUpperCase() + dayTitle.slice(1);
                })()}
              </CardTitle>
              <Badge variant="secondary">
                {selectedDateSlots.length} {language === "ru" ? "слотов" : "слот"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {renderHourlySchedule()}
          </CardContent>
        </Card>
      )}

      {/* Month Calendar Mode */}
      {viewMode === "month" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold capitalize">
                {format(currentMonth, "LLLL yyyy", { locale: ru })}
              </CardTitle>
              <div className="flex items-center gap-1 sm:gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentMonth((prev) => addMonths(prev, -1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs sm:text-sm font-medium min-w-[130px] text-center capitalize">
                  {format(currentMonth, "LLLL yyyy", { locale: ru })}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2.5 text-xs ml-1"
                  onClick={() => {
                    const today = new Date();
                    setCurrentMonth(startOfMonth(today));
                    setSelectedDate(today);
                  }}
                >
                  {language === "ru" ? "Сегодня" : "Бүгін"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 mb-2 text-center">
              {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((wd, i) => (
                <div key={wd} className={`text-xs font-semibold py-1 ${i >= 5 ? "text-muted-foreground/70" : "text-muted-foreground"}`}>
                  {wd}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {calendarDays.map((day) => {
                const dayKey = format(day, "yyyy-MM-dd");
                const daySlots = getSlotsForDay(day);
                const bookedSessionsCount = daySlots.filter((slot) =>
                  bookings.some((b) => b.time_slot_id === slot.id)
                ).length;
                const isSelected = selectedDate && isSameDay(selectedDate, day);
                const isTodayDate = isToday(day);
                const inMonth = isSameMonth(day, currentMonth);
                const hasSlots = daySlots.length > 0;
                const dayStatus = getDayStatus(day);

                return (
                  <button
                    key={dayKey}
                    type="button"
                    onClick={() => {
                      setSelectedDate(day);
                      setIsDayScheduleDialogOpen(true);
                    }}
                    className={`min-h-[56px] sm:min-h-[68px] p-1.5 rounded-xl flex flex-col justify-between items-center transition-all relative border text-center ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : isTodayDate
                          ? "bg-primary/5 border-primary/40 text-foreground font-semibold hover:bg-primary/10"
                          : inMonth
                            ? "bg-card border-border/40 text-foreground hover:bg-muted/60"
                            : "bg-muted/10 border-transparent text-muted-foreground/40 hover:bg-muted/30"
                    }`}
                  >
                    <span className={`text-sm sm:text-base font-semibold ${isSelected ? "text-primary-foreground" : ""}`}>
                      {format(day, "d")}
                    </span>
                    
                    {/* Indicators */}
                    <div className="flex flex-col items-center gap-0.5 w-full">
                      {hasSlots && (
                        <div className="flex items-center justify-center gap-1">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              dayStatus === "full"
                                ? "bg-green-500"
                                : dayStatus === "partial"
                                  ? "bg-orange-500"
                                  : "bg-red-500"
                            } ${isSelected ? "ring-1 ring-white/90" : ""}`}
                          />
                          {bookedSessionsCount > 0 && (
                            <span className={`text-[10px] font-bold ${isSelected ? "text-white" : "text-green-600 dark:text-green-400"}`}>
                              {bookedSessionsCount}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Month Calendar: Booked Sessions Card */}
      {viewMode === "month" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                {language === "ru" ? "Записи на этот месяц" : "Бұл айдағы жазбалар"}
              </CardTitle>
              <Badge variant="secondary">
                {bookedSlotsInMonth.length} {language === "ru" ? "занятий" : "сабақ"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {bookedSlotsInMonth.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {language === "ru" ? "В этом месяце пока нет записей" : "Бұл айда әзірге жазбалар жоқ"}
              </div>
            ) : (
              <div className="space-y-2.5">
                {bookedSlotsInMonth.map((slot) => {
                  const slotBookings = getBookingsForSlot(slot.id);
                  const schedule = getScheduleForSlot(slot.id);
                  const maxParticipants = slot.max_participants ?? (schedule?.event_type === "group" ? (schedule.max_participants ?? 1) : 1);
                  const isGroup = maxParticipants > 1;
                  const slotDateObj = parseISO(slot.date);
                  const formattedDate = format(slotDateObj, "d MMMM, EEEE", { locale: ru });
                  const timeLabel = `${slot.start_time.slice(0, 5)} – ${slot.end_time.slice(0, 5)}`;

                  return (
                    <div
                      key={slot.id}
                      className="p-3 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors space-y-2"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green-500" />
                          <span className="font-semibold text-sm capitalize">{formattedDate}</span>
                          <Badge variant="outline" className="text-xs">
                            {timeLabel}
                          </Badge>
                          {isGroup ? (
                            <Badge variant="secondary" className="text-[11px]">
                              {slotBookings.length}/{maxParticipants} {language === "ru" ? "группа" : "топ"}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[11px]">
                              {language === "ru" ? "Индивидуально" : "Жеке"}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
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
                            title={slot.lesson_link ? (language === "ru" ? "Ссылка на урок" : "Сабаққа сілтеме") : (language === "ru" ? "Добавить ссылку" : "Сілтеме қосу")}
                          >
                            <Link className="w-4 h-4" />
                          </Button>
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
                            title={language === "ru" ? "Удалить слот и отменить записи" : "Слотты жою"}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Student list */}
                      <div className="space-y-1 pl-4 pt-1 border-t border-border/50">
                        {slotBookings.map((b) => (
                          <div key={b.id} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-muted/40">
                            <span className="font-medium text-foreground">{b.user?.name || "—"}</span>
                            {b.user?.phone && (
                              <span className="text-muted-foreground text-[11px]">{b.user.phone}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Day Schedule Dialog for Month View */}
      <Dialog open={isDayScheduleDialogOpen} onOpenChange={setIsDayScheduleDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2 capitalize">
              <Clock className="w-4 h-4 text-primary" />
              {selectedDate && format(selectedDate, "EEEE, d MMMM yyyy", { locale: ru })}
            </DialogTitle>
          </DialogHeader>
          <div className="pt-2">
            {renderHourlySchedule()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Schedule Dialog */}
      <Dialog 
        open={isAddingSchedule} 
        onOpenChange={(open) => {
          if (open) {
            setScheduleForm((prev) => ({ ...prev, productId: selectedProductId || "" }));
          }
          setIsAddingSchedule(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "ru" ? "Создать расписание" : "Кесте жасау"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createSchedule.mutate(); }} className="space-y-4 mt-4">
            <div className="text-sm text-muted-foreground">
              {language === "ru" ? "Продукт" : "Өнім"}:{" "}
              <span className="font-medium text-foreground">
                {products.find(p => p.id === selectedProductId)?.title}
              </span>
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
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setIsAddingSchedule(false)}>
                {t("cancel")}
              </Button>
              <Button 
                type="submit" 
                className="flex-1" 
                disabled={createSchedule.isPending || !(scheduleForm.productId || selectedProductId) || !scheduleForm.title.trim()}
              >
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
            <DialogTitle>{language === "ru" ? "Добавить слоты" : "Слоттар қосу"}</DialogTitle>
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
            <div className="space-y-2">
              <Label>{language === "ru" ? "Количество участников" : "Қатысушылар саны"}</Label>
              <Input
                type="number"
                min="1"
                value={slotsForm.maxParticipants}
                onChange={(e) => {
                  const val = e.target.value.replace(/^0+(?=\d)/, "");
                  setSlotsForm({ ...slotsForm, maxParticipants: val || "1" });
                }}
                placeholder="1"
              />
              <p className="text-xs text-muted-foreground">
                {language === "ru"
                  ? "По умолчанию 1 (индивидуальное). Если больше 1 — групповое."
                  : "Әдепкі бойынша 1 (жеке). 1-ден көп болса — топтық."}
              </p>
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

      {/* Quick Add Slot for Hour Dialog */}
      <Dialog open={quickAddSlotHour !== null} onOpenChange={(open) => { if (!open) setQuickAddSlotHour(null); }}>
        <DialogContent className="sm:max-w-md z-[70]">
          <DialogHeader>
            <DialogTitle>{language === "ru" ? "Добавить слот" : "Слот қосу"}</DialogTitle>
          </DialogHeader>
          {quickAddSlotHour !== null && selectedDate && (
            <div className="space-y-4 pt-2">
              <div className="p-3 bg-muted rounded-lg flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">
                  {format(selectedDate, "d MMMM yyyy", { locale: ru })}
                </span>
                <Badge variant="default" className="text-xs">
                  {quickAddSlotHour}:00 – {quickAddSlotHour + 1 === 24 ? "00:00" : `${quickAddSlotHour + 1}:00`} ({quickAddSlotHour}–{quickAddSlotHour + 1 === 24 ? "0" : quickAddSlotHour + 1})
                </Badge>
              </div>

              <div className="space-y-2">
                <Label>{language === "ru" ? "Количество участников" : "Қатысушылар саны"}</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={quickAddParticipants === "1" ? "default" : "outline"}
                    className="flex-1 text-xs"
                    onClick={() => setQuickAddParticipants("1")}
                  >
                    1 ({language === "ru" ? "Индивидуально" : "Жеке"})
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={quickAddParticipants === "5" ? "default" : "outline"}
                    className="flex-1 text-xs"
                    onClick={() => setQuickAddParticipants("5")}
                  >
                    5 ({language === "ru" ? "Группа" : "Топ"})
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={quickAddParticipants === "10" ? "default" : "outline"}
                    className="flex-1 text-xs"
                    onClick={() => setQuickAddParticipants("10")}
                  >
                    10 ({language === "ru" ? "Группа" : "Топ"})
                  </Button>
                </div>
                <Input
                  type="number"
                  min="1"
                  value={quickAddParticipants}
                  onChange={(e) => setQuickAddParticipants(e.target.value)}
                  placeholder="1"
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground">
                  {language === "ru"
                    ? "По умолчанию 1 (индивидуальное занятие). Если больше 1 — групповое."
                    : "Әдепкі бойынша 1 (жеке сабақ). 1-ден көп болса — топтық."}
                </p>
              </div>

              <div className="space-y-2">
                <Label>{language === "ru" ? "Ссылка на урок (необязательно)" : "Сабаққа сілтеме (міндетті емес)"}</Label>
                <Input
                  placeholder="https://zoom.us/j/..."
                  value={quickAddLessonLink}
                  onChange={(e) => setQuickAddLessonLink(e.target.value)}
                />
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <Button variant="outline" className="flex-1" onClick={() => setQuickAddSlotHour(null)}>
                  {t("cancel")}
                </Button>
                <Button
                  className="flex-1"
                  disabled={createSingleSlot.isPending}
                  onClick={() => {
                    const participants = Math.max(1, parseInt(quickAddParticipants, 10) || 1);
                    createSingleSlot.mutate({
                      hour: quickAddSlotHour,
                      participants,
                      link: quickAddLessonLink,
                    });
                  }}
                >
                  {createSingleSlot.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (language === "ru" ? "Создать слот" : "Слот жасау")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Manage Slots Dialog (Add Link / Delete Slots) */}
      <Dialog open={isManagingSlots} onOpenChange={setIsManagingSlots}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" />
              {language === "ru" ? "Управление слотами" : "Слоттарды басқару"}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={manageTab} onValueChange={(v) => setManageTab(v as "link" | "delete")} className="w-full">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="link" className="gap-2 text-xs sm:text-sm">
                <Link className="w-4 h-4" />
                {language === "ru" ? "Ссылка на урок" : "Сабақ сілтемесі"}
              </TabsTrigger>
              <TabsTrigger value="delete" className="gap-2 text-xs sm:text-sm text-destructive data-[state=active]:text-destructive">
                <Trash2 className="w-4 h-4" />
                {language === "ru" ? "Удалить слоты" : "Слоттарды жою"}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="link" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>{language === "ru" ? "Ссылка на урок" : "Сабаққа сілтеме"}</Label>
                <Input
                  placeholder="https://zoom.us/j/..."
                  value={lessonLinkUrl}
                  onChange={(e) => setLessonLinkUrl(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{language === "ru" ? "Выберите даты со слотами" : "Слоттары бар күндерді таңдаңыз"}</Label>
                  {availableDatesForLink.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
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
                        : (language === "ru" ? "Выбрать все даты" : "Барлық күндерді таңдау")}
                    </Button>
                  )}
                </div>
                {availableDatesForLink.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    {language === "ru" ? "Нет слотов для добавления ссылки" : "Сілтеме қосу үшін слоттар жоқ"}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-2 border rounded-md">
                    {availableDatesForLink.map((date) => {
                      const isSelected = slotsForLinkDates.includes(date);
                      return (
                        <Button
                          key={date}
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            if (isSelected) {
                              setSlotsForLinkDates((prev) => prev.filter((d) => d !== date));
                            } else {
                              setSlotsForLinkDates((prev) => [...prev, date]);
                            }
                          }}
                        >
                          {format(new Date(date), "d MMM", { locale: ru })}
                        </Button>
                      );
                    })}
                  </div>
                )}
                {availableDatesForLink.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {language === "ru"
                      ? `Выбрано дат: ${slotsForLinkDates.length} из ${availableDatesForLink.length}`
                      : `Таңдалған күндер: ${slotsForLinkDates.length} / ${availableDatesForLink.length}`}
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <Button variant="outline" className="flex-1" onClick={() => setIsManagingSlots(false)}>
                  {t("cancel")}
                </Button>
                <Button
                  className="flex-1"
                  disabled={!lessonLinkUrl.trim() || slotsForLinkDates.length === 0 || addLessonLink.isPending}
                  onClick={() => {
                    const targetSchedule = schedules[0];
                    if (targetSchedule && lessonLinkUrl.trim()) {
                      const isAll = slotsForLinkDates.length === availableDatesForLink.length;
                      addLessonLink.mutate({
                        scheduleId: targetSchedule.id,
                        dates: isAll ? "all" : slotsForLinkDates,
                        link: lessonLinkUrl.trim(),
                      });
                      setIsManagingSlots(false);
                    }
                  }}
                >
                  {addLessonLink.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (language === "ru" ? "Сохранить ссылку" : "Сілтемені сақтау")}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="delete" className="space-y-4 pt-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{language === "ru" ? "Выберите даты для удаления" : "Жою үшін күндерді таңдаңыз"}</Label>
                  {availableDatesForDelete.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
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
                        : (language === "ru" ? "Выбрать все даты" : "Барлық күндерді таңдау")}
                    </Button>
                  )}
                </div>
                {availableDatesForDelete.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    {language === "ru" ? "Нет слотов для удаления" : "Жоюға болатын слоттар жоқ"}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-2 border rounded-md">
                    {availableDatesForDelete.map((date) => {
                      const isSelected = slotsToDeleteDates.includes(date);
                      return (
                        <Button
                          key={date}
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            if (isSelected) {
                              setSlotsToDeleteDates((prev) => prev.filter((d) => d !== date));
                            } else {
                              setSlotsToDeleteDates((prev) => [...prev, date]);
                            }
                          }}
                        >
                          {format(new Date(date), "d MMM", { locale: ru })}
                        </Button>
                      );
                    })}
                  </div>
                )}
                {availableDatesForDelete.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {language === "ru"
                      ? `Выбрано дат: ${slotsToDeleteDates.length} из ${availableDatesForDelete.length}`
                      : `Таңдалған күндер: ${slotsToDeleteDates.length} / ${availableDatesForDelete.length}`}
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <Button variant="outline" className="flex-1" onClick={() => setIsManagingSlots(false)}>
                  {t("cancel")}
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={slotsToDeleteDates.length === 0 || deleteMultipleSlots.isPending}
                  onClick={() => {
                    const targetSchedule = schedules[0];
                    if (targetSchedule) {
                      const isAll = slotsToDeleteDates.length === availableDatesForDelete.length;
                      deleteMultipleSlots.mutate({
                        scheduleId: targetSchedule.id,
                        dates: isAll ? "all" : slotsToDeleteDates,
                      });
                      setIsManagingSlots(false);
                    }
                  }}
                >
                  {deleteMultipleSlots.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (language === "ru" ? "Удалить слоты" : "Слоттарды жою")}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
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
        isPending={creatorCancelBooking.isPending}
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
                          setSelectedScheduleForDelete(schedule);
                          setConfirmDeleteSchedule(true);
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
                          setSelectedScheduleForDelete(schedule);
                          setConfirmDeleteSchedule(true);
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
            await rescheduleRequestMutation.mutateAsync({
              slotId: reschedulingSlot.slot.id,
              scheduleId: reschedulingSlot.schedule.id,
              newDate: data.newDate,
              newStartTime: data.newStartTime,
              newEndTime: data.newEndTime,
              reasons: data.reasons,
              comment: data.comment,
              requestedBy: "creator",
            });
            toast.success(language === "ru" ? "Запрос на перенос отправлен ученику" : "Ауыстыру сұранысы оқушыға жіберілді");
            setReschedulingSlot(null);
          } catch {
            toast.error(language === "ru" ? "Ошибка при отправке запроса" : "Сұраныс жіберу кезінде қате");
          }
        }}
        slot={reschedulingSlot?.slot || null}
        isPending={rescheduleRequestMutation.isPending}
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
              maxParticipants: data.maxParticipants,
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

export default CreatorScheduleTab;
