-- Позволяет почте dostup.support@gmail.com получать сессию модератора
CREATE OR REPLACE FUNCTION public.claim_moderator_session()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email text;
  v_token text;
BEGIN
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  IF v_email = '' AND auth.uid() IS NOT NULL THEN
    SELECT lower(coalesce(email, '')) INTO v_email FROM auth.users WHERE id = auth.uid();
  END IF;

  IF v_email = 'dostup.support@gmail.com' THEN
    v_token := gen_random_uuid()::text;
    INSERT INTO public.moderator_sessions (token, expires_at)
    VALUES (v_token, now() + interval '30 days');
    RETURN v_token;
  END IF;

  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_moderator_session() TO anon, authenticated, service_role;
