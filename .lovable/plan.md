

# Показать "Ожидание подтверждения" под записью ученика

## Что нужно сделать

### Файл: `src/components/dashboard/ScheduleTab.tsx`

1. **Добавить запрос pending reschedule_requests** — загружать все pending-запросы текущего ученика через `useQuery`:
```typescript
const { data: pendingReschedules = [] } = useQuery({
  queryKey: ["student-pending-reschedules", user?.id],
  queryFn: async () => {
    const { data } = await supabase
      .from("reschedule_requests")
      .select("id, booking_id, new_date, new_time, status")
      .eq("simple_user_id", user?.id)
      .eq("status", "pending");
    return data || [];
  },
  enabled: !!user?.id,
});
```

2. **Добавить `invalidateQueries` в `onSuccess` мутации** — после отправки запроса инвалидировать `student-pending-reschedules`, чтобы статус сразу появился.

3. **Отобразить статус под каждой записью** — после блока с lesson_link (строка ~418), проверить есть ли pending-запрос для данного `booking.id`. Если да — показать жёлтую плашку:
```tsx
{pendingReschedules.some(r => r.booking_id === booking.id) && (
  <div className="mt-2 flex items-center gap-2 text-amber-600 text-sm">
    <Loader2 className="w-3.5 h-3.5 animate-spin" />
    {language === "ru" ? "Ожидание подтверждения переноса..." : "Ауыстыруды растауды күтуде..."}
  </div>
)}
```

4. **Подписаться на realtime UPDATE reschedule_requests** — чтобы при ответе автора/учителя статус исчезал автоматически. Можно просто инвалидировать запрос через существующий realtime-канал в `useRealtimeStudentNotifications` (он уже слушает `reschedule_requests` UPDATE). Добавить `invalidateQueries` для `student-pending-reschedules` в обработчик.

### Файл: `src/hooks/useRealtimeStudentNotifications.ts`

В обработчике UPDATE `reschedule_requests` (строка ~198) добавить:
```typescript
queryClient.invalidateQueries({ queryKey: ["student-pending-reschedules"] });
```

Это обеспечит автоматическое исчезновение плашки при approve/reject.

