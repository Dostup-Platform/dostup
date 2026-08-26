-- At most one buyer profile per auth identity, and deleting an auth user
-- must remove the profiles and seller accounts it owned.

CREATE UNIQUE INDEX IF NOT EXISTS profiles_one_buyer_per_auth_user_idx
  ON public.profiles (auth_user_id)
  WHERE type = 'buyer' AND auth_user_id IS NOT NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_auth_user_id_fkey;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_auth_user_id_fkey
  FOREIGN KEY (auth_user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

ALTER TABLE public.creator_accounts
  DROP CONSTRAINT IF EXISTS creator_accounts_auth_user_id_fkey;

ALTER TABLE public.creator_accounts
  ADD CONSTRAINT creator_accounts_auth_user_id_fkey
  FOREIGN KEY (auth_user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;
