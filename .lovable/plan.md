

# Удаление старых запросов при создании нового

## Проблема
Когда ученик отправляет второй/третий запрос на перенос того же бронирования, старые pending-запросы остаются и отображаются у автора/учителя вместе с новым.

## Решение
Перед вставкой нового запроса удалять все предыдущие pending-запросы от того же ученика на то же бронирование.

## Изменение

### Файл: `src/components/dashboard/ScheduleTab.tsx`

В `mutationFn` (строки 64-78), перед `insert` добавить удаление старых pending-запросов:

```typescript
mutationFn: async (data) => {
  // Delete previous pending requests for the same booking
  await supabase
    .from("reschedule_requests")
    .delete()
    .eq("booking_id", data.bookingId)
    .eq("simple_user_id", user?.id)
    .eq("status", "pending");

  // Insert new request
  const { error } = await supabase.from("reschedule_requests").insert({...});
  if (error) throw error;
},
```

Одно изменение в одном файле.

