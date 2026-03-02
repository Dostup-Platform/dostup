

# Исправление: исходящие запросы на перенос отображаются в уведомлениях автора

## Проблема
В `CreatorNotificationsTab.tsx` (строка 161-167) запрос `reschedule_requests` загружает **все** pending запросы для продуктов автора, без фильтрации по `requested_by`. Поэтому когда автор сам отправляет запрос на перенос (`requested_by = "creator"`), он появляется в списке уведомлений автора как входящий запрос от ученика.

## Решение — 1 файл

### `src/components/creator/CreatorNotificationsTab.tsx`
Добавить фильтр `.eq("requested_by", "student")` в запрос на строке ~165, чтобы загружать только запросы, отправленные учениками:

```typescript
const { data } = await supabase
  .from("reschedule_requests")
  .select("*")
  .in("product_id", productIds)
  .eq("status", "pending")
  .eq("requested_by", "student")  // <-- добавить
  .order("created_at", { ascending: false })
  .limit(50);
```

Также нужно проверить аналогичный хук в `TeacherNotificationsTab.tsx` — если там такая же проблема, добавить тот же фильтр.

