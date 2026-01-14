import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { 
  playCancellationSound, 
  showBrowserNotification 
} from "@/hooks/useNotificationPermission";

export const useRealtimeStudentNotifications = (
  userPhone: string | undefined,
  enabled: boolean = true
) => {
  const queryClient = useQueryClient();
  const { language } = useLanguage();

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
          
          // Проверяем что это отмена от автора и для текущего пользователя
          if (cancellation.cancelled_by !== "creator") return;
          if (cancellation.user_phone !== userPhone) return;

          // Воспроизвести звук отмены
          playCancellationSound();

          // Показать toast
          const title = language === "ru" ? "Запись отменена" : "Жазба болдырмалды";
          const description = language === "ru"
            ? `Автор отменил вашу запись на "${cancellation.product_title}" на ${cancellation.slot_date} в ${cancellation.slot_time?.slice(0, 5)}`
            : `Автор сіздің "${cancellation.product_title}" сабағына ${cancellation.slot_date} күні ${cancellation.slot_time?.slice(0, 5)} жазбаңызды болдырмады`;

          toast.warning(title, { description, duration: 10000 });

          // Браузерное push-уведомление
          showBrowserNotification(title, description);

          // Обновить данные
          queryClient.invalidateQueries({ queryKey: ["student-cancellations"] });
          queryClient.invalidateQueries({ queryKey: ["student-cancellations-count"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, userPhone, queryClient, language]);
};
