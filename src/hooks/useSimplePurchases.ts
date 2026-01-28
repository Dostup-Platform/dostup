import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";

interface SimplePurchase {
  id: string;
  product_id: string;
  status: string;
  amount: number;
  created_at: string;
  can_choose_teacher: boolean | null;
  assigned_teacher_id: string | null;
  product: {
    id: string;
    title: string;
    headline: string | null;
  } | null;
}

// Получить подтверждённые покупки пользователя
export const useSimplePurchases = () => {
  const { user } = useSimpleAuth();
  const queryClient = useQueryClient();

  // Realtime подписка для автоматического обновления при подтверждении покупки
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`user-purchases-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "simple_purchases",
          filter: `simple_user_id=eq.${user.id}`
        },
        (payload: any) => {
          // При обновлении статуса покупки, обновить все связанные данные
          if (payload.new?.status === "completed") {
            queryClient.invalidateQueries({ queryKey: ["simple-purchases"] });
            queryClient.invalidateQueries({ queryKey: ["simple-materials"] });
            queryClient.invalidateQueries({ queryKey: ["simple-schedules"] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return useQuery({
    queryKey: ["simple-purchases", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("simple_purchases")
        .select(`
          id,
          product_id,
          status,
          amount,
          created_at,
          can_choose_teacher,
          assigned_teacher_id
        `)
        .eq("simple_user_id", user.id)
        .eq("status", "completed");

      if (error) throw error;

      // Получить информацию о продуктах
      if (!data?.length) return [];

      const productIds = data.map(p => p.product_id);
      const { data: products } = await supabase
        .from("products")
        .select("id, title, headline")
        .in("id", productIds);

      return data.map(purchase => ({
        ...purchase,
        product: products?.find(p => p.id === purchase.product_id) || null
      })) as SimplePurchase[];
    },
    enabled: !!user,
  });
};

// Получить материалы для подтверждённых покупок
export const useSimpleMaterials = () => {
  const { data: purchases } = useSimplePurchases();

  return useQuery({
    queryKey: ["simple-materials", purchases?.map(p => p.product_id)],
    queryFn: async () => {
      if (!purchases?.length) return [];

      const productIds = purchases.map(p => p.product_id);

      const { data, error } = await supabase
        .from("materials")
        .select(`
          id,
          title,
          type,
          content,
          file_url,
          order_index,
          product_id
        `)
        .in("product_id", productIds)
        .order("order_index");

      if (error) throw error;

      // Добавить информацию о продукте
      const { data: products } = await supabase
        .from("products")
        .select("id, title")
        .in("id", productIds);

      return data?.map(material => ({
        ...material,
        product: products?.find(p => p.id === material.product_id)
      })) || [];
    },
    enabled: !!purchases?.length,
  });
};

// Получить расписания для подтверждённых покупок  
export const useSimpleSchedules = () => {
  const { data: purchases } = useSimplePurchases();

  return useQuery({
    queryKey: ["simple-schedules", purchases?.map(p => p.product_id)],
    queryFn: async () => {
      if (!purchases?.length) return [];

      const productIds = purchases.map(p => p.product_id);

      const { data, error } = await supabase
        .from("schedules")
        .select("id, product_id, title, event_type, max_participants, teacher_id, created_at")
        .in("product_id", productIds);

      if (error) throw error;
      return data || [];
    },
    enabled: !!purchases?.length,
  });
};

// Получить time slots для расписания с realtime обновлениями
export const useSimpleTimeSlots = (scheduleId: string | undefined) => {
  const queryClient = useQueryClient();

  // Realtime подписка для обновления слотов при изменениях
  useEffect(() => {
    if (!scheduleId) return;

    const channel = supabase
      .channel(`time-slots-${scheduleId}`)
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to all events (INSERT, UPDATE, DELETE)
          schema: "public",
          table: "time_slots",
          filter: `schedule_id=eq.${scheduleId}`
        },
        () => {
          // При любом изменении слотов - обновить данные
          queryClient.invalidateQueries({ queryKey: ["simple-time-slots", scheduleId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [scheduleId, queryClient]);

  return useQuery({
    queryKey: ["simple-time-slots", scheduleId],
    queryFn: async () => {
      if (!scheduleId) return [];
      
      // Использовать локальную дату пользователя
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const today = `${year}-${month}-${day}`;
      
      const { data, error } = await supabase
        .from("time_slots")
        .select("*")
        .eq("schedule_id", scheduleId)
        .gte("date", today)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!scheduleId,
  });
};

// Получить ВСЕ бронирования для слотов расписания (для проверки занятости)
export const useAllBookingsForSchedule = (scheduleId: string | undefined) => {
  const queryClient = useQueryClient();

  // Realtime подписка для обновления при изменении бронирований
  useEffect(() => {
    if (!scheduleId) return;

    const channel = supabase
      .channel(`all-bookings-${scheduleId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "simple_bookings",
          filter: `schedule_id=eq.${scheduleId}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["all-bookings-schedule", scheduleId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [scheduleId, queryClient]);

  return useQuery({
    queryKey: ["all-bookings-schedule", scheduleId],
    queryFn: async () => {
      if (!scheduleId) return [];
      
      const { data, error } = await supabase
        .from("simple_bookings")
        .select("id, time_slot_id, simple_user_id, status")
        .eq("schedule_id", scheduleId)
        .eq("status", "confirmed");
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!scheduleId,
  });
};

// Получить бронирования пользователя с деталями
export const useSimpleBookings = () => {
  const { user } = useSimpleAuth();

  return useQuery({
    queryKey: ["simple-bookings", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      // Получить бронирования
      const { data: bookingsData, error } = await supabase
        .from("simple_bookings" as any)
        .select("id, time_slot_id, schedule_id, status, created_at")
        .eq("simple_user_id", user.id)
        .eq("status", "confirmed");
      
      if (error) throw error;
      if (!bookingsData?.length) return [];

      const bookings = bookingsData as unknown as Array<{
        id: string;
        time_slot_id: string;
        schedule_id: string;
        status: string;
        created_at: string;
      }>;

      // Получить time_slots
      const slotIds = bookings.map(b => b.time_slot_id);
      const { data: slots } = await supabase
        .from("time_slots")
        .select("id, date, start_time, end_time, lesson_link")
        .in("id", slotIds);

      // Получить schedules
      const scheduleIds = bookings.map(b => b.schedule_id);
      const { data: schedules } = await supabase
        .from("schedules")
        .select("id, title, event_type, product_id")
        .in("id", scheduleIds);

      // Получить products
      const productIds = schedules?.map(s => s.product_id) || [];
      const { data: products } = await supabase
        .from("products")
        .select("id, title")
        .in("id", productIds);

      return bookings.map(booking => ({
        ...booking,
        time_slot: slots?.find(s => s.id === booking.time_slot_id),
        schedule: schedules?.find(s => s.id === booking.schedule_id),
        product: products?.find(p => p.id === schedules?.find(s => s.id === booking.schedule_id)?.product_id),
      }));
    },
    enabled: !!user,
  });
};

// Создать бронирование
export const useCreateSimpleBooking = () => {
  const queryClient = useQueryClient();
  const { user } = useSimpleAuth();

  return useMutation({
    mutationFn: async ({ timeSlotId, scheduleId }: { timeSlotId: string; scheduleId: string }) => {
      if (!user) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from("simple_bookings" as any)
        .insert({
          simple_user_id: user.id,
          time_slot_id: timeSlotId,
          schedule_id: scheduleId,
          status: "confirmed",
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["simple-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["simple-time-slots"] });
    },
  });
};

// Отменить бронирование (для студента) с сохранением в cancellations
export const useCancelSimpleBooking = () => {
  const queryClient = useQueryClient();
  const { user } = useSimpleAuth();

  return useMutation({
    mutationFn: async ({ bookingId, reasons, comment }: { bookingId: string; reasons?: string[]; comment?: string }) => {
      // Сначала получаем данные бронирования для сохранения в cancellations
      const { data: booking } = await supabase
        .from("simple_bookings")
        .select(`
          id,
          time_slot:time_slots(date, start_time),
          schedule:schedules(id, title, product_id, product:products(id, title))
        `)
        .eq("id", bookingId)
        .single();

      if (booking && user) {
        // Сохраняем информацию об отмене
        await supabase.from("booking_cancellations").insert({
          booking_id: bookingId,
          user_name: user.name,
          user_phone: user.phone,
          product_title: (booking as any).schedule?.product?.title || "",
          product_id: (booking as any).schedule?.product_id,
          schedule_id: (booking as any).schedule?.id,
          schedule_title: (booking as any).schedule?.title || "",
          slot_date: (booking as any).time_slot?.date,
          slot_time: (booking as any).time_slot?.start_time,
          cancelled_by: "student",
          cancellation_reasons: reasons || [],
          cancellation_comment: comment || null,
        });
      }

      // Удаляем бронирование
      const { error } = await supabase
        .from("simple_bookings" as any)
        .delete()
        .eq("id", bookingId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["simple-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["simple-time-slots"] });
    },
  });
};

// Отменить бронирование (для создателя/учителя) с сохранением в cancellations
export const useCreatorCancelBooking = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ bookingId, cancelledBy, reasons, comment }: { 
      bookingId: string; 
      cancelledBy: "creator" | "teacher";
      reasons?: string[];
      comment?: string;
    }) => {
      // Сначала получаем данные бронирования для сохранения в cancellations
      const { data: booking } = await supabase
        .from("simple_bookings")
        .select(`
          id,
          simple_user_id,
          time_slot:time_slots(date, start_time),
          schedule:schedules(id, title, product_id, product:products(id, title))
        `)
        .eq("id", bookingId)
        .single();

      if (booking) {
        // Получить имя и телефон пользователя
        const { data: user } = await supabase
          .from("simple_users")
          .select("name, phone")
          .eq("id", (booking as any).simple_user_id)
          .single();

        // Сохраняем информацию об отмене
        await supabase.from("booking_cancellations").insert({
          booking_id: bookingId,
          user_name: user?.name || "Ученик",
          user_phone: user?.phone,
          product_title: (booking as any).schedule?.product?.title || "",
          product_id: (booking as any).schedule?.product_id,
          schedule_id: (booking as any).schedule?.id,
          schedule_title: (booking as any).schedule?.title || "",
          slot_date: (booking as any).time_slot?.date,
          slot_time: (booking as any).time_slot?.start_time,
          cancelled_by: cancelledBy,
          cancellation_reasons: reasons || [],
          cancellation_comment: comment || null,
        });
      }

      // Удаляем бронирование
      const { error } = await supabase
        .from("simple_bookings" as any)
        .delete()
        .eq("id", bookingId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-simple-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["creator-week-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-week-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["simple-time-slots"] });
    },
  });
};

// Получить все бронирования для создателя (для уведомлений)
// Показываем ТОЛЬКО бронирования на расписания автора (где teacher_id IS NULL)
export const useCreatorSimpleBookings = (productIds: string[]) => {
  return useQuery({
    queryKey: ["creator-simple-bookings", productIds],
    queryFn: async () => {
      if (!productIds.length) return [];

      // Получить ТОЛЬКО расписания самого автора (не учителей)
      const { data: schedules, error: schedulesError } = await supabase
        .from("schedules")
        .select("id, title, event_type, product_id")
        .in("product_id", productIds)
        .is("teacher_id", null); // Только расписания автора

      if (schedulesError) throw schedulesError;
      if (!schedules?.length) return [];

      const scheduleIds = schedules.map(s => s.id);

      // Получить бронирования
      const { data: bookingsData, error: bookingsError } = await supabase
        .from("simple_bookings" as any)
        .select("id, simple_user_id, time_slot_id, schedule_id, status, created_at")
        .in("schedule_id", scheduleIds)
        .eq("status", "confirmed")
        .order("created_at", { ascending: false });

      if (bookingsError) throw bookingsError;
      if (!bookingsData?.length) return [];

      const bookings = bookingsData as unknown as Array<{
        id: string;
        simple_user_id: string;
        time_slot_id: string;
        schedule_id: string;
        status: string;
        created_at: string;
      }>;

      // Получить time_slots
      const slotIds = bookings.map(b => b.time_slot_id);
      const { data: slots } = await supabase
        .from("time_slots")
        .select("id, date, start_time, end_time")
        .in("id", slotIds);

      // Получить simple_users
      const userIds = bookings.map(b => b.simple_user_id);
      const { data: users } = await supabase
        .from("simple_users")
        .select("id, name, phone")
        .in("id", userIds);

      // Получить products
      const { data: products } = await supabase
        .from("products")
        .select("id, title")
        .in("id", productIds);

      return bookings.map(booking => ({
        ...booking,
        time_slot: slots?.find(s => s.id === booking.time_slot_id),
        schedule: schedules?.find(s => s.id === booking.schedule_id),
        user: users?.find(u => u.id === booking.simple_user_id),
        product: products?.find(p => p.id === schedules?.find(s => s.id === booking.schedule_id)?.product_id),
      }));
    },
    enabled: productIds.length > 0,
  });
};
