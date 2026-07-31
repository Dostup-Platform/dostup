import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Booking, Schedule, TimeSlot } from "@/hooks/useSchedule";

export interface RescheduleRequest {
  id: string;
  booking_id: string;
  user_id: string | null;
  schedule_id: string | null;
  product_id: string;
  product_title: string;
  old_date: string;
  old_time: string;
  new_date: string;
  new_time: string;
  reasons: string[] | null;
  comment: string | null;
  status: string;
  requested_by: string;
  teacher_id: string | null;
  response_comment: string | null;
  created_at: string | null;
  responded_at: string | null;
}

export const useMyPendingRescheduleRequests = (
  userId: string | undefined,
  bookingIds: string[],
) =>
  useQuery({
    queryKey: ["my-reschedule-requests", userId, bookingIds.sort().join(",")],
    enabled: !!userId && bookingIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reschedule_requests")
        .select("*")
        .eq("user_id", userId!)
        .eq("status", "pending")
        .in("booking_id", bookingIds);
      if (error) throw error;
      return (data ?? []) as RescheduleRequest[];
    },
  });

export const usePendingRescheduleRequests = (
  mode: "creator" | "teacher",
  userId: string | undefined,
) =>
  useQuery({
    queryKey: ["pending-reschedule-requests", mode, userId],
    enabled: !!userId,
    queryFn: async () => {
      let productIds: string[] = [];
      if (mode === "creator") {
        const { data: prods, error } = await supabase
          .from("products")
          .select("id")
          .eq("owner_id", userId!);
        if (error) throw error;
        productIds = (prods ?? []).map((p) => p.id);
      } else {
        const { data: rows, error } = await supabase
          .from("product_teachers")
          .select("product_id")
          .eq("teacher_user_id", userId!);
        if (error) throw error;
        productIds = (rows ?? []).map((r) => r.product_id);
      }
      if (productIds.length === 0) return [] as RescheduleRequest[];

      const { data, error } = await supabase
        .from("reschedule_requests")
        .select("*")
        .in("product_id", productIds)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RescheduleRequest[];
    },
  });

export const useCreateRescheduleRequest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      booking: Booking;
      currentSlot: TimeSlot;
      newSlot: TimeSlot;
      schedule: Schedule;
      productId: string;
      productTitle: string;
      userId: string;
      reasons?: string[];
      comment?: string;
    }) => {
      const { error } = await supabase.from("reschedule_requests").insert({
        booking_id: input.booking.id,
        user_id: input.userId,
        schedule_id: input.schedule.id,
        product_id: input.productId,
        product_title: input.productTitle,
        old_date: input.currentSlot.date,
        old_time: input.currentSlot.start_time,
        new_date: input.newSlot.date,
        new_time: input.newSlot.start_time,
        reasons: input.reasons?.length ? input.reasons : [],
        comment: input.comment?.trim() || null,
        requested_by: "student",
        teacher_id: input.schedule.teacher_id,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-reschedule-requests"] });
      qc.invalidateQueries({ queryKey: ["pending-reschedule-requests"] });
    },
  });
};

async function findSlotForRequest(request: RescheduleRequest): Promise<string> {
  if (!request.schedule_id) throw new Error("Расписание не указано");

  const { data: slot, error } = await supabase
    .from("time_slots")
    .select("id")
    .eq("schedule_id", request.schedule_id)
    .eq("date", request.new_date)
    .eq("start_time", request.new_time)
    .maybeSingle();
  if (error) throw error;
  if (!slot) throw new Error("Новый слот не найден");
  return slot.id;
}

export const useRespondRescheduleRequest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      request,
      approve,
      responseComment,
      respondedBy = "creator",
    }: {
      request: RescheduleRequest;
      approve: boolean;
      responseComment?: string;
      respondedBy?: "creator" | "teacher";
    }) => {
      const respondedAt = new Date().toISOString();

      if (!approve) {
        const { error } = await supabase
          .from("reschedule_requests")
          .update({
            status: "rejected",
            responded_at: respondedAt,
            response_comment: responseComment?.trim() || null,
          })
          .eq("id", request.id);
        if (error) throw error;
        return;
      }

      const newSlotId = await findSlotForRequest(request);

      const { error: bookingErr } = await supabase
        .from("bookings")
        .update({ time_slot_id: newSlotId })
        .eq("id", request.booking_id);
      if (bookingErr) throw bookingErr;

      const { error: histErr } = await supabase.from("booking_reschedules").insert({
        booking_id: request.booking_id,
        user_id: request.user_id,
        schedule_id: request.schedule_id,
        product_id: request.product_id,
        product_title: request.product_title,
        old_date: request.old_date,
        old_time: request.old_time,
        new_date: request.new_date,
        new_time: request.new_time,
        rescheduled_by: respondedBy,
        reasons: ["Запрос ученика подтверждён"],
        comment: request.comment,
      });
      if (histErr) throw histErr;

      const { error } = await supabase
        .from("reschedule_requests")
        .update({
          status: "approved",
          responded_at: respondedAt,
          response_comment: responseComment?.trim() || null,
        })
        .eq("id", request.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-reschedule-requests"] });
      qc.invalidateQueries({ queryKey: ["my-reschedule-requests"] });
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
      qc.invalidateQueries({ queryKey: ["slot-bookings"] });
    },
  });
};
