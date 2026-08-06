-- 1. simple_users
CREATE TABLE public.simple_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text UNIQUE,
  role text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_simple_users_name ON public.simple_users (name);
GRANT SELECT, INSERT, UPDATE ON public.simple_users TO anon, authenticated;
GRANT ALL ON public.simple_users TO service_role;
ALTER TABLE public.simple_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "simple_users readable" ON public.simple_users FOR SELECT USING (true);
CREATE POLICY "simple_users insertable" ON public.simple_users FOR INSERT WITH CHECK (true);
CREATE POLICY "simple_users updatable" ON public.simple_users FOR UPDATE USING (true) WITH CHECK (true);

-- 2. creator_accounts
CREATE TABLE public.creator_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  login text NOT NULL,
  display_name text NOT NULL,
  password_hash text NOT NULL,
  account_type text NOT NULL DEFAULT 'course_creator',
  is_blocked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_creator_accounts_login_lower ON public.creator_accounts (lower(login));
GRANT ALL ON public.creator_accounts TO service_role;
ALTER TABLE public.creator_accounts ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_creator_accounts_updated_at BEFORE UPDATE ON public.creator_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. creator_sessions
CREATE TABLE public.creator_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  creator_name text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_creator_sessions_creator_name ON public.creator_sessions (creator_name);
GRANT ALL ON public.creator_sessions TO service_role;
ALTER TABLE public.creator_sessions ENABLE ROW LEVEL SECURITY;

-- 4. moderator_sessions
CREATE TABLE public.moderator_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.moderator_sessions TO service_role;
ALTER TABLE public.moderator_sessions ENABLE ROW LEVEL SECURITY;

-- 5. signup_tokens
CREATE TABLE public.signup_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  email text NOT NULL,
  name text NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.signup_tokens TO service_role;
ALTER TABLE public.signup_tokens ENABLE ROW LEVEL SECURITY;

-- 6. simple_purchases
CREATE TABLE public.simple_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simple_user_id uuid NOT NULL REFERENCES public.simple_users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  assigned_teacher_id uuid,
  can_choose_teacher boolean NOT NULL DEFAULT false,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_simple_purchases_user ON public.simple_purchases (simple_user_id);
CREATE INDEX idx_simple_purchases_product ON public.simple_purchases (product_id);
GRANT SELECT, INSERT, UPDATE ON public.simple_purchases TO anon, authenticated;
GRANT ALL ON public.simple_purchases TO service_role;
ALTER TABLE public.simple_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "simple_purchases readable" ON public.simple_purchases FOR SELECT USING (true);
CREATE POLICY "simple_purchases insertable" ON public.simple_purchases FOR INSERT WITH CHECK (status = 'pending');
CREATE POLICY "simple_purchases updatable" ON public.simple_purchases FOR UPDATE USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.prevent_simple_purchase_fraud()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    IF NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role' IS DISTINCT FROM 'service_role' THEN
      RAISE EXCEPTION 'Only administrators can approve purchases';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER prevent_simple_purchase_fraud_trg BEFORE UPDATE ON public.simple_purchases
  FOR EACH ROW EXECUTE FUNCTION public.prevent_simple_purchase_fraud();

-- 7. simple_bookings
CREATE TABLE public.simple_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simple_user_id uuid NOT NULL REFERENCES public.simple_users(id) ON DELETE CASCADE,
  time_slot_id uuid NOT NULL REFERENCES public.time_slots(id) ON DELETE CASCADE,
  schedule_id uuid NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'confirmed',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_simple_bookings_user ON public.simple_bookings (simple_user_id);
CREATE INDEX idx_simple_bookings_schedule ON public.simple_bookings (schedule_id);
CREATE INDEX idx_simple_bookings_slot ON public.simple_bookings (time_slot_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simple_bookings TO anon, authenticated;
GRANT ALL ON public.simple_bookings TO service_role;
ALTER TABLE public.simple_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "simple_bookings readable" ON public.simple_bookings FOR SELECT USING (true);
CREATE POLICY "simple_bookings insertable" ON public.simple_bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "simple_bookings updatable" ON public.simple_bookings FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "simple_bookings deletable" ON public.simple_bookings FOR DELETE USING (true);

-- 8. simple_user_id columns on related tables
ALTER TABLE public.booking_cancellations ADD COLUMN IF NOT EXISTS simple_user_id uuid;
ALTER TABLE public.booking_reschedules ADD COLUMN IF NOT EXISTS simple_user_id uuid;
ALTER TABLE public.reschedule_requests ADD COLUMN IF NOT EXISTS simple_user_id uuid;
ALTER TABLE public.booking_reminders ADD COLUMN IF NOT EXISTS simple_user_id uuid;

-- 9. Drop auth.users foreign keys so simple_users ids can be stored
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT con.conname, rel.relname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    JOIN pg_class frel ON frel.oid = con.confrelid
    JOIN pg_namespace fns ON fns.oid = frel.relnamespace
    WHERE con.contype = 'f'
      AND ns.nspname = 'public'
      AND fns.nspname = 'auth'
      AND frel.relname = 'users'
      AND rel.relname <> 'profiles'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.relname, r.conname);
  END LOOP;
END $$;

ALTER TABLE public.bookings ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.purchases ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.push_tokens ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.notification_preferences ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.material_bookmarks ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.support_threads ALTER COLUMN user_id DROP NOT NULL;