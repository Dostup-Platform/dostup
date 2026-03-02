

# Исправление: уведомление о переносе приходит не тому получателю

## Проблема
В `src/hooks/useRealtimeBookings.ts` (хук автора) подписка на INSERT в `reschedule_requests` (строка 302) **не фильтрует по `requested_by`**. Когда автор сам отправляет запрос (`requested_by = "creator"`), хук обрабатывает его как входящий запрос от ученика и показывает тост "Ученик просит перенести".

Аналогичная проблема может быть в `useRealtimeTeacherNotifications.ts`, но там уже есть фильтр `if (newRequest.requested_by && newRequest.requested_by !== "student") return;` — значит у учителя всё корректно.

## Решение — 1 файл

### `src/hooks/useRealtimeBookings.ts`
Добавить фильтр в обработчик INSERT `reschedule_requests` (после строки 306):
```typescript
// Only show for student requests, not creator's own outgoing requests
if (newRequest.requested_by && newRequest.requested_by !== "student") return;
```

Также добавить подписку на UPDATE `reschedule_requests` для отображения ответов ученика на исходящие запросы автора (когда `requested_by = "creator"` и статус меняется на approved/rejected).

