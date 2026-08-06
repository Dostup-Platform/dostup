
-- 1. Creator blocking flag
ALTER TABLE public.creator_accounts ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false;

-- 2. Moderator session tokens
CREATE TABLE IF NOT EXISTS public.moderator_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);
GRANT ALL ON public.moderator_sessions TO service_role;
ALTER TABLE public.moderator_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no direct access moderator_sessions" ON public.moderator_sessions FOR ALL USING (false) WITH CHECK (false);

-- 3. Support threads (one chat per user with the moderator)
CREATE TABLE IF NOT EXISTS public.support_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_type text NOT NULL CHECK (user_type IN ('creator','teacher','student')),
  user_ref text NOT NULL,
  display_name text NOT NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_preview text,
  unread_for_moderator integer NOT NULL DEFAULT 0,
  unread_for_user integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_type, user_ref)
);
GRANT SELECT ON public.support_threads TO anon, authenticated;
GRANT ALL ON public.support_threads TO service_role;
ALTER TABLE public.support_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "support_threads readable via realtime" ON public.support_threads FOR SELECT USING (true);

CREATE TRIGGER support_threads_updated_at BEFORE UPDATE ON public.support_threads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Support messages
CREATE TABLE IF NOT EXISTS public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.support_threads(id) ON DELETE CASCADE,
  sender text NOT NULL CHECK (sender IN ('user','moderator')),
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX IF NOT EXISTS support_messages_thread_idx ON public.support_messages(thread_id, created_at);
GRANT SELECT ON public.support_messages TO anon, authenticated;
GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "support_messages readable via realtime" ON public.support_messages FOR SELECT USING (true);

-- 5. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_threads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
