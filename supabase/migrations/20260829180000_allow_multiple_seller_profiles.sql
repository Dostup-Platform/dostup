-- A user may own many seller profiles of the same mode
-- (courses/coaching or online school). Buyer stays unique.

DROP INDEX IF EXISTS public.profiles_auth_user_id_type_idx;
DROP INDEX IF EXISTS public.creator_accounts_auth_user_id_type_idx;

CREATE INDEX IF NOT EXISTS creator_accounts_auth_user_id_idx
  ON public.creator_accounts (auth_user_id);
