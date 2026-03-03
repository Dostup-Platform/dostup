

# Исправление: бейдж-счётчик уведомлений считает исходящие запросы автора/учителя

## Проблема
В `CreatorDashboard.tsx` (строка 100) и `TeacherDashboard.tsx` (строка 160) запросы для подсчёта бейджа загружают **все** pending `reschedule_requests` без фильтрации по `requested_by`. Поэтому когда автор/учитель сам отправляет запрос на перенос, он попадает в счётчик бейджа и выглядит как входящее уведомление.

## Решение — 2 файла

### `src/pages/CreatorDashboard.tsx` (строка ~100)
Добавить `.eq("requested_by", "student")` в запрос бейдж-счётчика:
```typescript
.eq("status", "pending")
.eq("requested_by", "student")  // <-- добавить
```

### `src/pages/TeacherDashboard.tsx` (строка ~160)
Аналогично добавить `.eq("requested_by", "student")`:
```typescript
.eq("status", "pending")
.eq("requested_by", "student")  // <-- добавить
```

