

## Проблема

В edge-функции `notify-booking-change`, при DELETE (отмена записи), пуш-уведомления отправляются только автору и учителю. Ученику пуш **не отправляется вообще** — нет вызова `sendFCMToUser` для студента.

## Решение

В блоке DELETE добавить отправку пуш-уведомления ученику, используя `cancellation.simple_user_id` и роль `"student"`.

Текст уведомления зависит от `cancelled_by`:
- Если `cancelled_by = "creator"` → "Автор отменил занятие"
- Если `cancelled_by = "teacher"` → "Учитель отменил занятие"
- Если `cancelled_by = "student"` → не отправляем пуш ученику (он сам отменил)

| Файл | Изменение |
|------|-----------|
| `supabase/functions/notify-booking-change/index.ts` | В блоке DELETE, после отправки пуша автору, добавить отправку ученику если `cancelled_by !== "student"` |

### Код (строки ~365-375)

После существующей отправки автору добавляем:

```typescript
// 3. Notify student if cancelled by creator/teacher
if (cancellation.cancelled_by !== "student" && cancellation.simple_user_id) {
  const cancellerLabel = cancellation.cancelled_by === "teacher" ? "Учитель" : "Автор";
  const studentTitle = `${cancellerLabel} отменил занятие`;
  const studentBody = `Занятие "${cancellation.product_title}" на ${cancellation.slot_date} в ${cancellation.slot_time} отменено`;
  
  const sent = await sendFCMToUser(
    supabase,
    cancellation.simple_user_id,
    "student",
    studentTitle,
    studentBody,
    { ...notificationData, type: "creator_cancellation" }
  );
  totalSent += sent;
}
```

Один файл, ~10 строк.

