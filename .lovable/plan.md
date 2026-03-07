

## Problem

The `create_booking_reminders` trigger fires on every INSERT into `simple_bookings`. Inside it, there's a JOIN:

```sql
LEFT JOIN notification_preferences np ON np.user_id = NEW.simple_user_id;
```

After the previous migration changed `notification_preferences.user_id` from `uuid` to `text`, this comparison (`text = uuid`) fails with:

```
operator does not exist: text = uuid
```

This causes the entire INSERT into `simple_bookings` to fail, preventing students from booking.

## Fix

Update the `create_booking_reminders` function to cast `NEW.simple_user_id` to `text` when joining with `notification_preferences`:

```sql
LEFT JOIN notification_preferences np ON np.user_id = NEW.simple_user_id::text;
```

Single migration, no code changes needed.

| What | Change |
|------|--------|
| Migration SQL | Update `create_booking_reminders`: cast `simple_user_id` to `text` in the JOIN |

