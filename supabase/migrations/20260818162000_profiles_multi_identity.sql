-- Multi-profile identity: one auth user owns buyer / creator / school profiles.
-- Idempotent. Does not rename creator_sessions.

-- ---------------------------------------------------------------------------
-- 1. profiles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  display_name text,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_type_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_type_check
      CHECK (type IN ('buyer', 'creator', 'school'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_auth_user_id_type_idx
  ON public.profiles (auth_user_id, type);

CREATE INDEX IF NOT EXISTS profiles_auth_user_id_idx
  ON public.profiles (auth_user_id);

CREATE INDEX IF NOT EXISTS profiles_last_used_at_idx
  ON public.profiles (auth_user_id, last_used_at DESC NULLS LAST);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'No direct access to profiles'
  ) THEN
    CREATE POLICY "No direct access to profiles"
      ON public.profiles
      FOR ALL
      USING (false)
      WITH CHECK (false);
  END IF;
END $$;

GRANT ALL ON TABLE public.profiles TO service_role;
REVOKE ALL ON TABLE public.profiles FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. One identity may own both a creator and a school account.
--    Drop single-row uniqueness on email / auth_user_id.
-- ---------------------------------------------------------------------------
ALTER TABLE public.creator_accounts
  ADD COLUMN IF NOT EXISTS profile_id uuid;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'creator_accounts_email_key'
      AND conrelid = 'public.creator_accounts'::regclass
  ) THEN
    ALTER TABLE public.creator_accounts DROP CONSTRAINT creator_accounts_email_key;
  END IF;
END $$;

DROP INDEX IF EXISTS public.creator_accounts_email_lower_idx;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'creator_accounts_auth_user_id_key'
      AND conrelid = 'public.creator_accounts'::regclass
  ) THEN
    ALTER TABLE public.creator_accounts DROP CONSTRAINT creator_accounts_auth_user_id_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS creator_accounts_auth_user_id_type_idx
  ON public.creator_accounts (auth_user_id, account_type)
  WHERE auth_user_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Backfill one profile per existing creator_accounts row
-- ---------------------------------------------------------------------------
INSERT INTO public.profiles (auth_user_id, type, display_name, last_used_at, created_at)
SELECT
  c.auth_user_id,
  CASE WHEN c.account_type = 'online_school' THEN 'school' ELSE 'creator' END,
  COALESCE(NULLIF(c.display_name, ''), c.login),
  now(),
  c.created_at
FROM public.creator_accounts c
WHERE c.profile_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.auth_user_id IS NOT DISTINCT FROM c.auth_user_id
      AND p.type = CASE WHEN c.account_type = 'online_school' THEN 'school' ELSE 'creator' END
  );

UPDATE public.creator_accounts c
SET profile_id = p.id
FROM public.profiles p
WHERE c.profile_id IS NULL
  AND p.type = CASE WHEN c.account_type = 'online_school' THEN 'school' ELSE 'creator' END
  AND p.auth_user_id IS NOT DISTINCT FROM c.auth_user_id
  AND (
    c.auth_user_id IS NOT NULL
    OR p.display_name = COALESCE(NULLIF(c.display_name, ''), c.login)
  );

-- Legacy password accounts have no auth_user_id; match leftover 1:1 by display_name.
UPDATE public.creator_accounts c
SET profile_id = p.id
FROM public.profiles p
WHERE c.profile_id IS NULL
  AND p.auth_user_id IS NULL
  AND p.type = CASE WHEN c.account_type = 'online_school' THEN 'school' ELSE 'creator' END
  AND p.display_name = COALESCE(NULLIF(c.display_name, ''), c.login);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'creator_accounts_profile_id_fkey'
      AND conrelid = 'public.creator_accounts'::regclass
  ) THEN
    ALTER TABLE public.creator_accounts
      ADD CONSTRAINT creator_accounts_profile_id_fkey
      FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS creator_accounts_profile_id_key
  ON public.creator_accounts (profile_id)
  WHERE profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS creator_accounts_profile_id_idx
  ON public.creator_accounts (profile_id);

-- ---------------------------------------------------------------------------
-- 4. creator_sessions.profile_id
-- ---------------------------------------------------------------------------
ALTER TABLE public.creator_sessions
  ADD COLUMN IF NOT EXISTS profile_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'creator_sessions_profile_id_fkey'
      AND conrelid = 'public.creator_sessions'::regclass
  ) THEN
    ALTER TABLE public.creator_sessions
      ADD CONSTRAINT creator_sessions_profile_id_fkey
      FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS creator_sessions_profile_id_idx
  ON public.creator_sessions (profile_id);

UPDATE public.creator_sessions s
SET profile_id = c.profile_id
FROM public.creator_accounts c
WHERE s.profile_id IS NULL
  AND lower(s.creator_name) = lower(c.login)
  AND c.profile_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 5. Purchases / bookings: buyer_profile_id (old column stays, nullable)
-- ---------------------------------------------------------------------------
ALTER TABLE public.simple_purchases
  ADD COLUMN IF NOT EXISTS buyer_profile_id uuid;

ALTER TABLE public.simple_bookings
  ADD COLUMN IF NOT EXISTS buyer_profile_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'simple_purchases_buyer_profile_id_fkey'
      AND conrelid = 'public.simple_purchases'::regclass
  ) THEN
    ALTER TABLE public.simple_purchases
      ADD CONSTRAINT simple_purchases_buyer_profile_id_fkey
      FOREIGN KEY (buyer_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'simple_bookings_buyer_profile_id_fkey'
      AND conrelid = 'public.simple_bookings'::regclass
  ) THEN
    ALTER TABLE public.simple_bookings
      ADD CONSTRAINT simple_bookings_buyer_profile_id_fkey
      FOREIGN KEY (buyer_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS simple_purchases_buyer_profile_id_idx
  ON public.simple_purchases (buyer_profile_id);

CREATE INDEX IF NOT EXISTS simple_bookings_buyer_profile_id_idx
  ON public.simple_bookings (buyer_profile_id);

-- Production has no student accounts; backfill is a no-op when user_id is empty.
-- Keep the column name from the live schema (simple_user_id).
UPDATE public.simple_purchases sp
SET buyer_profile_id = p.id
FROM public.simple_users su
JOIN public.profiles p
  ON p.auth_user_id IS NULL
 AND p.type = 'buyer'
 AND p.display_name = su.name
WHERE sp.buyer_profile_id IS NULL
  AND sp.simple_user_id = su.id;

UPDATE public.simple_bookings sb
SET buyer_profile_id = p.id
FROM public.simple_users su
JOIN public.profiles p
  ON p.auth_user_id IS NULL
 AND p.type = 'buyer'
 AND p.display_name = su.name
WHERE sb.buyer_profile_id IS NULL
  AND sb.simple_user_id = su.id;

ALTER TABLE public.simple_purchases
  ALTER COLUMN simple_user_id DROP NOT NULL;

ALTER TABLE public.simple_bookings
  ALTER COLUMN simple_user_id DROP NOT NULL;
