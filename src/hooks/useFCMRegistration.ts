import { useEffect, useRef, useState } from "react";
import { initializeFirebaseMessaging, registerPushToken, onForegroundMessage } from "@/lib/firebase";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

interface UseFCMRegistrationOptions {
  userPhone: string | undefined;
  userRole: "creator" | "student";
  enabled?: boolean;
}

export const useFCMRegistration = ({
  userPhone,
  userRole,
  enabled = true
}: UseFCMRegistrationOptions) => {
  const [isRegistered, setIsRegistered] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const registrationAttempted = useRef(false);
  const { language } = useLanguage();

  useEffect(() => {
    if (!enabled || !userPhone || registrationAttempted.current) return;

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
        const success = await registerPushToken(userPhone, userRole);
        setIsRegistered(success);

        if (success) {
          console.log(`FCM registered for ${userRole}: ${userPhone}`);
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
  }, [enabled, userPhone, userRole]);

  // Set up foreground message handler
  useEffect(() => {
    if (!isRegistered) return;

    const unsubscribe = onForegroundMessage((payload) => {
      // Show toast for foreground messages
      // The actual notification sound is handled by the realtime hooks
      if (payload.title && payload.body) {
        toast.info(payload.title, {
          description: payload.body,
          duration: 8000
        });
      }
    });

    return unsubscribe;
  }, [isRegistered, language]);

  return {
    isRegistered,
    isRegistering
  };
};
