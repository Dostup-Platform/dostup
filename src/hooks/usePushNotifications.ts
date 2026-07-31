import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isPushConfigured, requestPushToken } from "@/lib/firebase";
import type { AppRole } from "@/contexts/AuthContext";

const STORAGE_KEY = "push-fcm-token";

export function usePushNotifications(userId: string | undefined, role: AppRole | null) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setEnabled(typeof Notification !== "undefined" && Notification.permission === "granted" && !!localStorage.getItem(STORAGE_KEY));
  }, []);

  const enable = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const token = await requestPushToken();
      if (!token) {
        throw new Error(
          Notification.permission === "denied"
            ? "Уведомления заблокированы в браузере. Разрешите их в настройках сайта."
            : "Не удалось включить уведомления на этом устройстве.",
        );
      }
      const { error } = await supabase.functions.invoke("manage-push-token", {
        body: { action: "register", userRole: role ?? "student", fcmToken: token, deviceInfo: navigator.userAgent },
      });
      if (error) throw error;
      localStorage.setItem(STORAGE_KEY, token);
      setEnabled(true);
    } finally {
      setLoading(false);
    }
  }, [userId, role]);

  const disable = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const token = localStorage.getItem(STORAGE_KEY);
      await supabase.functions.invoke("manage-push-token", {
        body: { action: "unregister", userRole: role ?? "student", fcmToken: token ?? undefined },
      });
      localStorage.removeItem(STORAGE_KEY);
      setEnabled(false);
    } finally {
      setLoading(false);
    }
  }, [userId, role]);

  return { enabled, loading, enable, disable, isPushConfigured };
}
