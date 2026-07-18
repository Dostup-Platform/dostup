import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Schedule {
  id: string;
  product_id: string;
  title: string;
  event_type: "group" | "individual";
  max_participants: number | null;
  teacher_id: string | null;
  created_at: string;
}

export interface TimeSlot {
  id: string;
  schedule_id: string;
  date: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
  max_participants: number | null;
  lesson_link: string | null;
}

export interface Booking {
  id: string;
  user_id: string;
  time_slot_id: string;
  schedule_id: string;
  status: string;
  created_at: string;
}

export const useProductSchedules = (productId: string | undefined) =>
  useQuery({
    queryKey: ["schedules", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedules")
        .select("*")
        .eq("product_id", productId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Schedule[];
    },
  });

export const useScheduleSlots = (scheduleIds: string[]) =>
  useQuery({
    queryKey: ["time_slots", scheduleIds.sort().join(",")],
    enabled: scheduleIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_slots")
        .select("*")
        .in("schedule_id", scheduleIds)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TimeSlot[];
    },
  });

export const useMyBookings = (userId: string | undefined, scheduleIds: string[]) =>
  useQuery({
    queryKey: ["my-bookings", userId, scheduleIds.sort().join(",")],
    enabled: !!userId && scheduleIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("user_id", userId!)
        .in("schedule_id", scheduleIds);
      if (error) throw error;
      return (data ?? []) as Booking[];
    },
  });

export const useSlotBookings = (scheduleIds: string[]) =>
  useQuery({
    queryKey: ["slot-bookings", scheduleIds.sort().join(",")],
    enabled: scheduleIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .in("schedule_id", scheduleIds);
      if (error) throw error;
      return (data ?? []) as Booking[];
    },
  });

export const useCreateBooking = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, slot }: { userId: string; slot: TimeSlot }) => {
      const { error } = await supabase.from("bookings").insert({
        user_id: userId,
        time_slot_id: slot.id,
        schedule_id: slot.schedule_id,
        status: "confirmed",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
      qc.invalidateQueries({ queryKey: ["slot-bookings"] });
    },
  });
};

export const useCancelBooking = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase.from("bookings").delete().eq("id", bookingId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
      qc.invalidateQueries({ queryKey: ["slot-bookings"] });
    },
  });
};

export const useCreateSchedule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      product_id: string;
      title: string;
      event_type: "group" | "individual";
      max_participants: number | null;
    }) => {
      const { error } = await supabase.from("schedules").insert(input);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["schedules", v.product_id] }),
  });
};

export const useDeleteSchedule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("schedules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedules"] }),
  });
};

export const useCreateSlot = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      schedule_id: string;
      date: string;
      start_time: string;
      end_time: string;
      max_participants?: number | null;
      lesson_link?: string | null;
    }) => {
      const { error } = await supabase.from("time_slots").insert({
        ...input,
        is_available: true,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["time_slots"] }),
  });
};

export const useDeleteSlot = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("time_slots").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["time_slots"] }),
  });
};