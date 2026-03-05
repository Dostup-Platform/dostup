

## Problem

The `firebase-messaging-sw.js` is registered as a **separate** service worker (not managed by Workbox/vite-plugin-pwa). It does NOT contain `skipWaiting()` or `clients.claim()`, so the user's device is still running the **old version** of this file. Changes we made are never activating on the phone.

Additionally, the registration call in `firebase.ts` doesn't pass `updateViaCache: 'none'`, so the browser may serve a cached copy of the old SW file.

## Changes

### 1. `public/firebase-messaging-sw.js` — add self-activation at the top

Add `skipWaiting` + `clientsClaim` so the new SW activates immediately when detected:

```js
// At the very top of the file, before everything:
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
```

### 2. `src/lib/firebase.ts` — force SW update on registration

Change the `register` call to bypass cache and trigger update:

```ts
const registration = await navigator.serviceWorker.register(
  "/firebase-messaging-sw.js",
  { updateViaCache: 'none' }
);
// Force check for updated SW
registration.update();
```

These two changes ensure the new SW code actually reaches the user's device on next app open.

