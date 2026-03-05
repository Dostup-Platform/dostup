

## Problem

When the app is open (foreground), FCM messages are intercepted by the `onMessage` handler in `useFCMRegistration.ts`. The code tries to show a system notification using `new Notification()`, but **on iOS PWA standalone mode, `new Notification()` is not supported** — it throws an error silently. The fallback to `serviceWorker.showNotification()` only runs in the `catch` block, but on some platforms the constructor doesn't throw — it just fails silently.

When the app is closed (background), the Service Worker handles FCM messages directly via `onBackgroundMessage`, which works correctly because the FCM SDK shows the notification automatically.

## Fix

Always use `navigator.serviceWorker.ready.then(reg => reg.showNotification(...))` as the **primary** method for foreground notifications. This is the only reliable way to show push notifications in PWA standalone mode on both iOS and Android.

## Change

**File**: `src/hooks/useFCMRegistration.ts` — lines 64-90

Replace the foreground message handler to always use the Service Worker API:

```typescript
const unsubscribe = onForegroundMessage((payload) => {
  console.log("FCM foreground message received:", payload.title);
  
  if (Notification.permission === "granted" && payload.title) {
    // Always use Service Worker to show notification — 
    // new Notification() doesn't work in iOS/Android PWA standalone mode
    navigator.serviceWorker?.ready.then((reg) => {
      reg.showNotification(payload.title!, {
        body: payload.body || "",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: payload.data?.type || "default",
        data: payload.data,
      });
    }).catch((e) => {
      console.error("Failed to show foreground notification:", e);
    });
  }
});
```

Single file change, no other files affected.

