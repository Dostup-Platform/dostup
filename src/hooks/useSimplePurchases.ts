import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";

interface SimplePurchase {
  id: string;
  product_id: string;
  status: string;
  amount: number;
  created_at: string;
  product: {
    id: string;
    title: string;
    headline: string | null;
  } | null;
}

// Получить подтверждённые покупки пользователя
export const useSimplePurchases = () => {
  const { user } = useSimpleAuth();

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
          created_at
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
        .select("*")
        .in("product_id", productIds);

      if (error) throw error;
      return data || [];
    },
    enabled: !!purchases?.length,
  });
};

// Получить time slots для расписания
export const useSimpleTimeSlots = (scheduleId: string | undefined) => {
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
        .select("id, date, start_time, end_time")
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

// Отменить бронирование (для студента)
export const useCancelSimpleBooking = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookingId: string) => {
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

// Отменить бронирование (для создателя)
export const useCreatorCancelBooking = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase
        .from("simple_bookings" as any)
        .delete()
        .eq("id", bookingId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-simple-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["simple-time-slots"] });
    },
  });
};

// Получить все бронирования для создателя (для уведомлений)
export const useCreatorSimpleBookings = (productIds: string[]) => {
  return useQuery({
    queryKey: ["creator-simple-bookings", productIds],
    queryFn: async () => {
      if (!productIds.length) return [];

      // Получить schedules для продуктов создателя
      const { data: schedules, error: schedulesError } = await supabase
        .from("schedules")
        .select("id, title, event_type, product_id")
        .in("product_id", productIds);

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
