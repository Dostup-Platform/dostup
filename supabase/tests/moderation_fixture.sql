-- Minimal isolated schema for moderation regression tests; never run on the application database.
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF;
END $$;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),email text,banned_until timestamptz);
CREATE TABLE auth.identities(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES auth.users(id),provider text,provider_id text,identity_data jsonb);
CREATE TABLE auth.sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES auth.users(id));
CREATE TABLE public.profiles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),auth_user_id uuid REFERENCES auth.users(id),type text,display_name text);
CREATE TABLE public.creator_accounts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),auth_user_id uuid REFERENCES auth.users(id),profile_id uuid REFERENCES profiles(id),login text,display_name text,email text,is_blocked boolean NOT NULL DEFAULT false);
CREATE TABLE public.creator_sessions(token text UNIQUE NOT NULL,creator_name text,profile_id uuid REFERENCES profiles(id),expires_at timestamptz DEFAULT now()+interval '7 days');
CREATE TABLE public.products(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),creator_account_id uuid REFERENCES creator_accounts(id),title text,is_published boolean NOT NULL DEFAULT false,is_paused boolean NOT NULL DEFAULT false,paused_message text);
CREATE TABLE public.simple_purchases(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),product_id uuid REFERENCES products(id),buyer_profile_id uuid REFERENCES profiles(id),status text);
CREATE TABLE public.product_trials(LIKE simple_purchases INCLUDING ALL);
CREATE TABLE public.subscriptions(LIKE simple_purchases INCLUDING ALL);
CREATE TABLE public.support_threads(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_type text,user_ref text,display_name text,unread_for_user int DEFAULT 0,last_message_at timestamptz,last_message_preview text,UNIQUE(user_type,user_ref));
CREATE TABLE public.support_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),thread_id uuid REFERENCES support_threads(id),sender text,text text);
GRANT USAGE ON SCHEMA public TO service_role,anon,authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
