-- Student PIN credentials, student sessions, creator recovery phone, auth rate-limit log.
-- Idempotent. Does not create or alter RLS policies.

-- 1. Student PIN (null = legacy user, must set PIN on next login)
ALTER TABLE public.simple_users
  ADD COLUMN IF NOT EXISTS pin_hash text;

-- 2. Student/teacher sessions (service_role only; no policies)
CREATE TABLE IF NOT EXISTS public.simple_user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  simple_user_id uuid NOT NULL REFERENCES public.simple_users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_simple_user_sessions_user_id
  ON public.simple_user_sessions (simple_user_id);

CREATE INDEX IF NOT EXISTS idx_simple_user_sessions_expires_at
  ON public.simple_user_sessions (expires_at);

GRANT ALL ON public.simple_user_sessions TO service_role;
ALTER TABLE public.simple_user_sessions ENABLE ROW LEVEL SECURITY;

-- 3. Creator recovery phone (required on new registrations; existing rows stay null)
ALTER TABLE public.creator_accounts
  ADD COLUMN IF NOT EXISTS recovery_phone text;

-- 4. Auth attempt log for creator password rate limiting
CREATE TABLE IF NOT EXISTS public.auth_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_attempts_identifier_created_at
  ON public.auth_attempts (identifier, created_at DESC);

GRANT ALL ON public.auth_attempts TO service_role;
ALTER TABLE public.auth_attempts ENABLE ROW LEVEL SECURITY;
