-- Remove the PIN / student-session auth path.
-- Leave simple_users rows (including teachers) in place.

DROP TABLE IF EXISTS public.simple_user_sessions;

ALTER TABLE public.simple_users
  DROP COLUMN IF EXISTS pin_hash;
