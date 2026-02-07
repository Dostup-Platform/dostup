
-- 1. Delete plaintext password from publicly readable table
DELETE FROM public.app_settings WHERE key = 'creator_password';

-- 2. Create creator sessions table for server-side validation
CREATE TABLE public.creator_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  creator_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.creator_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct access to creator_sessions"
  ON public.creator_sessions FOR ALL
  USING (false);

-- 3. Prevent purchase fraud - only service role can mark as completed
CREATE OR REPLACE FUNCTION public.prevent_purchase_fraud()
RETURNS TRIGGER AS $$
BEGIN
  -- Only allow status change to 'completed' via service role
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    IF NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role' IS DISTINCT FROM 'service_role' THEN
      RAISE EXCEPTION 'Only administrators can approve purchases';
    END IF;
  END IF;
  
  -- Prevent changing confirmed_at directly from client
  IF NEW.confirmed_at IS DISTINCT FROM OLD.confirmed_at THEN
    IF NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role' IS DISTINCT FROM 'service_role' THEN
      RAISE EXCEPTION 'Cannot modify confirmation timestamp';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

CREATE TRIGGER check_purchase_approval
  BEFORE UPDATE ON public.simple_purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_purchase_fraud();
