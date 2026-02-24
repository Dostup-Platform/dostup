

# Убрать зависимость от телефона + починить пуш-уведомления

## Что не так сейчас

1. **Телефон как идентификатор** -- во многих местах кода и в базе данных используется сгенерированный "телефон" (`user_1768557721538_25xrwyl`) для связи данных. Никто этот телефон не вводит, он бесполезен.

2. **Пуш-уведомление о материале** -- серверная часть отправляет FCM успешно (подтверждено логами), но уведомление не приходит на устройство. Вероятные причины:
   - Service Worker не обрабатывает клик по `material_unlocked` типу (сейчас он обрабатывает только booking, cancellation, payment)
   - На iOS web push работает только если PWA установлена на домашний экран
   - Нет проверки "жив ли ещё токен" при повторном входе

## План изменений

### Часть 1: База данных -- добавить `user_id` вместо `user_phone`

**Миграция:**
- Таблица `notification_preferences`: добавить колонку `user_id UUID`, сделать уникальный индекс, убрать зависимость от `user_phone`
- Таблица `booking_reminders`: добавить колонку `simple_user_id UUID`, заполнить из существующих данных
- Таблица `booking_cancellations`: уже содержит достаточно данных (user_name), `user_phone` можно оставить пустым
- DB-функция `create_booking_reminders`: переписать на использование `simple_user_id` вместо `user_phone`

### Часть 2: Edge-функции -- перейти на `userId`

**`manage-push-token`:**
- Убрать `userPhone` как обязательный параметр, использовать только `userId`
- Для creators сохранить текущую логику (у них нет user_id)
- Валидацию identity переписать на `userId`

**`send-push-notification`:**
- Убрать fallback на `userPhone`, искать токены только по `user_id`

**`unlock-materials`:**
- Убрать fallback поиск токенов по `user_phone` (строки 134-149)
- Искать только по `user_id`

**`send-reminders`:**
- Переписать на поиск push-токенов по `simple_user_id` вместо `user_phone`

### Часть 3: Фронтенд -- убрать `userPhone` из всех хуков и компонентов

**`src/lib/firebase.ts`:**
- `registerPushToken()`: убрать параметр `userPhone`, использовать только `userId`
- `unregisterPushToken()`: принимать `userId` вместо `userPhone`

**`src/hooks/useFCMRegistration.ts`:**
- Убрать `userPhone` из интерфейса, использовать только `userId`

**`src/components/NotificationPreferences.tsx`:**
- Переименовать prop `userPhone` в `userId`
- Запросы в `notification_preferences` делать по `user_id` вместо `user_phone`

**`src/hooks/useNotificationPreferences.ts`:**
- Переименовать параметр на `userId`

**`src/hooks/useRealtimeStudentNotifications.ts`:**
- Убрать параметр `userPhone`
- Matching отмен по `simple_user_id` через join вместо `user_phone`

**`src/hooks/useRealtimeTeacherNotifications.ts`:**
- Убрать `teacherPhone`

**`src/pages/Dashboard.tsx`:**
- Убрать `user.phone` из вызовов FCM, уведомлений и отмен
- Запрос отмен делать через `simple_user_id` 

**`src/pages/TeacherDashboard.tsx`:**
- Убрать `teacherUser?.phone` из FCM и props

**`src/components/dashboard/AccountTab.tsx`:**
- Передавать `user.id` в `NotificationPreferences` вместо `user.phone`

**`src/components/teacher/TeacherAccountTab.tsx`:**
- Убрать prop `teacherPhone`

**`src/components/creator/CreatorAccountTab.tsx`:**
- Передавать `creatorName` в NotificationPreferences (для creators phone=creatorName)

**`src/components/dashboard/NotificationsTab.tsx`:**
- Запрос отмен по `simple_user_id` вместо `user_phone`

**`src/components/creator/CreatorNotificationsTab.tsx`:**
- Убрать `user_phone` из интерфейса уведомлений

### Часть 4: Починить пуш при фоновом режиме

**`public/firebase-messaging-sw.js`:**
- Добавить обработку типа `material_unlocked` в `notificationclick` -- перенаправлять на `/dashboard`

**`src/hooks/useFCMRegistration.ts`:**
- При каждом открытии приложения перерегистрировать токен (убрать `registrationAttempted.current` блокировку), чтобы токен всегда был актуальным

### Часть 5: Таблица `booking_cancellations` -- добавить `simple_user_id`

- Добавить колонку `simple_user_id UUID` для прямой связи с пользователем
- Обновить код создания записей об отмене, чтобы записывать `simple_user_id`
- Фильтрация отмен ученика -- по `simple_user_id` вместо `user_phone`

---

## Технические детали

### Миграция SQL

```text
-- 1. notification_preferences: добавить user_id
ALTER TABLE notification_preferences ADD COLUMN user_id UUID;
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_preferences_user_id 
  ON notification_preferences(user_id) WHERE user_id IS NOT NULL;

-- 2. booking_reminders: добавить simple_user_id
ALTER TABLE booking_reminders ADD COLUMN simple_user_id UUID;

-- 3. booking_cancellations: добавить simple_user_id
ALTER TABLE booking_cancellations ADD COLUMN simple_user_id UUID;

-- 4. Обновить функцию create_booking_reminders для использования simple_user_id
```

### Порядок выполнения
1. Миграция БД (добавить новые колонки)
2. Обновить edge-функции (они начнут использовать user_id)
3. Обновить фронтенд (хуки и компоненты)
4. Починить service worker для material_unlocked
5. Убрать блокировку перерегистрации FCM токена

### Затронутые файлы (около 15 файлов)
- 1 миграция SQL
- 4 edge-функции
- 1 service worker
- 9 фронтенд-файлов (хуки, компоненты, страницы)

