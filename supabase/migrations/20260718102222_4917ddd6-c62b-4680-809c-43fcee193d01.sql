
-- 1. Удаляем всё кроме ielts-продуктов
DELETE FROM public.products WHERE creator_id <> 'ielts';

-- 2. Чистим пользовательские данные
TRUNCATE TABLE
  public.bookings,
  public.purchases,
  public.material_bookmarks,
  public.material_unlocks,
  public.material_access_tokens,
  public.notification_preferences,
  public.push_tokens,
  public.booking_reminders,
  public.reschedule_requests,
  public.booking_cancellations,
  public.booking_reschedules,
  public.support_messages,
  public.support_threads,
  public.user_roles,
  public.profiles,
  public.product_teachers
RESTART IDENTITY CASCADE;

-- 3. Дропаем кастомные auth-таблицы
DROP TABLE IF EXISTS public.simple_bookings CASCADE;
DROP TABLE IF EXISTS public.simple_purchases CASCADE;
DROP TABLE IF EXISTS public.simple_users CASCADE;
DROP TABLE IF EXISTS public.creator_sessions CASCADE;
DROP TABLE IF EXISTS public.creator_accounts CASCADE;
DROP TABLE IF EXISTS public.moderator_sessions CASCADE;
DROP TABLE IF EXISTS public.signup_tokens CASCADE;

-- 4. Расширяем profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS login TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS active_role public.app_role;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Public read profiles" ON public.profiles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- 5. Owner_id в products и announcements
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS products_owner_id_idx ON public.products(owner_id);

ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 6. Перепривязка пользовательских колонок
ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS materials_teacher_id_fkey;
ALTER TABLE public.materials ADD CONSTRAINT materials_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_user_id_fkey;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.purchases DROP CONSTRAINT IF EXISTS purchases_user_id_fkey;
ALTER TABLE public.purchases ADD CONSTRAINT purchases_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.booking_reminders DROP COLUMN IF EXISTS simple_user_id;
ALTER TABLE public.booking_reminders ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.booking_cancellations DROP COLUMN IF EXISTS simple_user_id;
ALTER TABLE public.booking_cancellations ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.booking_reschedules DROP COLUMN IF EXISTS simple_user_id;
ALTER TABLE public.booking_reschedules ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.reschedule_requests DROP COLUMN IF EXISTS simple_user_id;
ALTER TABLE public.reschedule_requests ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.material_bookmarks DROP COLUMN IF EXISTS user_ref, DROP COLUMN IF EXISTS user_type;
ALTER TABLE public.material_bookmarks ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.material_bookmarks ADD CONSTRAINT material_bookmarks_user_material_unique UNIQUE (user_id, material_id);

ALTER TABLE public.material_unlocks ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.notification_preferences DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.notification_preferences ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE;

ALTER TABLE public.push_tokens DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.push_tokens ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS push_tokens_user_id_idx ON public.push_tokens(user_id);

ALTER TABLE public.support_threads DROP COLUMN IF EXISTS user_ref, DROP COLUMN IF EXISTS user_type;
ALTER TABLE public.support_threads ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE;

ALTER TABLE public.product_teachers DROP COLUMN IF EXISTS teacher_name;
ALTER TABLE public.product_teachers ADD COLUMN teacher_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.product_teachers ADD CONSTRAINT product_teachers_unique UNIQUE (product_id, teacher_user_id);

