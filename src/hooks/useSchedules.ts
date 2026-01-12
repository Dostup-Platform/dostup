import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type EventType = "group" | "individual";

interface Schedule {
  id: string;
  product_id: string;
  title: string;
  event_type: EventType;
  max_participants: number | null;
  created_at: string;
}

interface TimeSlot {
  id: string;
  schedule_id: string;
  date: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
  created_at: string;
}

interface Booking {
  id: string;
  user_id: string;
  time_slot_id: string;
  schedule_id: string;
  status: string;
  created_at: string;
}

export const useSchedules = (productId: string | undefined) => {
  return useQuery({
    queryKey: ["schedules", productId],
    queryFn: async () => {
      if (!productId) return [];
      
      const { data, error } = await supabase
        .from("schedules")
        .select("*")
        .eq("product_id", productId);
      
      if (error) throw error;
      return data as Schedule[];
    },
    enabled: !!productId,
  });
};

export const useTimeSlots = (scheduleId: string | undefined) => {
  return useQuery({
    queryKey: ["time-slots", scheduleId],
    queryFn: async () => {
      if (!scheduleId) return [];
      
      const { data, error } = await supabase
        .from("time_slots")
        .select("*")
        .eq("schedule_id", scheduleId)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });
      
      if (error) throw error;
      return data as TimeSlot[];
    },
    enabled: !!scheduleId,
  });
};

export const useUserBookings = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["bookings", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          time_slots (
            id,
            date,
            start_time,
            end_time
          ),
          schedules (
            id,
            title,
            event_type
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
};

export const useCreatorBookings = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["creator-bookings", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      // Get creator's products first
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id")
        .eq("creator_id", user.id);
      
      if (productsError) throw productsError;
      
      const productIds = products.map(p => p.id);
      
      if (productIds.length === 0) return [];
      
      // Get schedules for those products
      const { data: schedules, error: schedulesError } = await supabase
        .from("schedules")
        .select("id")
        .in("product_id", productIds);
      
      if (schedulesError) throw schedulesError;
      
      const scheduleIds = schedules.map(s => s.id);
      
      if (scheduleIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          time_slots (
            id,
            date,
            start_time,
            end_time
          ),
          schedules (
            id,
            title,
            event_type,
            products (
              title
            )
          ),
          profiles!bookings_user_id_fkey (
            name,
            email,
            phone
          )
        `)
        .in("schedule_id", scheduleIds)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
};

export const useCreateBooking = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ timeSlotId, scheduleId }: { timeSlotId: string; scheduleId: string }) => {
      if (!user) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from("bookings")
        .insert({
          user_id: user.id,
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
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["time-slots"] });
    },
  });
};

export const useCreateSchedule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (schedule: Omit<Schedule, "id" | "created_at">) => {
      const { data, error } = await supabase
        .from("schedules")
        .insert(schedule)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["schedules", variables.product_id] });
    },
  });
};

export const useCreateTimeSlot = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (timeSlot: Omit<TimeSlot, "id" | "created_at">) => {
      const { data, error } = await supabase
        .from("time_slots")
        .insert(timeSlot)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["time-slots", variables.schedule_id] });
    },
  });
};
