import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface NotificationPreferences {
  user_id: string;
  reminder_24h: boolean;
  reminder_2h: boolean;
  reminder_morning: boolean;
  morning_time: string;
}

const defaults = (userId: string): NotificationPreferences => ({
  user_id: userId,
  reminder_24h: true,
  reminder_2h: true,
  reminder_morning: false,
  morning_time: "08:00:00",
});

export const useNotificationPreferences = (userId: string | undefined) =>
  useQuery({
    queryKey: ["notification-preferences", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return (data as NotificationPreferences | null) ?? defaults(userId!);
    },
  });

export const useUpdateNotificationPreferences = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      patch,
    }: {
      userId: string;
      patch: Partial<Omit<NotificationPreferences, "user_id">>;
    }) => {
      const { error } = await supabase
        .from("notification_preferences")
        .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: (_d, { userId }) => qc.invalidateQueries({ queryKey: ["notification-preferences", userId] }),
  });
};
