

## Problem: Timezone Bug in Reminder Scheduling

The `create_booking_reminders` trigger calculates `scheduled_at` incorrectly:

```sql
v_slot_datetime := (v_slot_date::TEXT || ' ' || v_slot_time::TEXT)::TIMESTAMPTZ;
```

This interprets `16:33` (4:33 PM local Kazakhstan time) as `16:33 UTC`. So the "2 hours before" reminder is scheduled for `14:33 UTC` = **7:33 PM local** — which is AFTER the lesson.

The correct `scheduled_at` should be `09:33 UTC` (2:33 PM local, 2h before 4:33 PM local).

**Evidence from database:**
- `slot_time`: 16:33 (local)
- `scheduled_at`: 14:33 UTC (wrong — this is 7:33 PM local)
- Should be: 09:33 UTC (2:33 PM local)

## Fix

Use `AT TIME ZONE 'Asia/Almaty'` to properly convert local time to UTC:

```sql
v_slot_datetime := ((v_slot_date::TEXT || ' ' || v_slot_time::TEXT)::TIMESTAMP AT TIME ZONE 'Asia/Almaty');
```

This single change in the `create_booking_reminders` function fixes all reminder types (24h, 2h, morning) for all roles (student, creator, teacher).

After updating the trigger, we also need to fix the existing reminder rows for the current booking so they fire at the correct time.

## Changes

| What | Change |
|------|--------|
| Migration SQL | Update `create_booking_reminders` function: use `AT TIME ZONE 'Asia/Almaty'` |
| Migration SQL | Fix existing unsent reminders: recalculate `scheduled_at` with correct timezone |
| Morning reminders | Also fix: `v_morning_datetime` calculation uses same wrong pattern |

