

## Problem

FCM messages are sent with a `notification` field. This causes a platform-level split:

- **Foreground**: Browser suppresses auto-display, passes to `onMessage`. Code tries `serviceWorker.showNotification()` but this doesn't reliably work on all platforms when the `notification` field is present (the OS may treat it as "already handled").
- **Background**: Browser auto-displays the notification from the `notification` field. Works fine.

This is why push only works when the app is closed and not when it's open.

In-app UI (toasts, tab badges, notification list) works via Supabase Realtime which only runs when the app is open -- this is by design and cannot work when the app is closed. When the app reopens, `useAppResume` refreshes all data so these update.

## Solution

Switch ALL FCM messages to **data-only format** (remove `notification` field, put `title`/`body` in `data`). This gives full control over notification display in both states:

- **Foreground**: `onMessage` fires → show via `serviceWorker.showNotification()` (reliable with data-only)
- **Background**: `onBackgroundMessage` fires → show manually via `self.registration.showNotification()`

## Files to change

### 1. Edge Functions (5 files) — remove `notification`, add title/body to `data`

In each function's FCM message body, change from:
```js
notification: { title, body },
data: { type: "booking", ... },
```
to:
```js
data: { title, body, type: "booking", ... },
```

Files:
- `supabase/functions/notify-booking-change/index.ts`
- `supabase/functions/notify-purchase-change/index.ts`
- `supabase/functions/notify-reschedule-request/index.ts`
- `supabase/functions/notify-reschedule-response/index.ts`
- `supabase/functions/send-push-notification/index.ts`

### 2. `public/firebase-messaging-sw.js` — show notification manually in background

Update `onBackgroundMessage` to manually display notification from `data` fields:
```js
messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  if (data.title) {
    self.registration.showNotification(data.title, {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.type || "default",
      data: data,
      vibrate: [200, 100, 200],
      requireInteraction: true
    });
  }
});
```

### 3. `src/lib/firebase.ts` — read from `data` in foreground handler

Update `onForegroundMessage` to read title/body from `payload.data` instead of `payload.notification`:
```js
callback({
  title: payload.data?.title || payload.notification?.title,
  body: payload.data?.body || payload.notification?.body,
  data: payload.data
});
```

### 4. No changes needed to `useFCMRegistration.ts` — already uses `serviceWorker.showNotification()`

## What this achieves

| Feature | App Open | App Closed |
|---------|----------|------------|
| Push notification | via onMessage + SW | via onBackgroundMessage + SW |
| App badge (icon) | via setAppBadge() | via OS when push arrives |
| Toast | via Realtime | on reopen via useAppResume |
| Tab badge | via Realtime | on reopen via useAppResume |
| Notification list | via Realtime | on reopen via useAppResume |

