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
  enabled: boolean = true,
  currentBadgeCount: number = 0,
  purchasedProductIds: string[] = []
) => {
  const queryClient = useQueryClient();
  const { language } = useLanguage();
  const badgeCountRef = useRef<number>(currentBadgeCount);
  const purchasedProductIdsRef = useRef<string[]>(purchasedProductIds);
  const activeTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // Dedup: track material IDs for which we already showed a toast
  const shownUnlockMaterialIdsRef = useRef<Set<string>>(new Set());
  
  useEffect(() => {
    badgeCountRef.current = currentBadgeCount;
  }, [currentBadgeCount]);

  useEffect(() => {
    purchasedProductIdsRef.current = purchasedProductIds;
  }, [purchasedProductIds]);

  // Show unlock toast helper — with dedup by materialId
  const showUnlockToast = useCallback((materialId: string, materialTitle: string, productTitle: string) => {
    // Dedup: don't show same material toast twice
    if (shownUnlockMaterialIdsRef.current.has(materialId)) return;
    shownUnlockMaterialIdsRef.current.add(materialId);

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
  // Re-runs on visibility change to recover from iOS freeze
  useEffect(() => {
    if (!enabled || purchasedProductIds.length === 0) return;

    const setupTimers = async () => {
      // Clear existing timers
      activeTimersRef.current.forEach(timer => clearTimeout(timer));
      activeTimersRef.current.clear();

      const now = new Date();
      const sixtyMinutesFromNow = new Date(now.getTime() + 60 * 60 * 1000);

      // Also check for materials that JUST became available (up to 5 min ago) for missed unlocks
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

      const { data: upcomingMaterials } = await supabase
        .from("materials")
        .select("id, title, product_id, available_at, product:products(title)")
        .in("product_id", purchasedProductIds)
        .not("available_at", "is", null)
        .gt("available_at", fiveMinutesAgo.toISOString())
        .lte("available_at", sixtyMinutesFromNow.toISOString());

      if (!upcomingMaterials || upcomingMaterials.length === 0) return;

      for (const material of upcomingMaterials) {
        const availableAt = new Date(material.available_at!);
        const delay = availableAt.getTime() - Date.now();
        
        // If already available (delay <= 0), show toast immediately for recently unlocked
        if (delay <= 0) {
          const productTitle = (material as any).product?.title || "курс";
          showUnlockToast(material.id, material.title, productTitle);
          continue;
        }

        const timer = setTimeout(() => {
          const productTitle = (material as any).product?.title || "курс";
          showUnlockToast(material.id, material.title, productTitle);
          activeTimersRef.current.delete(material.id);
        }, delay);

        activeTimersRef.current.set(material.id, timer);
      }
    };

    setupTimers();

    // Re-setup timers when app resumes from background
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        setupTimers();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const interval = setInterval(setupTimers, 10 * 60 * 1000);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(interval);
      activeTimersRef.current.forEach(timer => clearTimeout(timer));
      activeTimersRef.current.clear();
    };
  }, [enabled, purchasedProductIds, showUnlockToast]);

  useEffect(() => {
    if (!enabled || !userId) return;

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
          if (cancellation.simple_user_id !== userId) return;

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
            if (purchase.simple_user_id !== userId) return;

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
          table: "booking_reschedules",
        },
        async (payload) => {
          const reschedule = payload.new as any;
          
          if (reschedule.simple_user_id !== userId) return;

          playCancellationSound();

          let reasonText = "";
          if (reschedule.comment) {
            reasonText = reschedule.comment;
          } else if (reschedule.reasons?.length > 0) {
            reasonText = reschedule.reasons.join(", ");
          }

          const title = language === "ru" ? "Урок перенесён" : "Сабақ ауыстырылды";
          let description = language === "ru"
            ? `Урок "${reschedule.product_title}" перенесён с ${reschedule.old_date} ${reschedule.old_time?.slice(0, 5)} на ${reschedule.new_date} ${reschedule.new_time?.slice(0, 5)}`
            : `"${reschedule.product_title}" сабағы ${reschedule.old_date} ${reschedule.old_time?.slice(0, 5)} күнінен ${reschedule.new_date} ${reschedule.new_time?.slice(0, 5)} күніне ауыстырылды`;
          
          if (reasonText) {
            description += language === "ru" ? `. Причина: ${reasonText}` : `. Себебі: ${reasonText}`;
          }

          toast.warning(title, { description, duration: 10000 });

          const newBadgeCount = badgeCountRef.current + 1;
          setAppBadge(newBadgeCount);

          queryClient.invalidateQueries({ queryKey: ["simple-bookings"] });
          queryClient.invalidateQueries({ queryKey: ["simple-time-slots"] });
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
          
          if (!purchasedProductIdsRef.current.includes(unlock.product_id)) return;

          // Dedup: showUnlockToast checks shownUnlockMaterialIdsRef internally
          showUnlockToast(unlock.material_id || unlock.id, unlock.material_title, unlock.product_title);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, userId, queryClient, language, showUnlockToast]);
};