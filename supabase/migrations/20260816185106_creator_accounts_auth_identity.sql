-- Supabase Auth identity columns on creator_accounts.
-- Auth is an identity source only; creator_sessions remain the app session.
-- Idempotent.

ALTER TABLE public.creator_accounts
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS auth_user_id uuid;

-- OAuth-only creators have no password; password login still works when a hash is present.
ALTER TABLE public.creator_accounts
  ALTER COLUMN password_hash DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'creator_accounts_email_key'
      AND conrelid = 'public.creator_accounts'::regclass
  ) THEN
    ALTER TABLE public.creator_accounts
      ADD CONSTRAINT creator_accounts_email_key UNIQUE (email);
  END IF;
END $$;

-- Same address via Google and magic link must hit one row, regardless of case.
CREATE UNIQUE INDEX IF NOT EXISTS creator_accounts_email_lower_idx
  ON public.creator_accounts (lower(email))
  WHERE email IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'creator_accounts_auth_user_id_key'
      AND conrelid = 'public.creator_accounts'::regclass
  ) THEN
    ALTER TABLE public.creator_accounts
      ADD CONSTRAINT creator_accounts_auth_user_id_key UNIQUE (auth_user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'creator_accounts_auth_user_id_fkey'
      AND conrelid = 'public.creator_accounts'::regclass
  ) THEN
    ALTER TABLE public.creator_accounts
      ADD CONSTRAINT creator_accounts_auth_user_id_fkey
      FOREIGN KEY (auth_user_id)
      REFERENCES auth.users(id)
      ON DELETE SET NULL;
  END IF;
END $$;
