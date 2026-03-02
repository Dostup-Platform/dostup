

# Исправление автозаполнения даты и времени в RescheduleSlotDialog

## Проблема
`handleOpen` вызывается через `onOpenChange` диалога, но когда `isOpen` управляется извне (пропсом от родителя), этот callback **не срабатывает** при открытии. Поэтому дата и время остаются пустыми.

## Решение
Один файл: `src/components/RescheduleSlotDialog.tsx`

Заменить логику инициализации в `handleOpen` на `useEffect`, который следит за `isOpen` и `slot` — точно как сделано в `StudentRescheduleDialog`:

```typescript
useEffect(() => {
  if (isOpen && slot) {
    setNewDate(slot.date);
    setNewTime(addMinutes(slot.start_time.slice(0, 5), 60));
    setReasonType("cant_make_it");
    setComment("");
  }
}, [isOpen, slot]);
```

Из `handleOpen` убрать блок `if (open && slot)`, оставив только закрытие.

