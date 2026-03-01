

# Исправление: end_time не пересчитывается при подтверждении переноса

## Проблема
При подтверждении переноса `end_time` ставится равным `new_time` (start). Было 9:00-10:00, перенесли на 11:00 — стало 11:00-11:00 вместо 11:00-12:00.

## Решение
Вычислять длительность урока (old_end - old_start) и прибавлять к новому start_time.

### Файл 1: `src/components/creator/CreatorNotificationsTab.tsx` (строки 210-219)

Перед обновлением time_slot — получить текущий end_time и start_time слота, вычислить разницу, применить к new_time:

```typescript
if (booking?.time_slot_id) {
  // Get current slot to calculate duration
  const { data: currentSlot } = await supabase
    .from("time_slots")
    .select("start_time, end_time")
    .eq("id", booking.time_slot_id)
    .single();

  let newEndTime = request.new_time;
  if (currentSlot) {
    const [sh, sm] = currentSlot.start_time.split(":").map(Number);
    const [eh, em] = currentSlot.end_time.split(":").map(Number);
    const durationMin = (eh * 60 + em) - (sh * 60 + sm);
    const [nh, nm] = request.new_time.split(":").map(Number);
    const endTotal = nh * 60 + nm + durationMin;
    newEndTime = `${String(Math.floor(endTotal / 60) % 24).padStart(2, "0")}:${String(endTotal % 60).padStart(2, "0")}:00`;
  }

  await supabase.from("time_slots").update({
    date: request.new_date,
    start_time: request.new_time,
    end_time: newEndTime,
  }).eq("id", booking.time_slot_id);
}
```

### Файл 2: `src/components/teacher/TeacherNotificationsTab.tsx` (строки 158-164)

Аналогичное изменение — вычислить длительность и прибавить к новому start_time.

Итого: 2 файла, одинаковая логика в обоих.

