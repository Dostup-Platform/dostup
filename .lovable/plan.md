

## Problem

After switching to data-only FCM, foreground push notifications still don't appear on mobile. The root cause: `ServiceWorkerRegistration.showNotification()` called from the **main thread** (in `useFCMRegistration.ts`) is silently blocked on iOS/Android PWA standalone mode. On mobile, `showNotification()` only works reliably when called from within a Service Worker's **push event handler**.

When the app is in foreground, Firebase SDK intercepts the push event and forwards it to `onMessage` in the main thread — but at that point the push event context is lost and `showNotification()` fails silently.

## Solution

Add a raw `push` event listener in `firebase-messaging-sw.js` **before** Firebase initialization. This listener:
1. Checks if any app window is visible (foreground)
2. If foreground → shows notification from within the push event (the only reliable way on mobile)
3. If background → skips, letting Firebase's `onBackgroundMessage` handle it (avoids duplicates)

## Changes

### 1. `public/firebase-messaging-sw.js`

Add a `push` event listener **before** Firebase init:

```js
// BEFORE firebase.initializeApp(...)

self.addEventListener('push', (event) => {
  const payload = event.data?.json() || {};
  const data = payload.data || {};
  
  if (!data.title) return; // nothing to show

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const isForeground = clientList.some(c => c.visibilityState === 'visible');
      
      if (isForeground) {
        // Show notification from push context — only way that works on iOS/Android PWA
        return self.registration.showNotification(data.title, {
          body: data.body || "",
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          tag: data.type || "default",
          data: data,
        });
      }
      // Background: let onBackgroundMessage handle it
    })
  );
});
```

### 2. `src/hooks/useFCMRegistration.ts`

Remove the `showNotification()` call from the foreground handler — it's now handled by the SW. Keep the foreground listener only for logging:

```typescript
useEffect(() => {
  if (!isRegistered) return;

  const unsubscribe = onForegroundMessage((payload) => {
    console.log("FCM foreground message received:", payload.title);
    // Notification display is handled by the Service Worker push handler
    // No need to call showNotification() here
  });

  return unsubscribe;
}, [isRegistered]);
```

### Why this works

| State | Push event flow | Notification shown by |
|-------|----------------|----------------------|
| Foreground | push → our handler detects visible client → shows notification from push context | SW push handler |
| Background | push → our handler skips → Firebase `onBackgroundMessage` → shows notification | Firebase SW handler |

Two files changed. Edge functions unchanged.

