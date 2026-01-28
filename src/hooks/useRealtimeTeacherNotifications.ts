import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { playBookingSound, playCancellationSound, showBrowserNotification } from "@/hooks/useNotificationPermission";
import { sendPushNotification } from "@/lib/firebase";
import { setAppBadge } from "@/lib/appBadge";

interface BookingPayload {
  id: string;
  simple_user_id: string;
  schedule_id: string;
  time_slot_id: string;
  created_at: string;
  status?: string;
}

interface DeletedBookingInfo {
  userName: string;
  productTitle: string;
  date: string;
  time: string;
  bookingId: string;
}

// Global set to track processed IDs to prevent duplicates
const processedTeacherBookingInserts = new Set<string>();
const processedTeacherBookingDeletes = new Set<string>();

const cleanupProcessedIds = (set: Set<string>, id: string) => {
  setTimeout(() => {
    set.delete(id);
  }, 30000);
};

export const useRealtimeTeacherNotifications = (
  teacherName: string | null,
  teacherPhone: string | undefined,
  scheduleIds: string[],
  enabled: boolean = true,
  currentBadgeCount: number = 0
) => {
  const queryClient = useQueryClient();
  const { language } = useLanguage();
  const scheduleIdsRef = useRef<string[]>(scheduleIds);
  const bookingCacheRef = useRef<Map<string, DeletedBookingInfo>>(new Map());
  const badgeCountRef = useRef<number>(currentBadgeCount);
  
  // Keep badge count ref updated
  useEffect(() => {
    badgeCountRef.current = currentBadgeCount;
  }, [currentBadgeCount]);

  // Keep scheduleIds ref updated
  useEffect(() => {
    scheduleIdsRef.current = scheduleIds;
  }, [scheduleIds]);

  const fetchBookingDetails = useCallback(async (bookingId: string) => {
    try {
      const { data: booking, error } = await supabase
        .from("simple_bookings")
        .select(`
          *,
          time_slot:time_slots(*),
          schedule:schedules(
            *,
            product:products(*)
          ),
          user:simple_users(*)
        `)
        .eq("id", bookingId)
        .single();

      if (error || !booking) return null;

      // Cache the booking info for potential DELETE events
      const info: DeletedBookingInfo = {
        userName: booking.user?.name || (language === "ru" ? "Ученик" : "Оқушы"),
        productTitle: booking.schedule?.product?.title || "",
        date: booking.time_slot?.date || "",
        time: booking.time_slot?.start_time || "",
        bookingId: bookingId,
      };
      bookingCacheRef.current.set(bookingId, info);

      return booking;
    } catch {
      return null;
    }
  }, [language]);

  // Pre-cache existing bookings for DELETE notifications
  useEffect(() => {
    if (!enabled || scheduleIds.length === 0) return;

    const cacheExistingBookings = async () => {
      const { data: bookings } = await supabase
        .from("simple_bookings")
        .select(`
          id,
          time_slot:time_slots(date, start_time),
          schedule:schedules(product:products(title)),
          user:simple_users(name)
        `)
        .in("schedule_id", scheduleIds)
        .eq("status", "confirmed");

      bookings?.forEach((booking: any) => {
        const info: DeletedBookingInfo = {
          userName: booking.user?.name || (language === "ru" ? "Ученик" : "Оқушы"),
          productTitle: booking.schedule?.product?.title || "",
          date: booking.time_slot?.date || "",
          time: booking.time_slot?.start_time || "",
          bookingId: booking.id,
        };
        bookingCacheRef.current.set(booking.id, info);
      });
    };

    cacheExistingBookings();
  }, [enabled, scheduleIds, language]);

  useEffect(() => {
    if (!enabled || !teacherName || scheduleIds.length === 0) return;

    console.log("Setting up realtime teacher notifications for schedules:", scheduleIds);

    const channel = supabase
      .channel("teacher-booking-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "simple_bookings",
        },
        async (payload) => {
          console.log("Teacher: New booking received:", payload);

          const newBooking = payload.new as BookingPayload;

          // Skip if we already processed this booking
          if (processedTeacherBookingInserts.has(newBooking.id)) {
            console.log("Already processed booking insert:", newBooking.id);
            return;
          }
          processedTeacherBookingInserts.add(newBooking.id);
          cleanupProcessedIds(processedTeacherBookingInserts, newBooking.id);

          // Check if this booking is for one of the teacher's schedules
          if (!scheduleIdsRef.current.includes(newBooking.schedule_id)) {
            console.log("Booking is not for teacher's schedule, ignoring");
            return;
          }

          // Fetch full booking details
          const bookingDetails = await fetchBookingDetails(newBooking.id);

          if (!bookingDetails) return;

          // Play notification sound
          playBookingSound();

          // Show toast notification
          const userName = bookingDetails.user?.name || (language === "ru" ? "Ученик" : "Оқушы");
          const productTitle = bookingDetails.schedule?.product?.title || "";
          const date = bookingDetails.time_slot?.date || "";
          const time = bookingDetails.time_slot?.start_time || "";

          const title = language === "ru" ? "Новая запись!" : "Жаңа жазба!";
          const description = language === "ru"
            ? `${userName} записался на "${productTitle}" на ${date} в ${time}`
            : `${userName} "${productTitle}" сабағына ${date} күні ${time} уақытына жазылды`;

          toast.success(title, {
            description,
            duration: 10000,
          });

          // Browser push notification
          showBrowserNotification(title, description);

          // Send FCM push notification to teacher
          if (teacherPhone) {
            sendPushNotification(teacherPhone, title, description, {
              type: "booking",
              bookingId: newBooking.id
            }, "teacher");
          }

          // Update app badge
          const newBadgeCount = badgeCountRef.current + 1;
          setAppBadge(newBadgeCount);

          // Invalidate queries to refresh data - include all related queries
          queryClient.invalidateQueries({ queryKey: ["teacher-bookings"] });
          queryClient.invalidateQueries({ queryKey: ["teacher-week-bookings"] });
          queryClient.invalidateQueries({ queryKey: ["teacher-week-slots"] });
          queryClient.invalidateQueries({ queryKey: ["teacher-notification-bookings"] });
          queryClient.invalidateQueries({ queryKey: ["teacher-cancellations"] });
          queryClient.invalidateQueries({ queryKey: ["teacher-schedules-list"] });
          queryClient.invalidateQueries({ queryKey: ["time-slots"] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "simple_bookings",
        },
        async (payload) => {
          console.log("Teacher: Booking cancelled:", payload);

          const deletedBooking = payload.old as BookingPayload;

          // Skip if we already processed this deletion
          if (processedTeacherBookingDeletes.has(deletedBooking.id)) {
            console.log("Already processed booking delete:", deletedBooking.id);
            return;
          }
          processedTeacherBookingDeletes.add(deletedBooking.id);
          cleanupProcessedIds(processedTeacherBookingDeletes, deletedBooking.id);

          // Get cached info about the deleted booking
          // NOTE: We use cache to check if booking was for teacher's schedule
          // because DELETE payload only contains 'id', not 'schedule_id'
          const cachedInfo = bookingCacheRef.current.get(deletedBooking.id);

          if (!cachedInfo) {
            // Booking was not in our cache = not for this teacher's schedules
            console.log("No cached info for deleted booking - not for this teacher");
            return;
          }

          console.log("Teacher: Found cached booking info, showing cancellation notification");

          // Fetch cancellation details (reasons and comment) from booking_cancellations table
          const { data: cancellationData } = await supabase
            .from("booking_cancellations")
            .select("cancellation_reasons, cancellation_comment")
            .eq("booking_id", cachedInfo.bookingId)
            .single();

          const reasons = cancellationData?.cancellation_reasons || [];
          const comment = cancellationData?.cancellation_comment || "";

          // Play cancellation sound
          playCancellationSound();

          // Build description with reasons/comment
          let description = language === "ru"
            ? `${cachedInfo.userName} отменил запись на "${cachedInfo.productTitle}" на ${cachedInfo.date} в ${cachedInfo.time}`
            : `${cachedInfo.userName} "${cachedInfo.productTitle}" сабағына ${cachedInfo.date} күні ${cachedInfo.time} жазбасын жойды`;

          // Add reasons or comment to description
          if (comment) {
            description += `\n"${comment}"`;
          } else if (reasons.length > 0) {
            description += `\n${reasons.join(", ")}`;
          }

          const title = language === "ru" ? "Запись отменена" : "Жазба жойылды";

          toast.warning(title, {
            description,
            duration: 10000,
          });

          // Browser push notification
          showBrowserNotification(title, description);

          // Send FCM push notification to teacher
          if (teacherPhone) {
            sendPushNotification(teacherPhone, title, description, {
              type: "cancellation",
              date: cachedInfo.date,
              time: cachedInfo.time,
              reasons: reasons.join(", "),
              comment: comment
            }, "teacher");
          }

          // Remove from cache
          bookingCacheRef.current.delete(deletedBooking.id);

          // Update app badge
          const newBadgeCount = badgeCountRef.current + 1;
          setAppBadge(newBadgeCount);

          // Invalidate queries to refresh data - include all related queries
          queryClient.invalidateQueries({ queryKey: ["teacher-bookings"] });
          queryClient.invalidateQueries({ queryKey: ["teacher-week-bookings"] });
          queryClient.invalidateQueries({ queryKey: ["teacher-week-slots"] });
          queryClient.invalidateQueries({ queryKey: ["teacher-cancellations"] });
          queryClient.invalidateQueries({ queryKey: ["teacher-notification-bookings"] });
          queryClient.invalidateQueries({ queryKey: ["teacher-notification-cancellations"] });
          queryClient.invalidateQueries({ queryKey: ["teacher-schedules-list"] });
          queryClient.invalidateQueries({ queryKey: ["time-slots"] });
        }
      )
      .subscribe((status) => {
        console.log("Teacher realtime subscription status:", status);
      });

    return () => {
      console.log("Cleaning up teacher realtime subscription");
      supabase.removeChannel(channel);
    };
  }, [enabled, teacherName, teacherPhone, scheduleIds, fetchBookingDetails, queryClient, language]);
};

