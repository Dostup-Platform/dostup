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

  // Foreground message handler — logging only.
  // Notification display is handled by the Service Worker push event handler.
  useEffect(() => {
    if (!isRegistered) return;

    const unsubscribe = onForegroundMessage((payload) => {
      console.log("FCM foreground message received:", payload.title);
      // Notification is shown by SW push handler, no need to call showNotification() here
    });

    return unsubscribe;
  }, [isRegistered]);

  return {
    isRegistered,
    isRegistering
  };
};
