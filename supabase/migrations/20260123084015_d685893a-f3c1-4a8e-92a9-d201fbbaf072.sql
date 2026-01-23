-- Update create_booking_reminders function to respect user preferences
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
  v_user_phone TEXT;
  v_prefs RECORD;
  v_morning_datetime TIMESTAMPTZ;
BEGIN
  -- Get time slot details
  SELECT ts.date, ts.start_time, p.title, su.phone
  INTO v_slot_date, v_slot_time, v_product_title, v_user_phone
  FROM time_slots ts
  JOIN schedules s ON s.id = ts.schedule_id
  JOIN products p ON p.id = s.product_id
  JOIN simple_users su ON su.id = NEW.simple_user_id
  WHERE ts.id = NEW.time_slot_id;

  -- Calculate the datetime of the lesson
  v_slot_datetime := (v_slot_date::TEXT || ' ' || v_slot_time::TEXT)::TIMESTAMPTZ;

  -- Get user notification preferences (or use defaults)
  SELECT 
    COALESCE(np.reminder_24h, true) as reminder_24h,
    COALESCE(np.reminder_morning, false) as reminder_morning,
    COALESCE(np.morning_time, '08:00'::TIME) as morning_time,
    COALESCE(np.reminder_2h, true) as reminder_2h
  INTO v_prefs
  FROM (SELECT 1) AS dummy
  LEFT JOIN notification_preferences np ON np.user_phone = v_user_phone;

  -- Create 24h reminder if enabled and lesson is more than 24 hours away
  IF v_prefs.reminder_24h AND v_slot_datetime > now() + INTERVAL '24 hours' THEN
    INSERT INTO public.booking_reminders (booking_id, user_phone, reminder_type, scheduled_at, product_title, slot_date, slot_time)
    VALUES (NEW.id, v_user_phone, '24h', v_slot_datetime - INTERVAL '24 hours', v_product_title, v_slot_date, v_slot_time);
  END IF;

  -- Create morning reminder if enabled
  IF v_prefs.reminder_morning THEN
    -- Schedule for morning of lesson day
    v_morning_datetime := (v_slot_date::TEXT || ' ' || v_prefs.morning_time::TEXT)::TIMESTAMPTZ;
    
    -- Only if morning time is still in the future
    IF v_morning_datetime > now() THEN
      INSERT INTO public.booking_reminders (booking_id, user_phone, reminder_type, scheduled_at, product_title, slot_date, slot_time)
      VALUES (NEW.id, v_user_phone, 'morning', v_morning_datetime, v_product_title, v_slot_date, v_slot_time);
    END IF;
  END IF;

  -- Create 2h reminder if enabled and lesson is more than 2 hours away
  IF v_prefs.reminder_2h AND v_slot_datetime > now() + INTERVAL '2 hours' THEN
    INSERT INTO public.booking_reminders (booking_id, user_phone, reminder_type, scheduled_at, product_title, slot_date, slot_time)
    VALUES (NEW.id, v_user_phone, '2h', v_slot_datetime - INTERVAL '2 hours', v_product_title, v_slot_date, v_slot_time);
  END IF;

  RETURN NEW;
END;
$function$;