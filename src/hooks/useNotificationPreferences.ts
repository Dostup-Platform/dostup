import { useQuery } from "@tanstack/react-query";
import { studentCreds, invokeApi } from "@/lib/sessionApi";

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

export const useNotificationPreferences = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["notification-preferences", userId],
    queryFn: async () => {
      if (!userId) return DEFAULT_PREFERENCES;
      const data = await invokeApi<{
        prefs: {
          reminder_24h: boolean;
          reminder_morning: boolean;
          morning_time: string | null;
          reminder_2h: boolean;
        } | null;
      }>("manage-account", {
        action: "get_prefs",
        ...studentCreds(),
      });
      if (!data.prefs) return DEFAULT_PREFERENCES;
      return {
        reminder_24h: data.prefs.reminder_24h,
        reminder_morning: data.prefs.reminder_morning,
        morning_time: data.prefs.morning_time?.slice(0, 5) || "08:00",
        reminder_2h: data.prefs.reminder_2h,
      } as NotificationPreferences;
    },
    enabled: !!userId,
  });
};
