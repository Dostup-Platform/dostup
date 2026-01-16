-- Create table for booking reminders (24h and 2h before lessons)
CREATE TABLE public.booking_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES public.simple_bookings(id) ON DELETE CASCADE,
  user_phone TEXT NOT NULL,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('24h', '2h')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  product_title TEXT,
  slot_date DATE,
  slot_time TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for efficient querying of pending reminders
CREATE INDEX idx_booking_reminders_pending ON public.booking_reminders(scheduled_at) 
  WHERE sent_at IS NULL;

-- Index for user phone lookups
CREATE INDEX idx_booking_reminders_user ON public.booking_reminders(user_phone);

-- Enable RLS
ALTER TABLE public.booking_reminders ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (for edge functions)
CREATE POLICY "Service role can manage reminders"
  ON public.booking_reminders
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create function to automatically create reminders when a booking is made
CREATE OR REPLACE FUNCTION public.create_booking_reminders()
RETURNS TRIGGER AS $$
DECLARE
  v_slot_datetime TIMESTAMPTZ;
  v_product_title TEXT;
  v_slot_date DATE;
  v_slot_time TIME;
  v_user_phone TEXT;
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

  -- Only create reminders if the lesson is more than 24 hours away
  IF v_slot_datetime > now() + INTERVAL '24 hours' THEN
    -- Create 24h reminder
    INSERT INTO public.booking_reminders (booking_id, user_phone, reminder_type, scheduled_at, product_title, slot_date, slot_time)
    VALUES (NEW.id, v_user_phone, '24h', v_slot_datetime - INTERVAL '24 hours', v_product_title, v_slot_date, v_slot_time);
  END IF;

  -- Only create 2h reminder if the lesson is more than 2 hours away
  IF v_slot_datetime > now() + INTERVAL '2 hours' THEN
    -- Create 2h reminder
    INSERT INTO public.booking_reminders (booking_id, user_phone, reminder_type, scheduled_at, product_title, slot_date, slot_time)
    VALUES (NEW.id, v_user_phone, '2h', v_slot_datetime - INTERVAL '2 hours', v_product_title, v_slot_date, v_slot_time);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to auto-create reminders on booking
CREATE TRIGGER create_reminders_on_booking
  AFTER INSERT ON public.simple_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.create_booking_reminders();