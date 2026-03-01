

# Сдвиг времени на +30 минут от текущего

Сейчас при открытии диалога редактирования времени незабронированного слота подставляется текущее время слота. Нужно чтобы подставлялось время, сдвинутое на +30 минут. Например: слот 16:30–17:30 → в диалоге сразу стоит 17:00–18:00.

## Изменение

**Файл: `src/components/EditSlotTimeDialog.tsx`**

В `handleOpen` — при инициализации значений вместо текущего времени слота использовать `addMinutes(slot.start_time, 30)` и `addMinutes(slot.end_time, 30)`:

```typescript
if (open && slot) {
  setNewStartTime(addMinutes(slot.start_time.slice(0, 5), 30));
  setNewEndTime(addMinutes(slot.end_time.slice(0, 5), 30));
}
```

Одно изменение в одном файле — 2 строки.

