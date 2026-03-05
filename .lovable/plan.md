

## Problem

The reminder system (`create_booking_reminders` trigger + `send-reminders` edge function) was built **only for students**. It creates `booking_reminders` rows using `NEW.simple_user_id` from `simple_bookings`, which is always a student. There is no mechanism to create or send reminders to creators or teachers about upcoming lessons.

Additionally, the `send-reminders` function calls `send-push-notification` which queries `push_tokens` by `user_id` — but creators have `user_id = NULL` in `push_tokens`, so even if a reminder row existed, the push would fail.

## Solution

### 1. Database: Add `target_role` column to `booking_reminders`

Add a column to distinguish who the reminder is for:

```sql
ALTER TABLE booking_reminders 
  ADD COLUMN target_role text NOT NULL DEFAULT 'student';
```

### 2. Database: Update `create_booking_reminders` trigger

After creating student reminders (existing logic), also create reminders for:
- **Creator** — always (every booking is on the creator's product)
- **Teacher** — if the schedule has a `teacher_id`

Use `target_role = 'creator'` or `'teacher'`, set `simple_user_id` to the teacher's UUID (for teachers) or NULL (for creators).

### 3. Edge function: Update `send-reminders` to handle creator/teacher

When processing reminders:
- If `target_role = 'student'` — current behavior (call `send-push-notification` with `userId`)
- If `target_role = 'creator'` — query `push_tokens` directly where `user_role = 'creator'` (user_id is NULL)
- If `target_role = 'teacher'` — call `send-push-notification` with `simple_user_id` as userId and `targetRole = 'teacher'`

### 4. Adjust notification text for creator/teacher

Creator/teacher reminders should say "У вас урок через 2 часа" instead of student-oriented "Скоро занятие":
- **Creator 2h**: `"Скоро урок!" / ""{product_title}" через 2 часа"`
- **Creator 24h**: `"Завтра урок!" / ""{product_title}" завтра в {time}"`
- **Creator morning**: `"Сегодня урок!" / ""{product_title}" в {time}"`

Same for teacher, identical text.

## Files changed

| File | Change |
|------|--------|
| Migration SQL | Add `target_role` column to `booking_reminders` |
| Migration SQL | Replace `create_booking_reminders` function to also create creator/teacher reminders |
| `supabase/functions/send-reminders/index.ts` | Handle `target_role` for routing push delivery; direct FCM for creators |

