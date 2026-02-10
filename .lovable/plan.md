

# Plan: Notification for Material Unlock (Scheduled Access)

When a scheduled material becomes available, students should receive:
1. An in-platform toast notification (if the app is open)
2. A notification card in the "Notifications" tab
3. A push notification (if permitted) -- already partially works

## What's Missing

- The `materials` table is not in the Supabase Realtime publication, so the frontend can't detect when `available_at` is set to `null` (unlocked).
- The realtime hook (`useRealtimeStudentNotifications`) doesn't listen for material changes.
- The Notifications tab doesn't display material unlock events.
- The badge count doesn't include material unlocks.

## Changes

### 1. Database: Create a `material_unlocks` log table

Instead of trying to detect `UPDATE` on `materials` (which doesn't tell us who should be notified), create a lightweight log table that the `unlock-materials` edge function writes to after unlocking:

```sql
CREATE TABLE public.material_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  material_title TEXT NOT NULL,
  product_title TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE material_unlocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can read material unlocks for their purchased products"
  ON material_unlocks FOR SELECT
  USING (
    product_id IN (
      SELECT product_id FROM simple_purchases
      WHERE simple_user_id = (
        SELECT id FROM simple_users WHERE phone = current_setting('request.headers', true)::json->>'x-user-phone'
      )
      AND status IN ('confirmed', 'completed')
    )
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.material_unlocks;
```

Since students don't use Supabase auth, RLS won't work well for filtering. Instead, the table will be public-read (anon SELECT) and we filter on the frontend by checking if the student has purchased the product.

### 2. Edge Function: `unlock-materials` -- write to log table

After unlocking materials, insert records into `material_unlocks` so students get real-time events. Also simplify the push notification phone lookup -- just query `push_tokens` directly for students who purchased the product.

### 3. Frontend: `useRealtimeStudentNotifications` -- listen for material unlocks

Add a listener on `material_unlocks` (INSERT events). When a new record appears:
- Check if the student purchased that product
- Show a toast: "Material '[title]' is now available in '[product]'"
- Play a sound
- Increment badge count
- Invalidate materials queries

### 4. Frontend: `NotificationsTab` -- show material unlock cards

Add a query for `material_unlocks` filtered by the student's purchased product IDs. Display cards with an "Unlock" icon showing material title, product title, and timestamp.

### 5. Frontend: `Dashboard` -- include unlocks in badge count

Query `material_unlocks` for the student's products and count new ones since `lastViewedAt`.

## Technical Details

### material_unlocks table (simple, no RLS complexity)
- RLS enabled with a permissive SELECT policy for `anon` role (since simple_users don't use Supabase auth)
- INSERT restricted to service_role only (edge function uses service role key)
- Frontend filters by matching product_id against student's purchased products

### Realtime flow
```text
Cron -> unlock-materials edge function
  -> UPDATE materials SET available_at = null
  -> INSERT INTO material_unlocks (material_id, product_id, ...)
  -> Supabase Realtime broadcasts INSERT event
  -> Student's browser receives event via useRealtimeStudentNotifications
  -> Toast shown + badge incremented + queries invalidated
```

### Files to modify
- **New migration**: Create `material_unlocks` table with RLS and realtime
- **`supabase/functions/unlock-materials/index.ts`**: Insert into `material_unlocks` after unlocking; simplify push notification logic
- **`src/hooks/useRealtimeStudentNotifications.ts`**: Add listener for `material_unlocks` INSERT events
- **`src/components/dashboard/NotificationsTab.tsx`**: Query and display material unlock notifications
- **`src/pages/Dashboard.tsx`**: Include material unlocks in badge count

