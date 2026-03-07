

## Problem

`CreatorAccountTab` passes `creatorName` (a text string like "Иван") as `userId` to `NotificationPreferences`:

```tsx
<NotificationPreferences userId={creatorName} />
```

But `notification_preferences.user_id` is a **UUID** column. Inserting/querying with a plain text string fails with a type error, causing "Не удалось сохранить".

## Fix

Change `notification_preferences.user_id` from `uuid` to `text`. This allows it to store both:
- Student UUIDs (from `simple_users.id`)
- Creator names (text strings)

This is a single migration:

```sql
ALTER TABLE notification_preferences ALTER COLUMN user_id TYPE text;
```

No code changes needed — the component already works with text strings, the database just rejects them due to the UUID type constraint.

| What | Change |
|------|--------|
| Migration SQL | Change `notification_preferences.user_id` from `uuid` to `text` |

