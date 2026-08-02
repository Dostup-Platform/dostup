-- create_booking_reminders stopped checking notification_preferences after the
-- Supabase Auth migration (20260718102222), so the 24h/2h toggles had no effect.
-- Restore that check using the current UUID-based schema.
CREATE OR REPLACE FUNCTION public.create_booking_reminders()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_slot_datetime TIMESTAMPTZ;
  v_product_title TEXT;
  v_slot_date DATE;
  v_slot_time TIME;
  v_schedule_teacher_id UUID;
  v_owner_id UUID;
  v_student_24h BOOLEAN;
  v_student_2h BOOLEAN;
  v_owner_24h BOOLEAN;
  v_owner_2h BOOLEAN;
  v_teacher_24h BOOLEAN;
  v_teacher_2h BOOLEAN;
BEGIN
  SELECT ts.date, ts.start_time, p.title, s.teacher_id, p.owner_id
  INTO v_slot_date, v_slot_time, v_product_title, v_schedule_teacher_id, v_owner_id
  FROM time_slots ts JOIN schedules s ON s.id = ts.schedule_id JOIN products p ON p.id = s.product_id
  WHERE ts.id = NEW.time_slot_id;

  v_slot_datetime := ((v_slot_date::TEXT || ' ' || v_slot_time::TEXT)::TIMESTAMP AT TIME ZONE 'Asia/Almaty');

  SELECT COALESCE(reminder_24h, true), COALESCE(reminder_2h, true)
    INTO v_student_24h, v_student_2h
    FROM notification_preferences WHERE user_id = NEW.user_id;
  v_student_24h := COALESCE(v_student_24h, true);
  v_student_2h := COALESCE(v_student_2h, true);

  IF v_owner_id IS NOT NULL THEN
    SELECT COALESCE(reminder_24h, true), COALESCE(reminder_2h, true)
      INTO v_owner_24h, v_owner_2h
      FROM notification_preferences WHERE user_id = v_owner_id;
    v_owner_24h := COALESCE(v_owner_24h, true);
    v_owner_2h := COALESCE(v_owner_2h, true);
  END IF;

  IF v_schedule_teacher_id IS NOT NULL THEN
    SELECT COALESCE(reminder_24h, true), COALESCE(reminder_2h, true)
      INTO v_teacher_24h, v_teacher_2h
      FROM notification_preferences WHERE user_id = v_schedule_teacher_id;
    v_teacher_24h := COALESCE(v_teacher_24h, true);
    v_teacher_2h := COALESCE(v_teacher_2h, true);
  END IF;

  IF v_student_24h AND v_slot_datetime > now() + INTERVAL '24 hours' THEN
    INSERT INTO public.booking_reminders (booking_id, user_id, reminder_type, scheduled_at, product_title, slot_date, slot_time, target_role)
    VALUES (NEW.id, NEW.user_id, '24h', v_slot_datetime - INTERVAL '24 hours', v_product_title, v_slot_date, v_slot_time, 'student');
  END IF;
  IF v_student_2h AND v_slot_datetime > now() + INTERVAL '2 hours' THEN
    INSERT INTO public.booking_reminders (booking_id, user_id, reminder_type, scheduled_at, product_title, slot_date, slot_time, target_role)
    VALUES (NEW.id, NEW.user_id, '2h', v_slot_datetime - INTERVAL '2 hours', v_product_title, v_slot_date, v_slot_time, 'student');
  END IF;
  IF v_owner_id IS NOT NULL AND v_owner_24h AND v_slot_datetime > now() + INTERVAL '24 hours' THEN
    INSERT INTO public.booking_reminders (booking_id, user_id, reminder_type, scheduled_at, product_title, slot_date, slot_time, target_role)
    VALUES (NEW.id, v_owner_id, '24h', v_slot_datetime - INTERVAL '24 hours', v_product_title, v_slot_date, v_slot_time, 'creator');
  END IF;
  IF v_owner_id IS NOT NULL AND v_owner_2h AND v_slot_datetime > now() + INTERVAL '2 hours' THEN
    INSERT INTO public.booking_reminders (booking_id, user_id, reminder_type, scheduled_at, product_title, slot_date, slot_time, target_role)
    VALUES (NEW.id, v_owner_id, '2h', v_slot_datetime - INTERVAL '2 hours', v_product_title, v_slot_date, v_slot_time, 'creator');
  END IF;
  IF v_schedule_teacher_id IS NOT NULL THEN
    IF v_teacher_24h AND v_slot_datetime > now() + INTERVAL '24 hours' THEN
      INSERT INTO public.booking_reminders (booking_id, user_id, reminder_type, scheduled_at, product_title, slot_date, slot_time, target_role)
      VALUES (NEW.id, v_schedule_teacher_id, '24h', v_slot_datetime - INTERVAL '24 hours', v_product_title, v_slot_date, v_slot_time, 'teacher');
    END IF;
    IF v_teacher_2h AND v_slot_datetime > now() + INTERVAL '2 hours' THEN
      INSERT INTO public.booking_reminders (booking_id, user_id, reminder_type, scheduled_at, product_title, slot_date, slot_time, target_role)
      VALUES (NEW.id, v_schedule_teacher_id, '2h', v_slot_datetime - INTERVAL '2 hours', v_product_title, v_slot_date, v_slot_time, 'teacher');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
