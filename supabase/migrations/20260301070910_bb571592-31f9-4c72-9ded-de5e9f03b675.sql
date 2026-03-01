
-- 1. Drop user_phone from push_tokens
ALTER TABLE public.push_tokens DROP COLUMN user_phone;

-- 2. Drop user_phone from notification_preferences
ALTER TABLE public.notification_preferences DROP COLUMN user_phone;

-- 3. Drop user_phone from booking_reminders
ALTER TABLE public.booking_reminders DROP COLUMN user_phone;

-- 4. Update the create_booking_reminders trigger function to remove user_phone references
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
BEGIN
  -- Get time slot details
  SELECT ts.date, ts.start_time, p.title
  INTO v_slot_date, v_slot_time, v_product_title
  FROM time_slots ts
  JOIN schedules s ON s.id = ts.schedule_id
  JOIN products p ON p.id = s.product_id
  WHERE ts.id = NEW.time_slot_id;

  -- Calculate the datetime of the lesson
  v_slot_datetime := (v_slot_date::TEXT || ' ' || v_slot_time::TEXT)::TIMESTAMPTZ;

  -- Get user notification preferences by user_id
  SELECT 
    COALESCE(np.reminder_24h, true) as reminder_24h,
    COALESCE(np.reminder_morning, false) as reminder_morning,
    COALESCE(np.morning_time, '08:00'::TIME) as morning_time,
    COALESCE(np.reminder_2h, true) as reminder_2h
  INTO v_prefs
  FROM (SELECT 1) AS dummy
  LEFT JOIN notification_preferences np ON np.user_id = NEW.simple_user_id;

  -- Create 24h reminder if enabled
  IF v_prefs.reminder_24h AND v_slot_datetime > now() + INTERVAL '24 hours' THEN
    INSERT INTO public.booking_reminders (booking_id, simple_user_id, reminder_type, scheduled_at, product_title, slot_date, slot_time)
    VALUES (NEW.id, NEW.simple_user_id, '24h', v_slot_datetime - INTERVAL '24 hours', v_product_title, v_slot_date, v_slot_time);
  END IF;

  -- Create morning reminder if enabled
  IF v_prefs.reminder_morning THEN
    v_morning_datetime := (v_slot_date::TEXT || ' ' || v_prefs.morning_time::TEXT)::TIMESTAMPTZ;
    IF v_morning_datetime > now() THEN
      INSERT INTO public.booking_reminders (booking_id, simple_user_id, reminder_type, scheduled_at, product_title, slot_date, slot_time)
      VALUES (NEW.id, NEW.simple_user_id, 'morning', v_morning_datetime, v_product_title, v_slot_date, v_slot_time);
    END IF;
  END IF;

  -- Create 2h reminder if enabled
  IF v_prefs.reminder_2h AND v_slot_datetime > now() + INTERVAL '2 hours' THEN
    INSERT INTO public.booking_reminders (booking_id, simple_user_id, reminder_type, scheduled_at, product_title, slot_date, slot_time)
    VALUES (NEW.id, NEW.simple_user_id, '2h', v_slot_datetime - INTERVAL '2 hours', v_product_title, v_slot_date, v_slot_time);
  END IF;

  RETURN NEW;
END;
$function$;
