

# Система запросов на перенос от автора/учителя к ученику

## Текущее поведение
Сейчас автор/учитель нажимает часы → сразу переносит урок (меняет `time_slots` напрямую) → ученик получает уведомление о свершившемся факте.

## Новое поведение
Автор/учитель нажимает часы → видит тот же диалог с причинами ("Не успеваю" / "Своя причина") → отправляет ЗАПРОС ученику → ученик видит запрос и может подтвердить/отклонить → результат приходит обратно автору/учителю.

## План изменений

### 1. Миграция БД
Добавить колонку `requested_by` в таблицу `reschedule_requests`:
```sql
ALTER TABLE reschedule_requests 
ADD COLUMN requested_by TEXT NOT NULL DEFAULT 'student';
```
Так же добавить `teacher_id` чтобы знать какому учителю слать ответ:
```sql
ALTER TABLE reschedule_requests 
ADD COLUMN teacher_id UUID DEFAULT NULL;
```

### 2. Creator/Teacher Schedule — изменить onConfirm
В `CreatorScheduleTab.tsx` и `TeacherScheduleTab.tsx` заменить вызов `useRescheduleSlot` (который напрямую меняет слот) на вставку в `reschedule_requests` с `requested_by = "creator"/"teacher"`. Создать новый хук `useCreatorRescheduleRequest`.

### 3. Уведомление ученику о запросе
Модифицировать `notify-reschedule-request` edge function: если `requested_by` != 'student', отправить пуш-уведомление ученику (по `simple_user_id`) вместо автора/учителя. Текст: "Преподаватель просит перенести урок".

### 4. UI ученика — показать входящие запросы от автора/учителя  
В `ScheduleTab.tsx` (дашборд ученика):
- Запросить `reschedule_requests` где `simple_user_id = user.id` И `requested_by IN ('creator', 'teacher')` И `status = 'pending'`
- На карточке записи показать оранжевый текст "Преподаватель просит перенести на [время]" с кнопками ✅ Подтвердить / ❌ Отклонить
- При подтверждении: обновить `time_slots` (дату и время) + обновить `reschedule_requests.status = 'approved'`
- При отклонении: показать диалог с причиной (как у автора) + обновить статус на 'rejected'

### 5. Уведомление автору/учителю об ответе
Модифицировать `notify-reschedule-response` edge function: если `requested_by != 'student'`, отправить пуш автору/учителю (а не ученику). Определять получателя по `teacher_id` или role=creator.

### 6. Realtime уведомления
- В `useRealtimeStudentNotifications.ts`: добавить подписку на INSERT в `reschedule_requests` где `requested_by` != 'student' — показать тост "Запрос на перенос от преподавателя"
- В `useRealtimeTeacherNotifications.ts` и `useRealtimeCreatorNotifications.ts` (если есть): добавить подписку на UPDATE `reschedule_requests` где `requested_by` = 'teacher'/'creator' — показать тост об ответе ученика

### 7. Уведомления у автора/учителя — показать статус
В `CreatorNotificationsTab.tsx` и `TeacherNotificationsTab.tsx`: показывать исходящие запросы от автора/учителя с их статусами (ожидание/подтверждён/отклонён).

## Технические детали

### Файлы для изменения:
1. **Миграция SQL** — добавить `requested_by` и `teacher_id` в `reschedule_requests`
2. **`src/hooks/useSimplePurchases.ts`** — новый хук `useCreatorRescheduleRequest`
3. **`src/components/creator/CreatorScheduleTab.tsx`** — заменить rescheduleSlot на rescheduleRequest
4. **`src/components/teacher/TeacherScheduleTab.tsx`** — аналогично
5. **`src/components/dashboard/ScheduleTab.tsx`** — UI для входящих запросов от автора/учителя + approve/reject
6. **`supabase/functions/notify-reschedule-request/index.ts`** — двунаправленная логика
7. **`supabase/functions/notify-reschedule-response/index.ts`** — двунаправленная логика
8. **`src/hooks/useRealtimeStudentNotifications.ts`** — тост при входящем запросе
9. **`src/components/creator/CreatorNotificationsTab.tsx`** — показ статусов исходящих запросов
10. **`src/components/teacher/TeacherNotificationsTab.tsx`** — аналогично

### Поток данных:
```text
Автор/Учитель                          Ученик
     |                                    |
     |-- INSERT reschedule_requests ------>|
     |   (requested_by='creator/teacher')  |
     |                                    |
     |   <-- push + toast: "Запрос" ------|
     |                                    |
     |                          Подтвердить/Отклонить
     |                                    |
     |<-- UPDATE status='approved/rejected'|
     |                                    |
     |-- push + toast: "Ответ" ---------->|
     |                                    |
     | (если approved: UPDATE time_slots)  |
```

