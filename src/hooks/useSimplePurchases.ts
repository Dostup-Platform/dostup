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
      
      const { data, error } = await supabase
        .from("time_slots")
        .select("*")
        .eq("schedule_id", scheduleId)
        .gte("date", new Date().toISOString().split("T")[0])
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!scheduleId,
  });
};

// Получить бронирования пользователя (для simple_users через simple_bookings)
export const useSimpleBookings = () => {
  const { user } = useSimpleAuth();

  return useQuery({
    queryKey: ["simple-bookings", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("simple_bookings" as any)
        .select(`
          id,
          time_slot_id,
          schedule_id,
          status,
          created_at
        `)
        .eq("simple_user_id", user.id)
        .eq("status", "confirmed");
      
      if (error) throw error;
      return (data || []) as unknown as Array<{
        id: string;
        time_slot_id: string;
        schedule_id: string;
        status: string;
        created_at: string;
      }>;
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
