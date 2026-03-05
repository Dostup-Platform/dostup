

## Problem Analysis

The server-side is working correctly — logs confirm FCM messages are sent and accepted by Google:
```
FCM sent to userId=null (creator)
Booking INSERT: sent 1 notifications
```

The push_tokens table has a valid creator token (updated today). The problem is entirely on the **client/Service Worker side**.

### Root Cause: Two critical bugs

**Bug 1: Service Worker scope conflict**
Both the PWA Service Worker (from vite-plugin-pwa) and the Firebase SW (`firebase-messaging-sw.js`) are registered at scope `/`. A browser only allows ONE Service Worker per scope — the last one registered replaces the other. This means either:
- Firebase SW replaces PWA SW → app caching breaks
- PWA SW replaces Firebase SW → push notifications break

Currently, the Firebase SW is registered in `firebase.ts` at scope `/`, likely replacing the PWA SW. But if the PWA auto-update kicks in later, it replaces the Firebase SW, killing push handling.

**Bug 2: Push handler only fires for foreground**
The raw `push` event handler in `firebase-messaging-sw.js` only shows notifications when the app is in the foreground. For background, it relies on Firebase's `onBackgroundMessage`, but this may not fire reliably because the raw `push` handler already consumed the event via `event.waitUntil()`.

## Solution

### 1. `firebase-messaging-sw.js` — Show notifications in ALL states

Remove the foreground-only condition. Show notification from the raw push handler regardless of app state. Remove `onBackgroundMessage` entirely to avoid duplicate/conflicting handlers:

```js
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  const payload = event.data?.json() || {};
  const data = payload.data || {};

  if (!data.title) return;

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.type || "default",
      data: data,
      vibrate: [200, 100, 200],
      requireInteraction: true
    })
  );
});

// Remove importScripts, firebase.initializeApp, messaging.onBackgroundMessage
// Keep only the notificationclick handler
```

This eliminates the Firebase SDK dependency from the SW entirely. The raw push handler is all that's needed since we use data-only messages.

### 2. `src/lib/firebase.ts` — Register Firebase SW at a separate scope

Change the scope to `/firebase-cloud-messaging-push-scope` so it doesn't conflict with the PWA SW:

```ts
const registration = await navigator.serviceWorker.register(
  "/firebase-messaging-sw.js",
  { scope: "/firebase-cloud-messaging-push-scope", updateViaCache: 'none' }
);
```

### 3. Keep `notificationclick` handler in the SW (unchanged)

## Summary

| File | Change |
|------|--------|
| `firebase-messaging-sw.js` | Remove Firebase SDK, show notifications in ALL states, add skipWaiting/clientsClaim |
| `firebase.ts` | Register SW at separate scope to avoid PWA conflict |

