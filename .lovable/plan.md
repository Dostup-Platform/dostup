

## Проблема

Когда автор/учитель **одобряет** запрос ученика на перенос, срабатывают **две** системы уведомлений:

1. `notify-reschedule-response` — срабатывает на UPDATE `reschedule_requests` (статус → approved) → отправляет ученику "Перенос подтверждён" ✅
2. `notify-reschedule` — срабатывает на INSERT в `booking_reschedules` (создаётся запись о переносе) → отправляет ученику "Урок перенесён" ❌ дубликат

Ученик получает **два** пуша вместо одного.

## Решение

В `notify-reschedule/index.ts` добавить проверку: если причина содержит "Запрос ученика подтверждён", значит это автоматический перенос после одобрения запроса — пуш уже отправлен через `notify-reschedule-response`, поэтому пропускаем.

### Изменение

**Файл:** `supabase/functions/notify-reschedule/index.ts`

После получения `record` (строка ~196), перед отправкой пуша добавить:

```typescript
// Skip if this reschedule was auto-created from approving a student's request
// (notify-reschedule-response already sent a push)
if (record.reasons?.includes("Запрос ученика подтверждён")) {
  console.log("Skipping: auto-created from approved student request");
  return new Response(
    JSON.stringify({ success: true, message: "Skipped (handled by response notification)" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

Один файл, ~7 строк.

