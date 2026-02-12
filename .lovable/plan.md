

# Fix: Push notification not appearing when app is in foreground

## Root Cause

When the student has the app **open on their phone**, FCM delivers the message to the foreground handler (`onMessage`), NOT as a system push notification. Currently the foreground handler only logs the message:

```text
App in background --> SW onBackgroundMessage --> system notification appears (OK)
App in foreground --> onMessage handler --> only logs, no notification (BROKEN)
```

The toast notification works because it comes from the Supabase Realtime subscription (separate system). But push doesn't appear because FCM foreground messages are intentionally silent by design -- the app must explicitly show a notification.

## Solution

In `src/hooks/useFCMRegistration.ts`, update the foreground message handler to show a browser system notification using the Notifications API (`new Notification()`). This way the student gets exactly **1 push notification** regardless of whether the app is open or closed.

## File Changes

### `src/hooks/useFCMRegistration.ts`
Update the `onForegroundMessage` callback (lines 69-72) to show a system notification:

```typescript
const unsubscribe = onForegroundMessage((payload) => {
  console.log("FCM foreground message received:", payload.title);
  
  // Show system notification even when app is in foreground
  if (Notification.permission === "granted" && payload.title) {
    try {
      new Notification(payload.title, {
        body: payload.body || "",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: payload.data?.type || "default", // tag prevents duplicates
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
```

The `tag` field ensures that if somehow the same notification type fires twice, the browser replaces it instead of showing a duplicate.

## Result

```text
App in background --> FCM auto-displays notification (1 push)
App in foreground --> onMessage --> new Notification() (1 push)
```

One push notification in both scenarios. Toast continues to work separately via Realtime.
