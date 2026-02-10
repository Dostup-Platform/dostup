import { useEffect, useRef, useState } from "react";
import { initializeFirebaseMessaging, registerPushToken, onForegroundMessage } from "@/lib/firebase";

interface UseFCMRegistrationOptions {
  userId?: string;
  userPhone?: string;
  userRole: "creator" | "student" | "teacher";
  enabled?: boolean;
}

export const useFCMRegistration = ({
  userId,
  userPhone,
  userRole,
  enabled = true
}: UseFCMRegistrationOptions) => {
  const [isRegistered, setIsRegistered] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const registrationAttempted = useRef(false);

  useEffect(() => {
    // Need at least userId or userPhone to register
    if (!enabled || (!userId && !userPhone) || registrationAttempted.current) return;

    const registerFCM = async () => {
      // Check if notifications are supported
      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        console.log("Push notifications not supported");
        return;
      }

      registrationAttempted.current = true;
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
        const success = await registerPushToken(userPhone || userId || "", userRole, userId);
        setIsRegistered(success);

        if (success) {
          console.log(`FCM registered for ${userRole}: ${userId || userPhone}`);
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
  }, [enabled, userId, userPhone, userRole]);

  // Set up foreground message handler
  // NOTE: We don't show toast here because realtime hooks already show toasts
  // This handler is only for logging and potential future use
  useEffect(() => {
    if (!isRegistered) return;

    const unsubscribe = onForegroundMessage((payload) => {
      // Log foreground message but don't show toast - realtime hooks handle that
      console.log("FCM foreground message received (toast handled by realtime hooks):", payload.title);
    });

    return unsubscribe;
  }, [isRegistered]);

  return {
    isRegistered,
    isRegistering
  };
};
