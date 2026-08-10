-- Подключения из новой версии, адаптированные под simple_users/simple_bookings.
-- НЕ трогает auth.users и НЕ удаляет simple_* таблицы.

-- 1) Настраиваемый URL для edge-функций (вместо хардкода в notify_*)
INSERT INTO public.app_settings (key, value)
VALUES ('functions_base_url', 'https://mebomnqdtuqmjjefvgkx.supabase.co/functions/v1')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO public.app_settings (key, value)
VALUES ('supabase_anon_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lYm9tbnFkdHVxbWpqZWZ2Z2t4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNzY5MjIsImV4cCI6MjEwMTk1MjkyMn0.njVi_fa7ruu1ovJ9XFUzLlWNS71hti3Di0sLkLIUwLY')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

CREATE OR REPLACE FUNCTION public.call_edge_function(_name text, _payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  base_url text;
  anon_key text;
BEGIN
  SELECT value INTO base_url FROM app_settings WHERE key = 'functions_base_url';
  SELECT value INTO anon_key FROM app_settings WHERE key = 'supabase_anon_key';

  IF base_url IS NULL OR anon_key IS NULL THEN
    RAISE WARNING 'call_edge_function: functions_base_url или supabase_anon_key не заданы';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := base_url || '/' || _name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', anon_key,
      'Authorization', 'Bearer ' || anon_key
    ),
    body := _payload,
    timeout_milliseconds := 30000
  );
END;
$$;

-- 2) Переписать notify_* на call_edge_function
CREATE OR REPLACE FUNCTION public.notify_purchase_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.call_edge_function('notify-purchase-change',
      jsonb_build_object('type','INSERT','record',row_to_json(NEW)));
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.call_edge_function('notify-purchase-change',
      jsonb_build_object('type','UPDATE','record',row_to_json(NEW),'old_record',row_to_json(OLD)));
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_booking_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.call_edge_function('notify-booking-change',
      jsonb_build_object('type','INSERT','record',row_to_json(NEW)));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.call_edge_function('notify-booking-change',
      jsonb_build_object('type','DELETE','old_record',row_to_json(OLD)));
    RETURN OLD;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_reschedule()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.call_edge_function('notify-reschedule',
    jsonb_build_object('type','INSERT','record',row_to_json(NEW)));
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_reschedule_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.call_edge_function('notify-reschedule-request',
    jsonb_build_object('type','INSERT','record',row_to_json(NEW)));
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_reschedule_response()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status IN ('approved','rejected') THEN
    PERFORM public.call_edge_function('notify-reschedule-response',
      jsonb_build_object('type','UPDATE','record',row_to_json(NEW),'old_record',row_to_json(OLD)));
  END IF;
  RETURN NEW;
END; $$;

-- 3) Восстановить учёт notification_preferences в напоминаниях (регрессия в 20260310063614)
CREATE OR REPLACE FUNCTION public.create_booking_reminders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_slot_datetime TIMESTAMPTZ;
  v_product_title TEXT;
  v_slot_date DATE;
  v_slot_time TIME;
  v_prefs RECORD;
  v_morning_datetime TIMESTAMPTZ;
  v_schedule_teacher_id UUID;
  v_creator_id TEXT;
