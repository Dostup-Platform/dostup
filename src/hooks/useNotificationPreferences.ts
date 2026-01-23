import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface NotificationPreferences {
  reminder_24h: boolean;
  reminder_morning: boolean;
  morning_time: string;
  reminder_2h: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  reminder_24h: true,
  reminder_morning: false,
  morning_time: "08:00",
  reminder_2h: true,
};

export const useNotificationPreferences = (userPhone: string | undefined) => {
  return useQuery({
    queryKey: ["notification-preferences", userPhone],
    queryFn: async () => {
      if (!userPhone) return DEFAULT_PREFERENCES;

      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_phone", userPhone)
        .maybeSingle();

      if (error) throw error;

      if (!data) return DEFAULT_PREFERENCES;

      return {
        reminder_24h: data.reminder_24h,
        reminder_morning: data.reminder_morning,
        morning_time: data.morning_time?.slice(0, 5) || "08:00",
        reminder_2h: data.reminder_2h,
      } as NotificationPreferences;
    },
    enabled: !!userPhone,
  });
};
