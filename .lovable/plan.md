

# Автозаполнение +30 минут в диалоге переноса урока

## Проблема
В `RescheduleSlotDialog` при открытии время начала и окончания копируется как есть из текущего слота. Нужно, чтобы автоматически предлагалось время на 30 минут позже, как это делает `EditSlotTimeDialog`.

## Решение
Один файл: `src/components/RescheduleSlotDialog.tsx`

В функции `handleOpen` (строки 43-50) — вместо копирования текущего времени, добавить +30 минут к start_time и end_time, используя ту же логику `addMinutes`, что и в `EditSlotTimeDialog`:

```typescript
const addMinutes = (time: string, mins: number) => {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  const newH = Math.floor(total / 60) % 24;
  const newM = total % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
};

// В handleOpen:
setNewStartTime(addMinutes(slot.start_time.slice(0, 5), 30));
setNewEndTime(addMinutes(slot.end_time.slice(0, 5), 30));
```

Это затронет и автора и учителя, так как оба используют один компонент `RescheduleSlotDialog`.

