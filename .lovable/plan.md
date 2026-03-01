

# Убрать user_phone из кода

## Ситуация
`user_phone` используется в 4 таблицах: `push_tokens`, `notification_preferences`, `booking_reminders`, `booking_cancellations`. Во всех случаях вместо телефона уже передаётся `userId` (UUID) или данные можно получить через `simple_user_id`. Колонки `user_phone` в `push_tokens`, `notification_preferences` и `booking_reminders` — NOT NULL, поэтому нужна миграция.

## Шаги

### 1. Миграция БД
- `push_tokens`: удалить колонку `user_phone` (все данные дублируют `user_id`)
- `notification_preferences`: удалить колонку `user_phone` (дублирует `user_id`)
- `booking_reminders`: удалить колонку `user_phone` (есть `simple_user_id`)
- `booking_cancellations`: сделать `user_phone` nullable (уже nullable) — оставить как есть, но перестать записывать

### 2. Edge functions (4 файла)
- **`manage-push-token/index.ts`**: убрать все ссылки на `user_phone`, использовать только `user_id`. Для создателей (не UUID) — записывать `user_id` как null и искать по `user_role = 'creator'`
- **`send-reminders/index.ts`**: убрать `user_phone` из интерфейса Reminder, группировку делать только по `simple_user_id`
- **`send-push-notification/index.ts`** и **`notify-booking-change/index.ts`** и **`notify-purchase-change/index.ts`**: уже не используют `user_phone` — без изменений

### 3. Фронтенд (4 файла)
- **`src/lib/firebase.ts`**: переименовать `sendPushNotification` параметр `userPhone` → `userId`
- **`src/components/NotificationPreferences.tsx`**: убрать `user_phone: userId` из insert
- **`src/hooks/useSimplePurchases.ts`**: убрать `user_phone` из обоих insert в `booking_cancellations`, добавить `simple_user_id`
- **`src/hooks/useRealtimeStudentNotifications.ts`**: убрать fallback на `user_phone`, фильтровать только по `simple_user_id`
- **`src/components/creator/CreatorNotificationsTab.tsx`**: убрать `user_phone` из интерфейса `BookingCancellation`

