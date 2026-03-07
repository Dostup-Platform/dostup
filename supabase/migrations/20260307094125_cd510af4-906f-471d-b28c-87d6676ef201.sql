
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
    COALESCE(np.reminder_24h, true) as reminder_24h,
    COALESCE(np.reminder_morning, false) as reminder_morning,
    COALESCE(np.morning_time, '08:00'::TIME) as morning_time,
    COALESCE(np.reminder_2h, true) as reminder_2h
  INTO v_prefs
  FROM (SELECT 1) AS dummy
  LEFT JOIN notification_preferences np ON np.user_id = NEW.simple_user_id;

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

UPDATE public.booking_reminders
SET scheduled_at = scheduled_at - INTERVAL '5 hours'
WHERE sent_at IS NULL;
