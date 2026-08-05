import { initializeApp, type FirebaseOptions } from "firebase/app";
import { getMessaging, getToken, isSupported, type Messaging } from "firebase/messaging";

const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined;

const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || authDomain?.replace(/\.firebaseapp\.com$/, ""),
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

export const isPushConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.messagingSenderId && firebaseConfig.appId,
);

let messagingInstance: Messaging | null = null;

async function getMessagingInstance(): Promise<Messaging | null> {
  if (!isPushConfigured) return null;
  if (messagingInstance) return messagingInstance;
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  const supported = await isSupported().catch(() => false);
  if (!supported) return null;
  const app = initializeApp(firebaseConfig);
  messagingInstance = getMessaging(app);
  return messagingInstance;
}

export async function requestPushToken(): Promise<string | null> {
  if (!isPushConfigured) return null;
  const messaging = await getMessagingInstance();
  if (!messaging) return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
    scope: "/firebase-cloud-messaging-push-scope",
  });

  const token = await getToken(messaging, {
    ...(vapidKey ? { vapidKey } : {}),
    serviceWorkerRegistration: registration,
  });
  return token || null;
}
