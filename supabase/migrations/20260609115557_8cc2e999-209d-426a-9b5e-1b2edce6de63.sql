
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.creator_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  login text NOT NULL,
  display_name text NOT NULL,
  password_hash text NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('course_creator', 'online_school')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX creator_accounts_login_lower_idx ON public.creator_accounts (lower(login));

GRANT SELECT ON public.creator_accounts TO authenticated;
GRANT ALL ON public.creator_accounts TO service_role;

ALTER TABLE public.creator_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.creator_accounts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER update_creator_accounts_updated_at
  BEFORE UPDATE ON public.creator_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
