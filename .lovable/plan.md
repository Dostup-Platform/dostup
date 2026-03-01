

# Исправление: авто-заполнение даты и времени в диалоге переноса

## Проблема
`onOpenChange` в Radix Dialog вызывается только при действиях пользователя (клик на overlay/кнопку закрытия), а не при программном изменении `open`. Поэтому `handleOpen(true)` никогда не срабатывает и поля остаются пустыми.

## Решение

### Файл: `src/components/StudentRescheduleDialog.tsx`

Заменить логику инициализации из `handleOpen` на `useEffect`, который реагирует на изменение `isOpen` и `booking`:

```typescript
useEffect(() => {
  if (isOpen && booking) {
    setNewDate(booking.date);
    const [h, m] = (booking.startTime || "00:00").slice(0, 5).split(":").map(Number);
    const total = h * 60 + m + 60;
    const newH = Math.floor(total / 60) % 24;
    const newM = total % 60;
    setNewTime(`${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`);
    setReasonType("cant_make_it");
    setComment("");
  }
}, [isOpen, booking]);
```

Убрать инициализацию из `handleOpen` — оставить только обработку закрытия.

Одно изменение в одном файле.