-- 7. Новые таблицы
CREATE TABLE public.school_teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  teacher_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(school_user_id, teacher_user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_teachers TO authenticated;
GRANT ALL ON public.school_teachers TO service_role;
ALTER TABLE public.school_teachers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See own school-teacher relationships" ON public.school_teachers FOR SELECT TO authenticated
  USING (school_user_id = auth.uid() OR teacher_user_id = auth.uid());
CREATE POLICY "School manages relationships" ON public.school_teachers FOR ALL TO authenticated
  USING (school_user_id = auth.uid()) WITH CHECK (school_user_id = auth.uid());
CREATE POLICY "Teacher accepts invite" ON public.school_teachers FOR UPDATE TO authenticated
  USING (teacher_user_id = auth.uid()) WITH CHECK (teacher_user_id = auth.uid());

CREATE TABLE public.teacher_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX teacher_invites_email_idx ON public.teacher_invites(lower(email));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_invites TO authenticated;
GRANT ALL ON public.teacher_invites TO service_role;
ALTER TABLE public.teacher_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School manages own invites" ON public.teacher_invites FOR ALL TO authenticated
  USING (school_user_id = auth.uid()) WITH CHECK (school_user_id = auth.uid());

-- 8. Функции has_role / owns_product / is_product_teacher
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.owns_product(_product_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.products WHERE id = _product_id AND owner_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.is_product_teacher(_product_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.product_teachers WHERE product_id = _product_id AND teacher_user_id = _user_id)
$$;

-- 9. handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_active_role public.app_role := 'student';
BEGIN
  IF lower(NEW.email) = 'chingizkhairulla@gmail.com' THEN
    v_active_role := 'creator';
  END IF;

  INSERT INTO public.profiles (user_id, email, display_name, name, active_role)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    v_active_role
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student') ON CONFLICT DO NOTHING;

  IF lower(NEW.email) = 'chingizkhairulla@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'creator') ON CONFLICT DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'moderator') ON CONFLICT DO NOTHING;

    UPDATE public.products SET owner_id = NEW.id WHERE creator_id = 'ielts' AND owner_id IS NULL;
    UPDATE public.announcements SET owner_id = NEW.id WHERE creator_id = 'ielts' AND owner_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 10. Пересобираем RLS-политики
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- PRODUCTS
DROP POLICY IF EXISTS "Anyone can view products" ON public.products;
DROP POLICY IF EXISTS "Anyone can manage products" ON public.products;
CREATE POLICY "Public read products" ON public.products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Owner manages products" ON public.products FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;

-- MATERIALS
DROP POLICY IF EXISTS "Anyone can manage materials" ON public.materials;
DROP POLICY IF EXISTS "Teachers can manage their own materials" ON public.materials;
CREATE POLICY "Public read materials" ON public.materials FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Owner manages materials" ON public.materials FOR ALL TO authenticated
  USING (public.owns_product(product_id, auth.uid())) WITH CHECK (public.owns_product(product_id, auth.uid()));
CREATE POLICY "Teacher manages own materials" ON public.materials FOR ALL TO authenticated
  USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid() AND public.is_product_teacher(product_id, auth.uid()));
GRANT SELECT ON public.materials TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.materials TO authenticated;

-- ANNOUNCEMENTS
DROP POLICY IF EXISTS "Anyone can manage announcements" ON public.announcements;
DROP POLICY IF EXISTS "Anyone can read announcements" ON public.announcements;
CREATE POLICY "Public read announcements" ON public.announcements FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Owner manages announcements" ON public.announcements FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
GRANT SELECT ON public.announcements TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;

-- SCHEDULES
DROP POLICY IF EXISTS "Anyone can view schedules" ON public.schedules;
DROP POLICY IF EXISTS "Anyone can manage schedules" ON public.schedules;
CREATE POLICY "Public read schedules" ON public.schedules FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Owner manages schedules" ON public.schedules FOR ALL TO authenticated
  USING (public.owns_product(product_id, auth.uid())) WITH CHECK (public.owns_product(product_id, auth.uid()));
GRANT SELECT ON public.schedules TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedules TO authenticated;

DROP POLICY IF EXISTS "Anyone can view time_slots" ON public.time_slots;
DROP POLICY IF EXISTS "Anyone can manage time_slots" ON public.time_slots;
CREATE POLICY "Public read time_slots" ON public.time_slots FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Owner manages time_slots" ON public.time_slots FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.schedules s WHERE s.id = time_slots.schedule_id AND public.owns_product(s.product_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.schedules s WHERE s.id = time_slots.schedule_id AND public.owns_product(s.product_id, auth.uid())));
GRANT SELECT ON public.time_slots TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_slots TO authenticated;

-- PRODUCT_TEACHERS
DROP POLICY IF EXISTS "Anyone can view product teachers" ON public.product_teachers;
DROP POLICY IF EXISTS "Anyone can manage product teachers" ON public.product_teachers;
CREATE POLICY "Owner and teacher see" ON public.product_teachers FOR SELECT TO authenticated
  USING (public.owns_product(product_id, auth.uid()) OR teacher_user_id = auth.uid());
CREATE POLICY "Owner manages product teachers" ON public.product_teachers FOR ALL TO authenticated
  USING (public.owns_product(product_id, auth.uid())) WITH CHECK (public.owns_product(product_id, auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_teachers TO authenticated;
GRANT ALL ON public.product_teachers TO service_role;

-- BOOKINGS
DROP POLICY IF EXISTS "Anyone can view bookings" ON public.bookings;
DROP POLICY IF EXISTS "Anyone can manage bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can view their bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can create bookings" ON public.bookings;
CREATE POLICY "Users see own bookings" ON public.bookings FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.schedules s WHERE s.id = bookings.schedule_id AND public.owns_product(s.product_id, auth.uid())));
CREATE POLICY "Users create own bookings" ON public.bookings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users or owner delete bookings" ON public.bookings FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.schedules s WHERE s.id = bookings.schedule_id AND public.owns_product(s.product_id, auth.uid())));
GRANT SELECT, INSERT, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
REVOKE ALL ON public.bookings FROM anon;

-- PURCHASES
DROP POLICY IF EXISTS "Anyone can view purchases" ON public.purchases;
DROP POLICY IF EXISTS "Users can view their purchases" ON public.purchases;
DROP POLICY IF EXISTS "Users can create purchases" ON public.purchases;
DROP POLICY IF EXISTS "Anyone can manage purchases" ON public.purchases;
CREATE POLICY "Users see own purchases" ON public.purchases FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.products p WHERE p.id = purchases.product_id AND p.owner_id = auth.uid()));
CREATE POLICY "Users create own purchases" ON public.purchases FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
GRANT SELECT, INSERT ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;
REVOKE ALL ON public.purchases FROM anon;