BEGIN
  SELECT ts.date, ts.start_time, p.title, s.teacher_id, p.creator_id
  INTO v_slot_date, v_slot_time, v_product_title, v_schedule_teacher_id, v_creator_id
  FROM time_slots ts
  JOIN schedules s ON s.id = ts.schedule_id
  JOIN products p ON p.id = s.product_id
  WHERE ts.id = NEW.time_slot_id;

  v_slot_datetime := ((v_slot_date::TEXT || ' ' || v_slot_time::TEXT)::TIMESTAMP AT TIME ZONE 'Asia/Almaty');

  SELECT
    COALESCE(np.reminder_24h, true) AS reminder_24h,
    COALESCE(np.reminder_morning, false) AS reminder_morning,
    COALESCE(np.morning_time, '08:00'::TIME) AS morning_time,
    COALESCE(np.reminder_2h, true) AS reminder_2h
  INTO v_prefs
  FROM (SELECT 1) AS dummy
  LEFT JOIN notification_preferences np ON np.user_id = NEW.simple_user_id::text;

  IF v_prefs.reminder_24h AND v_slot_datetime > now() + INTERVAL '24 hours' THEN
    INSERT INTO public.booking_reminders (booking_id, simple_user_id, reminder_type, scheduled_at, product_title, slot_date, slot_time, target_role)
    VALUES (NEW.id, NEW.simple_user_id, '24h', v_slot_datetime - INTERVAL '24 hours', v_product_title, v_slot_date, v_slot_time, 'student');
  END IF;

  IF v_prefs.reminder_morning THEN
    v_morning_datetime := ((v_slot_date::TEXT || ' ' || v_prefs.morning_time::TEXT)::TIMESTAMP AT TIME ZONE 'Asia/Almaty');
    IF v_morning_datetime > now() THEN
      INSERT INTO public.booking_reminders (booking_id, simple_user_id, reminder_type, scheduled_at, product_title, slot_date, slot_time, target_role)
      VALUES (NEW.id, NEW.simple_user_id, 'morning', v_morning_datetime, v_product_title, v_slot_date, v_slot_time, 'student');
    END IF;
  END IF;

  IF v_prefs.reminder_2h AND v_slot_datetime > now() + INTERVAL '2 hours' THEN
    INSERT INTO public.booking_reminders (booking_id, simple_user_id, reminder_type, scheduled_at, product_title, slot_date, slot_time, target_role)
    VALUES (NEW.id, NEW.simple_user_id, '2h', v_slot_datetime - INTERVAL '2 hours', v_product_title, v_slot_date, v_slot_time, 'student');
  END IF;

  IF v_slot_datetime > now() + INTERVAL '24 hours' THEN
    INSERT INTO public.booking_reminders (booking_id, simple_user_id, reminder_type, scheduled_at, product_title, slot_date, slot_time, target_role)
    VALUES (NEW.id, NULL, '24h', v_slot_datetime - INTERVAL '24 hours', v_product_title, v_slot_date, v_slot_time, 'creator');
  END IF;

  IF v_slot_datetime > now() + INTERVAL '2 hours' THEN
    INSERT INTO public.booking_reminders (booking_id, simple_user_id, reminder_type, scheduled_at, product_title, slot_date, slot_time, target_role)
    VALUES (NEW.id, NULL, '2h', v_slot_datetime - INTERVAL '2 hours', v_product_title, v_slot_date, v_slot_time, 'creator');
  END IF;

  v_morning_datetime := ((v_slot_date::TEXT || ' 08:00:00')::TIMESTAMP AT TIME ZONE 'Asia/Almaty');
  IF v_morning_datetime > now() THEN
    INSERT INTO public.booking_reminders (booking_id, simple_user_id, reminder_type, scheduled_at, product_title, slot_date, slot_time, target_role)
    VALUES (NEW.id, NULL, 'morning', v_morning_datetime, v_product_title, v_slot_date, v_slot_time, 'creator');
  END IF;

  IF v_schedule_teacher_id IS NOT NULL THEN
    IF v_slot_datetime > now() + INTERVAL '24 hours' THEN
      INSERT INTO public.booking_reminders (booking_id, simple_user_id, reminder_type, scheduled_at, product_title, slot_date, slot_time, target_role)
      VALUES (NEW.id, v_schedule_teacher_id, '24h', v_slot_datetime - INTERVAL '24 hours', v_product_title, v_slot_date, v_slot_time, 'teacher');
    END IF;

    IF v_slot_datetime > now() + INTERVAL '2 hours' THEN
      INSERT INTO public.booking_reminders (booking_id, simple_user_id, reminder_type, scheduled_at, product_title, slot_date, slot_time, target_role)
      VALUES (NEW.id, v_schedule_teacher_id, '2h', v_slot_datetime - INTERVAL '2 hours', v_product_title, v_slot_date, v_slot_time, 'teacher');
    END IF;

    v_morning_datetime := ((v_slot_date::TEXT || ' 08:00:00')::TIMESTAMP AT TIME ZONE 'Asia/Almaty');
    IF v_morning_datetime > now() THEN
      INSERT INTO public.booking_reminders (booking_id, simple_user_id, reminder_type, scheduled_at, product_title, slot_date, slot_time, target_role)
      VALUES (NEW.id, v_schedule_teacher_id, 'morning', v_morning_datetime, v_product_title, v_slot_date, v_slot_time, 'teacher');
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 4) Убедиться что триггер на simple_bookings
DROP TRIGGER IF EXISTS create_reminders_on_booking ON public.simple_bookings;
CREATE TRIGGER create_reminders_on_booking
  AFTER INSERT ON public.simple_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.create_booking_reminders();

-- 5) GRANT для simple_purchases (как fix из новой версии для purchases)
GRANT UPDATE ON public.simple_purchases TO anon, authenticated;
