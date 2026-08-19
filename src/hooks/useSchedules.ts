import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { useCreatorId } from "@/hooks/useProducts";
import { creatorCreds, sessionCreds, studentCreds, invokeApi } from "@/lib/sessionApi";

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

export const useSchedules = (productId: string | undefined) => {
  return useQuery({
    queryKey: ["schedules", productId],
    queryFn: async () => {
      if (!productId) return [];
      const data = await invokeApi<{ schedules: Schedule[] }>("manage-schedules", {
        action: "list_schedules",
        ...sessionCreds(),
        productIds: [productId],
      });
      return data.schedules ?? [];
    },
    enabled: !!productId,
  });
};

export const useTimeSlots = (scheduleId: string | undefined) => {
  return useQuery({
    queryKey: ["time-slots", scheduleId],
    queryFn: async () => {
      if (!scheduleId) return [];
      const data = await invokeApi<{ slots: TimeSlot[] }>("manage-schedules", {
        action: "list_slots",
        ...sessionCreds(),
        scheduleIds: [scheduleId],
      });
      return data.slots ?? [];
    },
    enabled: !!scheduleId,
  });
};

export const useUserBookings = () => {
  const { user } = useSimpleAuth();

  return useQuery({
    queryKey: ["bookings", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const data = await invokeApi<{ bookings: unknown[] }>("manage-bookings", {
        action: "list_mine",
        ...studentCreds(),
      });
      return data.bookings ?? [];
    },
    enabled: !!user,
  });
};

export const useCreatorBookings = () => {
  const creatorId = useCreatorId();

  return useQuery({
    queryKey: ["creator-bookings", creatorId],
    queryFn: async () => {
      if (!creatorId) return [];
      const products = await invokeApi<{ products: { id: string }[] }>("manage-products", {
        action: "list",
        ...creatorCreds(),
      });
      const productIds = (products.products ?? []).map((p) => p.id);
      if (!productIds.length) return [];
      const schedules = await invokeApi<{ schedules: { id: string }[] }>("manage-schedules", {
        action: "list_schedules",
        ...creatorCreds(),
        productIds,
      });
      const scheduleIds = (schedules.schedules ?? []).map((s) => s.id);
      if (!scheduleIds.length) return [];
      const slots = await invokeApi<{ slots: { id: string }[] }>("manage-schedules", {
        action: "list_slots",
        ...creatorCreds(),
        scheduleIds,
      });
      const slotIds = (slots.slots ?? []).map((s) => s.id);
      if (!slotIds.length) return [];
      const bookings = await invokeApi<{ bookings: unknown[] }>("manage-schedules", {
        action: "list_bookings_for_slots",
        ...creatorCreds(),
        slotIds,
      });
      return bookings.bookings ?? [];
    },
    enabled: !!creatorId,
  });
};

export const useCreateBooking = () => {
  const queryClient = useQueryClient();
  const { user } = useSimpleAuth();

  return useMutation({
    mutationFn: async ({ timeSlotId, scheduleId }: { timeSlotId: string; scheduleId: string }) => {
      if (!user) throw new Error("Not authenticated");
      const data = await invokeApi("manage-bookings", {
        action: "create",
        ...studentCreds(),
        timeSlotId,
        scheduleId,
      });
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
      const data = await invokeApi<{ schedule: Schedule }>("manage-schedules", {
        action: "create_schedule",
        ...sessionCreds(),
        productId: schedule.product_id,
        title: schedule.title,
        eventType: schedule.event_type,
        maxParticipants: schedule.max_participants,
      });
      return data.schedule;
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
      const data = await invokeApi<{ slots: TimeSlot[] }>("manage-schedules", {
        action: "create_slots",
        ...sessionCreds(),
        slots: [timeSlot],
        scheduleId: timeSlot.schedule_id,
      });
      return data.slots?.[0];
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["time-slots", variables.schedule_id] });
    },
  });
};

export const useUpdateSchedule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, productId, ...updates }: Partial<Schedule> & { id: string; productId: string }) => {
      const data = await invokeApi<{ schedule: Schedule }>("manage-schedules", {
        action: "update_schedule",
        ...sessionCreds(),
        id,
        updates,
      });
      return { ...data.schedule, productId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["schedules", data.productId] });
    },
  });
};

export const useDeleteSchedule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, productId }: { id: string; productId: string }) => {
      await invokeApi("manage-schedules", {
        action: "delete_schedule",
        ...sessionCreds(),
        id,
      });
      return { productId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["schedules", data.productId] });
    },
  });
};

export const useDeleteTimeSlot = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, scheduleId }: { id: string; scheduleId: string }) => {
      await invokeApi("manage-schedules", {
        action: "delete_slot",
        ...sessionCreds(),
        slotId: id,
      });
      return { scheduleId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["time-slots", data.scheduleId] });
    },
  });
};

export const useCreateMultipleTimeSlots = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ slots, scheduleId }: { slots: Omit<TimeSlot, "id" | "created_at">[]; scheduleId: string }) => {
      const data = await invokeApi("manage-schedules", {
        action: "create_slots",
        ...sessionCreds(),
        slots,
        scheduleId,
      });
      return { data, scheduleId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["time-slots", data.scheduleId] });
    },
  });
};

export const useDeleteMultipleTimeSlots = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ slotIds, scheduleId }: { slotIds: string[]; scheduleId: string }) => {
      for (const id of slotIds) {
        await invokeApi("manage-schedules", {
          action: "delete_slot",
          ...sessionCreds(),
          slotId: id,
        });
      }
      return { scheduleId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["time-slots", data.scheduleId] });
    },
  });
};
