import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

interface NewBookingPayload {
  id: string;
  simple_user_id: string;
  schedule_id: string;
  time_slot_id: string;
  created_at: string;
}

export const useRealtimeBookingNotifications = (
  productIds: string[],
  enabled: boolean = true
) => {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const productIdsRef = useRef<string[]>(productIds);
  
  // Keep productIds ref updated
  useEffect(() => {
    productIdsRef.current = productIds;
  }, [productIds]);

  const playNotificationSound = useCallback(() => {
    try {
      // Create a simple notification sound using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.log("Could not play notification sound:", error);
    }
  }, []);

  const fetchBookingDetails = useCallback(async (bookingId: string) => {
    try {
      // Fetch booking with related data
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
      return booking;
    } catch {
      return null;
    }
  }, []);

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
          
          const newBooking = payload.new as NewBookingPayload;
          
          // Fetch full booking details to check if it's for creator's product
          const bookingDetails = await fetchBookingDetails(newBooking.id);
          
          if (!bookingDetails) return;
          
          const productId = bookingDetails.schedule?.product_id;
          
          // Check if this booking is for one of the creator's products
          if (!productIdsRef.current.includes(productId)) {
            console.log("Booking is not for creator's product, ignoring");
            return;
          }

          // Play notification sound
          playNotificationSound();

          // Show toast notification
          const userName = bookingDetails.user?.name || t("student");
          const productTitle = bookingDetails.schedule?.product?.title || "";
          const date = bookingDetails.time_slot?.date || "";
          const time = bookingDetails.time_slot?.start_time || "";

          toast.success(t("newBookingNotification"), {
            description: `${userName} ${t("bookedSession")} "${productTitle}" ${t("onDate")} ${date} ${t("atTime")} ${time}`,
            duration: 10000,
          });

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
  }, [enabled, productIds, fetchBookingDetails, playNotificationSound, queryClient, t]);
};

