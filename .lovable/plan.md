# Запрос переноса от ученика с подтверждением от автора/учителя

## Общая архитектура

Ученик в разделе "Мои записи" получает кнопку (часы) для запроса переноса. При нажатии открывается диалог с выбором нового времени и причины с возможностью добавить комментарий. Запрос сохраняется в новую таблицу `reschedule_requests`. Автор/учитель получает уведомление, видит запрос в разделе "Уведомления" и может подтвердить или отклонить. При отклонении автоматически вставляется комментарий. Ученику приходит уведомление о результате.

## Изменения

### 1. Новая таблица `reschedule_requests`

```sql
CREATE TABLE reschedule_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL,
  simple_user_id UUID,
  schedule_id UUID,
  product_id UUID NOT NULL,
  product_title TEXT NOT NULL,
  old_date DATE NOT NULL,
  old_time TIME NOT NULL,
  new_date DATE NOT NULL,
  new_time TIME NOT NULL,
  reasons TEXT[] DEFAULT '{}',
  comment TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, approved, rejected
  response_comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  responded_at TIMESTAMPTZ
);
```

RLS: allow all (как `booking_reschedules`). Realtime enabled.

### 2. Новый компонент `StudentRescheduleDialog`

Аналог `RescheduleSlotDialog`, но для ученика — выбор новой даты, времени, причины. Открывается при нажатии кнопки часов рядом с записью в "Мои записи".

### 3. Изменения в `ScheduleTab.tsx` (студент)

- Добавить кнопку часов (Clock) рядом с кнопкой X в каждой записи в "Мои записи"
- При нажатии — открыть `StudentRescheduleDialog`
- Мутация: INSERT в `reschedule_requests` со статусом `pending`

### 4. Изменения в `CreatorNotificationsTab.tsx` и `TeacherNotificationsTab.tsx`

- Загрузить запросы на перенос (`reschedule_requests` WHERE status='pending')
- Показать карточку запроса с кнопками "Подтвердить" / "Отклонить"
- При подтверждении: обновить `reschedule_requests.status='approved'`, обновить `time_slots` (дату/время), создать запись в `booking_reschedules` для уведомления ученику
- При отклонении: обновить `reschedule_requests.status='rejected'`, вставить автоматический `response_comment`: "К сожалению, я не могу перенести урок на другое время. Если у вас не получится, то можете пожалуйста отменить запись и записаться на другой день?"

### 5. Уведомления

**Ученик → Автор/Учитель (запрос):**

- Realtime: подписка на INSERT в `reschedule_requests` в notification hooks
- Push: новая edge-функция `notify-reschedule-request` + DB trigger

**Автор/Учитель → Ученик (ответ):**

- Realtime: подписка на UPDATE в `reschedule_requests` (status changed) в `useRealtimeStudentNotifications`
- Push: edge-функция `notify-reschedule-response` + DB trigger

### 6. Edge-функции

- `notify-reschedule-request` — при INSERT в `reschedule_requests`, отправить FCM автору/учителю
- `notify-reschedule-response` — при UPDATE `reschedule_requests` (status → approved/rejected), отправить FCM ученику

### 7. DB триггеры

- `on_reschedule_request_insert` → вызов `notify-reschedule-request`
- `on_reschedule_request_update` → вызов `notify-reschedule-response`

### Примерный объём

- 1 миграция (таблица + триггеры + функции)
- 2 edge-функции
- 1 новый компонент (StudentRescheduleDialog)
- 4 файла с изменениями (ScheduleTab, CreatorNotificationsTab, TeacherNotificationsTab, useRealtimeStudentNotifications, useRealtimeTeacherNotifications)