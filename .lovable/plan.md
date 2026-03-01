

# Убрать спиннер, добавить время переноса

## Изменение

### Файл: `src/components/dashboard/ScheduleTab.tsx` (строки 434-439)

Заменить блок с `Loader2` спиннером на текст без спиннера, с добавлением запрошенного времени из `pendingReschedules`:

```tsx
{(() => {
  const pendingReq = pendingReschedules.find(r => r.booking_id === booking.id);
  if (!pendingReq) return null;
  return (
    <div className="mt-2 text-amber-600 dark:text-amber-400 text-sm">
      {language === "ru"
        ? `Ожидание подтверждения переноса на ${pendingReq.new_date} ${pendingReq.new_time}`
        : `Ауыстыруды растауды күтуде: ${pendingReq.new_date} ${pendingReq.new_time}`}
    </div>
  );
})()}
```

Убирается `Loader2` (крутящийся спиннер), вместо многоточия показывается дата и время, на которое ученик попросил перенос.

