-- Leftover from drop_legacy_auth_tables: profiles/user_roles were dropped,
-- but the auth.users trigger still inserts into them and 500s magic-link OTP.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
