-- RLS lockdown, public product catalog (no Kaspi fields), stable product ownership.
-- Idempotent.

-- ---------------------------------------------------------------------------
-- 1. Stable product ownership
-- ---------------------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS creator_account_id uuid REFERENCES public.creator_accounts(id);

UPDATE public.products p
SET creator_account_id = c.id
FROM public.creator_accounts c
WHERE p.creator_account_id IS NULL
  AND lower(p.creator_id) = lower(c.login);

ALTER TABLE public.products
  ALTER COLUMN creator_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS products_creator_account_id_idx
  ON public.products (creator_account_id);

-- ---------------------------------------------------------------------------
-- 2. Public catalog view — omits kaspi_link / kaspi_phone.
--    Default view owner rights (not security_invoker) so it can read products
--    after SELECT is revoked from anon. WHERE is the access filter.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.products_catalog AS
SELECT
  id,
  created_at,
  updated_at,
  creator_id,
  creator_account_id,
  title,
  headline,
  description,
  price,
  image_url,
  video_url,
  has_schedule,
  is_active,
  is_paused,
  paused_message,
  slug,
  telegram_link,
  group_link_label,
  faq,
  access_duration_days
FROM public.products
WHERE is_active = true
  AND is_paused = false;

GRANT SELECT ON public.products_catalog TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.products_catalog FROM anon, authenticated, PUBLIC;

-- ---------------------------------------------------------------------------
-- 3. Drop every policy on locked tables
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'products',
        'materials',
        'schedules',
        'time_slots',
        'bookings',
        'purchases',
        'simple_users',
        'simple_purchases',
        'simple_bookings',
        'announcements',
        'product_teachers',
        'notification_preferences',
        'material_bookmarks',
        'reschedule_requests',
        'booking_reschedules',
        'booking_cancellations',
        'material_unlocks',
        'support_threads',
        'support_messages'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Privileges: writes only via service_role.
--    Anon cannot SELECT products (kaspi_* stay private); catalog view is public.
--    One products SELECT policy remains as defense in depth.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  locked text[] := ARRAY[
    'products',
    'materials',
    'schedules',
    'time_slots',
    'bookings',
    'purchases',
    'simple_users',
    'simple_purchases',
    'simple_bookings',
    'announcements',
    'product_teachers',
    'notification_preferences',
    'material_bookmarks',
    'reschedule_requests',
    'booking_reschedules',
    'booking_cancellations',
    'material_unlocks',
    'support_threads',
    'support_messages',
    'simple_user_sessions',
    'creator_sessions',
    'creator_accounts',
    'moderator_sessions',
    'signup_tokens',
    'material_access_tokens',
    'push_tokens',
    'auth_attempts',
    'booking_reminders',
    'teacher_invites',
    'school_teachers'
  ];
BEGIN
  FOREACH t IN ARRAY locked
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

CREATE POLICY "products_public_read_active"
  ON public.products
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true AND is_paused = false);
