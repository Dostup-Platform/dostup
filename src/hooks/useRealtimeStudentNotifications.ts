import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { 
  playCancellationSound, 
  showBrowserNotification 
} from "@/hooks/useNotificationPermission";
import { sendPushNotification } from "@/lib/firebase";
import { setAppBadge } from "@/lib/appBadge";

export const useRealtimeStudentNotifications = (
  userPhone: string | undefined,
  enabled: boolean = true,
  currentBadgeCount: number = 0
) => {
  const queryClient = useQueryClient();
  const { language } = useLanguage();
  const badgeCountRef = useRef<number>(currentBadgeCount);
  
  // Keep badge count ref updated
  useEffect(() => {
    badgeCountRef.current = currentBadgeCount;
  }, [currentBadgeCount]);

  useEffect(() => {
    if (!enabled || !userPhone) return;

    const channel = supabase
      .channel("student-cancellation-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "booking_cancellations",
        },
        async (payload) => {
          const cancellation = payload.new as any;
          
          // Проверяем что это отмена от автора или учителя и для текущего пользователя
          if (cancellation.cancelled_by !== "creator" && cancellation.cancelled_by !== "teacher") return;
          if (cancellation.user_phone !== userPhone) return;

          // Воспроизвести звук отмены
          playCancellationSound();

          // Формируем текст причины
          let reasonText = "";
          const reasons = cancellation.cancellation_reasons as string[] | null;
          const comment = cancellation.cancellation_comment as string | null;
          
          if (reasons && reasons.length > 0) {
            reasonText = reasons.join(", ");
          } else if (comment) {
            reasonText = comment;
          }

          // Показать toast
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

          // Update app badge
          const newBadgeCount = badgeCountRef.current + 1;
          setAppBadge(newBadgeCount);

          // Обновить данные - включая слоты и бронирования для real-time
          queryClient.invalidateQueries({ queryKey: ["student-cancellations"] });
          queryClient.invalidateQueries({ queryKey: ["student-cancellations-count"] });
          queryClient.invalidateQueries({ queryKey: ["simple-bookings"] });
          queryClient.invalidateQueries({ queryKey: ["simple-time-slots"] });
          queryClient.invalidateQueries({ queryKey: ["all-bookings-for-schedule"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, userPhone, queryClient, language]);
};
