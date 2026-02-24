import { useEffect, useState } from "react";
import { initializeFirebaseMessaging, registerPushToken, onForegroundMessage } from "@/lib/firebase";

interface UseFCMRegistrationOptions {
  userId?: string;
  userRole: "creator" | "student" | "teacher";
  enabled?: boolean;
}

export const useFCMRegistration = ({
  userId,
  userRole,
  enabled = true
}: UseFCMRegistrationOptions) => {
  const [isRegistered, setIsRegistered] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    if (!enabled || !userId) return;

    const registerFCM = async () => {
      // Check if notifications are supported
      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        console.log("Push notifications not supported");
        return;
      }

      setIsRegistering(true);

      try {
        // Initialize Firebase Messaging
        const messaging = await initializeFirebaseMessaging();
        if (!messaging) {
          console.log("Firebase Messaging not available");
          setIsRegistering(false);
          return;
        }

        // Register push token
        const success = await registerPushToken(userId, userRole);
        setIsRegistered(success);

        if (success) {
          console.log(`FCM registered for ${userRole}: ${userId}`);
        }
      } catch (error) {
        console.error("Error registering FCM:", error);
      } finally {
        setIsRegistering(false);
      }
    };

    // Delay registration to not block initial render
    const timeout = setTimeout(registerFCM, 2000);
    return () => clearTimeout(timeout);
  }, [enabled, userId, userRole]);

  // Set up foreground message handler
  // NOTE: We don't show toast here because realtime hooks already show toasts
  // This handler is only for logging and potential future use
  useEffect(() => {
    if (!isRegistered) return;

    const unsubscribe = onForegroundMessage((payload) => {
      console.log("FCM foreground message received:", payload.title);
      
      // Show system notification even when app is in foreground
      if (Notification.permission === "granted" && payload.title) {
        try {
          new Notification(payload.title, {
            body: payload.body || "",
            icon: "/icon-192.png",
            badge: "/icon-192.png",
            tag: payload.data?.type || "default",
          });
        } catch (e) {
          // Fallback for environments where new Notification() isn't supported
          navigator.serviceWorker?.ready.then((reg) => {
            reg.showNotification(payload.title!, {
              body: payload.body || "",
              icon: "/icon-192.png",
              badge: "/icon-192.png",
              tag: payload.data?.type || "default",
            });
          });
        }
      }
    });

    return unsubscribe;
  }, [isRegistered]);

  return {
    isRegistered,
    isRegistering
  };
};
