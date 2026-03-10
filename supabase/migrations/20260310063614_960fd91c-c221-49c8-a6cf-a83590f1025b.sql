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

  -- Student reminders (always 24h and 2h)
  IF v_slot_datetime > now() + INTERVAL '24 hours' THEN
    INSERT INTO public.booking_reminders (booking_id, simple_user_id, reminder_type, scheduled_at, product_title, slot_date, slot_time, target_role)
    VALUES (NEW.id, NEW.simple_user_id, '24h', v_slot_datetime - INTERVAL '24 hours', v_product_title, v_slot_date, v_slot_time, 'student');
  END IF;

  IF v_slot_datetime > now() + INTERVAL '2 hours' THEN
    INSERT INTO public.booking_reminders (booking_id, simple_user_id, reminder_type, scheduled_at, product_title, slot_date, slot_time, target_role)
    VALUES (NEW.id, NEW.simple_user_id, '2h', v_slot_datetime - INTERVAL '2 hours', v_product_title, v_slot_date, v_slot_time, 'student');
  END IF;

  -- Creator reminders (always 24h and 2h)
  IF v_slot_datetime > now() + INTERVAL '24 hours' THEN
    INSERT INTO public.booking_reminders (booking_id, simple_user_id, reminder_type, scheduled_at, product_title, slot_date, slot_time, target_role)
    VALUES (NEW.id, NULL, '24h', v_slot_datetime - INTERVAL '24 hours', v_product_title, v_slot_date, v_slot_time, 'creator');
  END IF;

  IF v_slot_datetime > now() + INTERVAL '2 hours' THEN
    INSERT INTO public.booking_reminders (booking_id, simple_user_id, reminder_type, scheduled_at, product_title, slot_date, slot_time, target_role)
    VALUES (NEW.id, NULL, '2h', v_slot_datetime - INTERVAL '2 hours', v_product_title, v_slot_date, v_slot_time, 'creator');
  END IF;

  -- Teacher reminders (always 24h and 2h, if teacher assigned)
  IF v_schedule_teacher_id IS NOT NULL THEN
    IF v_slot_datetime > now() + INTERVAL '24 hours' THEN
      INSERT INTO public.booking_reminders (booking_id, simple_user_id, reminder_type, scheduled_at, product_title, slot_date, slot_time, target_role)
      VALUES (NEW.id, v_schedule_teacher_id, '24h', v_slot_datetime - INTERVAL '24 hours', v_product_title, v_slot_date, v_slot_time, 'teacher');
    END IF;

    IF v_slot_datetime > now() + INTERVAL '2 hours' THEN
      INSERT INTO public.booking_reminders (booking_id, simple_user_id, reminder_type, scheduled_at, product_title, slot_date, slot_time, target_role)
      VALUES (NEW.id, v_schedule_teacher_id, '2h', v_slot_datetime - INTERVAL '2 hours', v_product_title, v_slot_date, v_slot_time, 'teacher');
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;