-- MATERIAL_BOOKMARKS
DROP POLICY IF EXISTS "Anyone can view bookmarks" ON public.material_bookmarks;
DROP POLICY IF EXISTS "Users manage own bookmarks" ON public.material_bookmarks;
CREATE POLICY "Users read own or public bookmarks" ON public.material_bookmarks FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_public = true);
CREATE POLICY "Users manage own bookmarks" ON public.material_bookmarks FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_bookmarks TO authenticated;
REVOKE ALL ON public.material_bookmarks FROM anon;

-- MATERIAL_UNLOCKS
DROP POLICY IF EXISTS "Anyone can view unlocks" ON public.material_unlocks;
DROP POLICY IF EXISTS "Anyone can manage unlocks" ON public.material_unlocks;
CREATE POLICY "Users see own unlocks" ON public.material_unlocks FOR SELECT TO authenticated USING (user_id = auth.uid());
GRANT SELECT ON public.material_unlocks TO authenticated;
GRANT ALL ON public.material_unlocks TO service_role;
REVOKE ALL ON public.material_unlocks FROM anon;

REVOKE ALL ON public.material_access_tokens FROM anon, authenticated;
GRANT ALL ON public.material_access_tokens TO service_role;

-- NOTIFICATION_PREFERENCES
DROP POLICY IF EXISTS "Anyone can view notification prefs" ON public.notification_preferences;
DROP POLICY IF EXISTS "Users manage own preferences" ON public.notification_preferences;
CREATE POLICY "Users manage own prefs" ON public.notification_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
REVOKE ALL ON public.notification_preferences FROM anon;

-- PUSH_TOKENS
DROP POLICY IF EXISTS "Anyone can view push tokens" ON public.push_tokens;
DROP POLICY IF EXISTS "Users manage own tokens" ON public.push_tokens;
CREATE POLICY "Users manage own push tokens" ON public.push_tokens FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_tokens TO authenticated;
REVOKE ALL ON public.push_tokens FROM anon;

REVOKE ALL ON public.booking_reminders FROM anon, authenticated;
GRANT ALL ON public.booking_reminders TO service_role;

-- BOOKING_CANCELLATIONS
DROP POLICY IF EXISTS "Anyone can view cancellations" ON public.booking_cancellations;
CREATE POLICY "Users or owner see cancellations" ON public.booking_cancellations FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.products p WHERE p.id = booking_cancellations.product_id AND p.owner_id = auth.uid()));
CREATE POLICY "Users create own cancellations" ON public.booking_cancellations FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
GRANT SELECT, INSERT ON public.booking_cancellations TO authenticated;
GRANT ALL ON public.booking_cancellations TO service_role;
REVOKE ALL ON public.booking_cancellations FROM anon;

-- BOOKING_RESCHEDULES
DROP POLICY IF EXISTS "Anyone can view reschedules" ON public.booking_reschedules;
CREATE POLICY "Users or owner see reschedules" ON public.booking_reschedules FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.products p WHERE p.id = booking_reschedules.product_id AND p.owner_id = auth.uid()));
CREATE POLICY "Users create own reschedules" ON public.booking_reschedules FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
GRANT SELECT, INSERT ON public.booking_reschedules TO authenticated;
GRANT ALL ON public.booking_reschedules TO service_role;
REVOKE ALL ON public.booking_reschedules FROM anon;

-- RESCHEDULE_REQUESTS
DROP POLICY IF EXISTS "Anyone can view reschedule requests" ON public.reschedule_requests;
CREATE POLICY "Users or owner see requests" ON public.reschedule_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.products p WHERE p.id = reschedule_requests.product_id AND p.owner_id = auth.uid()));
CREATE POLICY "Users create own requests" ON public.reschedule_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owner updates requests" ON public.reschedule_requests FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = reschedule_requests.product_id AND p.owner_id = auth.uid()));
GRANT SELECT, INSERT, UPDATE ON public.reschedule_requests TO authenticated;
GRANT ALL ON public.reschedule_requests TO service_role;
REVOKE ALL ON public.reschedule_requests FROM anon;

