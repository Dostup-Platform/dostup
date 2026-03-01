

# Авто-заполнение даты и времени в диалоге переноса

## Что нужно
При открытии `StudentRescheduleDialog` автоматически подставлять:
- **Дата** = дата текущего урока
- **Время** = время начала урока + 1 час (например, урок 18:00–19:00 → предложить 19:00)

## Изменение

### Файл: `src/components/StudentRescheduleDialog.tsx`

В `handleOpen` (строки 48–56) — при открытии диалога вычислять значения из `booking`:

```typescript
const handleOpen = (open: boolean) => {
  if (open && booking) {
    setNewDate(booking.date);
    // Calculate startTime + 1 hour
    const [h, m] = (booking.startTime || "00:00").slice(0, 5).split(":").map(Number);
    const total = h * 60 + m + 60;
    const newH = Math.floor(total / 60) % 24;
    const newM = total % 60;
    setNewTime(`${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`);
    setReasonType("cant_make_it");
    setComment("");
  }
  if (!open) handleClose();
};
```

Одно изменение в одном файле.

