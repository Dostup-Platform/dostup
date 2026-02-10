import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { 
  playCancellationSound, 
  playPaymentSound,
} from "@/hooks/useNotificationPermission";
import { setAppBadge } from "@/lib/appBadge";

export const useRealtimeStudentNotifications = (
  userId: string | undefined,
  userPhone: string | undefined,
  enabled: boolean = true,
  currentBadgeCount: number = 0,
  purchasedProductIds: string[] = []
) => {
  const queryClient = useQueryClient();
  const { language } = useLanguage();
  const badgeCountRef = useRef<number>(currentBadgeCount);
  const purchasedProductIdsRef = useRef<string[]>(purchasedProductIds);
  const activeTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  
  useEffect(() => {
    badgeCountRef.current = currentBadgeCount;
  }, [currentBadgeCount]);

  useEffect(() => {
    purchasedProductIdsRef.current = purchasedProductIds;
  }, [purchasedProductIds]);

  // Show unlock toast helper
  const showUnlockToast = useCallback((materialTitle: string, productTitle: string) => {
    playPaymentSound();
    const title = language === "ru" ? "Материал доступен! 📚" : "Материал қолжетімді! 📚";
    const description = language === "ru"
      ? `Материал "${materialTitle}" теперь доступен в курсе "${productTitle}"`
      : `"${materialTitle}" материалы "${productTitle}" курсында қолжетімді`;
    toast.success(title, { description, duration: 10000 });
    const newBadgeCount = badgeCountRef.current + 1;
    setAppBadge(newBadgeCount);
    queryClient.invalidateQueries({ queryKey: ["student-material-unlocks"] });
    queryClient.invalidateQueries({ queryKey: ["student-material-unlocks-count"] });
    queryClient.invalidateQueries({ queryKey: ["materials"] });
  }, [language, queryClient]);

  // Client-side timers for upcoming material unlocks — gives instant notifications
  useEffect(() => {
    if (!enabled || purchasedProductIds.length === 0) return;

    const setupTimers = async () => {
      // Clear existing timers
      activeTimersRef.current.forEach(timer => clearTimeout(timer));
      activeTimersRef.current.clear();

      // Find materials with available_at in the next 60 minutes
      const now = new Date();
      const sixtyMinutesFromNow = new Date(now.getTime() + 60 * 60 * 1000);

      const { data: upcomingMaterials } = await supabase
        .from("materials")
        .select("id, title, product_id, available_at, product:products(title)")
        .in("product_id", purchasedProductIds)
        .not("available_at", "is", null)
        .gt("available_at", now.toISOString())
        .lte("available_at", sixtyMinutesFromNow.toISOString());

      if (!upcomingMaterials || upcomingMaterials.length === 0) return;

      for (const material of upcomingMaterials) {
        const availableAt = new Date(material.available_at!);
        const delay = availableAt.getTime() - Date.now();
        
        if (delay <= 0) continue;

        const timer = setTimeout(() => {
          const productTitle = (material as any).product?.title || "курс";
          showUnlockToast(material.title, productTitle);
          activeTimersRef.current.delete(material.id);
        }, delay);

        activeTimersRef.current.set(material.id, timer);
      }
    };

    setupTimers();

    // Re-check every 10 minutes for new scheduled materials
    const interval = setInterval(setupTimers, 10 * 60 * 1000);

    return () => {
      clearInterval(interval);
      activeTimersRef.current.forEach(timer => clearTimeout(timer));
      activeTimersRef.current.clear();
    };
  }, [enabled, purchasedProductIds, showUnlockToast]);

  useEffect(() => {
    if (!enabled || (!userPhone && !userId)) return;

    const channel = supabase
      .channel("student-all-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "booking_cancellations",
        },
        async (payload) => {
          const cancellation = payload.new as any;
          
          if (cancellation.cancelled_by !== "creator" && cancellation.cancelled_by !== "teacher") return;
          if (cancellation.user_phone !== userPhone) return;

          playCancellationSound();

          let reasonText = "";
          const reasons = cancellation.cancellation_reasons as string[] | null;
          const comment = cancellation.cancellation_comment as string | null;
          
          if (reasons && reasons.length > 0) {
            reasonText = reasons.join(", ");
          } else if (comment) {
            reasonText = comment;
          }

          const isByTeacher = cancellation.cancelled_by === "teacher";
          const title = language === "ru" ? "Запись отменена" : "Жазба болдырмалды";
          const cancellerText = isByTeacher 
            ? (language === "ru" ? "Учитель" : "Мұғалім")
            : (language === "ru" ? "Автор" : "Автор");
          let description = language === "ru"
            ? `${cancellerText} отменил вашу запись на "${cancellation.product_title}" на ${cancellation.slot_date} в ${cancellation.slot_time?.slice(0, 5)}`
            : `${cancellerText} сіздің "${cancellation.product_title}" сабағына ${cancellation.slot_date} күні ${cancellation.slot_time?.slice(0, 5)} жазбаңызды болдырмады`;
          
          if (reasonText) {
            description += language === "ru" ? `. Причина: ${reasonText}` : `. Себебі: ${reasonText}`;
          }

          toast.warning(title, { description, duration: 10000 });

          const newBadgeCount = badgeCountRef.current + 1;
          setAppBadge(newBadgeCount);

          queryClient.invalidateQueries({ queryKey: ["student-cancellations"] });
          queryClient.invalidateQueries({ queryKey: ["student-cancellations-count"] });
          queryClient.invalidateQueries({ queryKey: ["simple-bookings"] });
          queryClient.invalidateQueries({ queryKey: ["simple-time-slots"] });
          queryClient.invalidateQueries({ queryKey: ["all-bookings-for-schedule"] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "simple_purchases",
        },
        async (payload) => {
          const purchase = payload.new as any;
          const oldPurchase = payload.old as any;
          
          if (oldPurchase.status === "pending" && (purchase.status === "confirmed" || purchase.status === "completed")) {
            if (!userId || purchase.simple_user_id !== userId) return;

            playPaymentSound();

            const { data: product } = await supabase
              .from("products")
              .select("title")
              .eq("id", purchase.product_id)
              .single();

            const title = language === "ru" ? "Оплата подтверждена! ✅" : "Төлем расталды! ✅";
            const description = language === "ru"
              ? `Ваша оплата за "${product?.title || "продукт"}" подтверждена`
              : `"${product?.title || "өнім"}" төлеміңіз расталды`;

            toast.success(title, { description, duration: 10000 });

            const newBadgeCount = badgeCountRef.current + 1;
            setAppBadge(newBadgeCount);

            queryClient.invalidateQueries({ queryKey: ["student-purchases"] });
            queryClient.invalidateQueries({ queryKey: ["simple-purchases"] });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "material_unlocks",
        },
        async (payload) => {
          const unlock = payload.new as any;
          
          // Check if this student purchased the product
          if (!purchasedProductIdsRef.current.includes(unlock.product_id)) return;

          // Check if we already showed a toast via client-side timer (dedup)
          // The timer already cleared itself, so just show toast from realtime too
          showUnlockToast(unlock.material_title, unlock.product_title);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, userId, userPhone, queryClient, language, showUnlockToast]);
};