-- SUPPORT
DROP POLICY IF EXISTS "support_threads readable via realtime" ON public.support_threads;
CREATE POLICY "Users or moderator see threads" ON public.support_threads FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'moderator'));
CREATE POLICY "Users create own thread" ON public.support_threads FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owner or moderator updates" ON public.support_threads FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'moderator'));
GRANT SELECT, INSERT, UPDATE ON public.support_threads TO authenticated;
GRANT ALL ON public.support_threads TO service_role;
REVOKE ALL ON public.support_threads FROM anon;

DROP POLICY IF EXISTS "Anyone can view support messages" ON public.support_messages;
CREATE POLICY "Thread participants read" ON public.support_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.support_threads t WHERE t.id = support_messages.thread_id AND (t.user_id = auth.uid() OR public.has_role(auth.uid(), 'moderator'))));
CREATE POLICY "Thread participants write" ON public.support_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.support_threads t WHERE t.id = support_messages.thread_id AND (t.user_id = auth.uid() OR public.has_role(auth.uid(), 'moderator'))));
GRANT SELECT, INSERT ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
REVOKE ALL ON public.support_messages FROM anon;

REVOKE ALL ON public.app_settings FROM anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;

-- 11. Обновляем create_booking_reminders
CREATE OR REPLACE FUNCTION public.create_booking_reminders()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_slot_datetime TIMESTAMPTZ;
  v_product_title TEXT;
  v_slot_date DATE;
  v_slot_time TIME;
  v_schedule_teacher_id UUID;
  v_owner_id UUID;
BEGIN
  SELECT ts.date, ts.start_time, p.title, s.teacher_id, p.owner_id
  INTO v_slot_date, v_slot_time, v_product_title, v_schedule_teacher_id, v_owner_id
  FROM time_slots ts JOIN schedules s ON s.id = ts.schedule_id JOIN products p ON p.id = s.product_id
  WHERE ts.id = NEW.time_slot_id;

  v_slot_datetime := ((v_slot_date::TEXT || ' ' || v_slot_time::TEXT)::TIMESTAMP AT TIME ZONE 'Asia/Almaty');

  IF v_slot_datetime > now() + INTERVAL '24 hours' THEN
    INSERT INTO public.booking_reminders (booking_id, user_id, reminder_type, scheduled_at, product_title, slot_date, slot_time, target_role)
    VALUES (NEW.id, NEW.user_id, '24h', v_slot_datetime - INTERVAL '24 hours', v_product_title, v_slot_date, v_slot_time, 'student');
  END IF;
  IF v_slot_datetime > now() + INTERVAL '2 hours' THEN
    INSERT INTO public.booking_reminders (booking_id, user_id, reminder_type, scheduled_at, product_title, slot_date, slot_time, target_role)
    VALUES (NEW.id, NEW.user_id, '2h', v_slot_datetime - INTERVAL '2 hours', v_product_title, v_slot_date, v_slot_time, 'student');
  END IF;
  IF v_owner_id IS NOT NULL AND v_slot_datetime > now() + INTERVAL '24 hours' THEN
    INSERT INTO public.booking_reminders (booking_id, user_id, reminder_type, scheduled_at, product_title, slot_date, slot_time, target_role)
    VALUES (NEW.id, v_owner_id, '24h', v_slot_datetime - INTERVAL '24 hours', v_product_title, v_slot_date, v_slot_time, 'creator');
  END IF;
  IF v_owner_id IS NOT NULL AND v_slot_datetime > now() + INTERVAL '2 hours' THEN
    INSERT INTO public.booking_reminders (booking_id, user_id, reminder_type, scheduled_at, product_title, slot_date, slot_time, target_role)
    VALUES (NEW.id, v_owner_id, '2h', v_slot_datetime - INTERVAL '2 hours', v_product_title, v_slot_date, v_slot_time, 'creator');
  END IF;
  IF v_schedule_teacher_id IS NOT NULL THEN
    IF v_slot_datetime > now() + INTERVAL '24 hours' THEN
      INSERT INTO public.booking_reminders (booking_id, user_id, reminder_type, scheduled_at, product_title, slot_date, slot_time, target_role)
      VALUES (NEW.id, v_schedule_teacher_id, '24h', v_slot_datetime - INTERVAL '24 hours', v_product_title, v_slot_date, v_slot_time, 'teacher');
    END IF;
    IF v_slot_datetime > now() + INTERVAL '2 hours' THEN
      INSERT INTO public.booking_reminders (booking_id, user_id, reminder_type, scheduled_at, product_title, slot_date, slot_time, target_role)
      VALUES (NEW.id, v_schedule_teacher_id, '2h', v_slot_datetime - INTERVAL '2 hours', v_product_title, v_slot_date, v_slot_time, 'teacher');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
