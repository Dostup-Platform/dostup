import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { playBookingSound, playCancellationSound, showBrowserNotification } from "@/hooks/useNotificationPermission";
import { sendPushNotification } from "@/lib/firebase";

interface BookingPayload {
  id: string;
  simple_user_id: string;
  schedule_id: string;
  time_slot_id: string;
  created_at: string;
  status?: string;
}

// Store deleted booking info before it's gone
interface DeletedBookingInfo {
  userName: string;
  productTitle: string;
  date: string;
  time: string;
}

export const useRealtimeBookingNotifications = (
  productIds: string[],
  enabled: boolean = true
) => {
  const queryClient = useQueryClient();
  const { language } = useLanguage();
  const productIdsRef = useRef<string[]>(productIds);
  const bookingCacheRef = useRef<Map<string, DeletedBookingInfo>>(new Map());
  
  // Keep productIds ref updated
  useEffect(() => {
    productIdsRef.current = productIds;
  }, [productIds]);

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
      };
      bookingCacheRef.current.set(bookingId, info);
      
      return booking;
    } catch {
      return null;
    }
  }, [language]);

  // Pre-cache existing bookings for DELETE notifications
  useEffect(() => {
    if (!enabled || productIds.length === 0) return;
    
    const cacheExistingBookings = async () => {
      // Only fetch schedules where teacher_id is null (creator's own schedules)
      const { data: schedules } = await supabase
        .from("schedules")
        .select("id")
        .in("product_id", productIds)
        .is("teacher_id", null);
      
      if (!schedules?.length) return;
      
      const scheduleIds = schedules.map(s => s.id);
      
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
        };
        bookingCacheRef.current.set(booking.id, info);
      });
    };
    
    cacheExistingBookings();
  }, [enabled, productIds, language]);

  useEffect(() => {
    if (!enabled || productIds.length === 0) return;

    console.log("Setting up realtime booking notifications for products:", productIds);

    const channel = supabase
      .channel("creator-booking-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "simple_bookings",
        },
        async (payload) => {
          console.log("New booking received:", payload);
          
          const newBooking = payload.new as BookingPayload;
          
          // Fetch full booking details
          const bookingDetails = await fetchBookingDetails(newBooking.id);
          
          if (!bookingDetails) return;
          
          const productId = bookingDetails.schedule?.product_id;
          const teacherId = bookingDetails.schedule?.teacher_id;
          
          // Check if this booking is for one of the creator's products
          if (!productIdsRef.current.includes(productId)) {
            console.log("Booking is not for creator's product, ignoring");
            return;
          }
          
          // IMPORTANT: Only notify creator for their own schedules (teacher_id = null)
          // Teacher schedules have their own notification flow
          if (teacherId !== null) {
            console.log("Booking is for teacher's schedule, not notifying creator");
            return;
          }

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

          // Send FCM push notification to creator only (filter by role)
          const creatorName = localStorage.getItem("creator_name");
          if (creatorName) {
            sendPushNotification(creatorName, title, description, {
              type: "booking",
              bookingId: newBooking.id
            }, "creator"); // Only send to creator role
          }

          // Invalidate bookings query to refresh data
          queryClient.invalidateQueries({ queryKey: ["creator-simple-bookings"] });
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
          console.log("Booking cancelled:", payload);
          
          const deletedBooking = payload.old as BookingPayload;
          
          // Get cached info about the deleted booking
          const cachedInfo = bookingCacheRef.current.get(deletedBooking.id);
          
          if (!cachedInfo) {
            console.log("No cached info for deleted booking");
            return;
          }

          // Play cancellation sound
          playCancellationSound();

          const title = language === "ru" ? "Запись отменена" : "Жазба жойылды";
          const description = language === "ru" 
            ? `${cachedInfo.userName} отменил запись на "${cachedInfo.productTitle}" на ${cachedInfo.date} в ${cachedInfo.time}`
            : `${cachedInfo.userName} "${cachedInfo.productTitle}" сабағына ${cachedInfo.date} күні ${cachedInfo.time} жазбасын жойды`;

          toast.warning(title, {
            description,
            duration: 10000,
          });

          // Browser push notification
          showBrowserNotification(title, description);

          // Send FCM push notification to creator only (filter by role)
          const creatorName = localStorage.getItem("creator_name");
          if (creatorName) {
            sendPushNotification(creatorName, title, description, {
              type: "cancellation",
              date: cachedInfo.date,
              time: cachedInfo.time
            }, "creator"); // Only send to creator role
          }

          // Remove from cache
          bookingCacheRef.current.delete(deletedBooking.id);

          // Invalidate bookings query to refresh data
          queryClient.invalidateQueries({ queryKey: ["creator-simple-bookings"] });
        }
      )
      .subscribe((status) => {
        console.log("Realtime subscription status:", status);
      });

    return () => {
      console.log("Cleaning up realtime subscription");
      supabase.removeChannel(channel);
    };
  }, [enabled, productIds, fetchBookingDetails, queryClient, language]);
};
