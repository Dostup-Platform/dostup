

## Analysis

The 24h reminder **is correctly created** in the database:

| Field | Value |
|-------|-------|
| `id` | `0acbfc7e...` |
| `target_role` | `creator` |
| `reminder_type` | `24h` |
| `scheduled_at` | `2026-03-07 09:49:00 UTC` (14:49 local) |
| `sent_at` | `NULL` (not yet sent) |

The cron job `send-booking-reminders` runs **every 15 minutes** (`*/15 * * * *`). The last run was at **09:45 UTC** — 4 minutes **before** the reminder became due (09:49 UTC). The next run will be at **10:00 UTC**, which will pick up and send this reminder.

**There is no bug.** The reminder will arrive within the next ~11 minutes. The delay is caused by the 15-minute cron interval.

## Fix: Reduce cron interval to every 2 minutes

To make reminders arrive more promptly (within ~2 minutes of scheduled time instead of up to 15), update the cron schedule from `*/15 * * * *` to `*/2 * * * *`.

This requires a single SQL statement to reschedule the existing cron job.

| What | Change |
|------|--------|
| Cron job `send-booking-reminders` | Change schedule from `*/15 * * * *` to `*/2 * * * *` |

