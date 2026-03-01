
-- Create booking_reschedules table
CREATE TABLE public.booking_reschedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL,
  simple_user_id UUID,
  schedule_id UUID,
  product_id UUID NOT NULL,
  product_title TEXT NOT NULL,
  old_date DATE NOT NULL,
  old_time TIME NOT NULL,
  new_date DATE NOT NULL,
  new_time TIME NOT NULL,
  rescheduled_by TEXT NOT NULL DEFAULT 'creator',
  reasons TEXT[] DEFAULT '{}'::text[],
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.booking_reschedules ENABLE ROW LEVEL SECURITY;

-- RLS: allow all (analogous to booking_cancellations)
CREATE POLICY "Allow all operations on booking_reschedules"
ON public.booking_reschedules
FOR ALL
USING (true)
WITH CHECK (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_reschedules;

-- Create trigger function to call notify-reschedule edge function
CREATE OR REPLACE FUNCTION public.notify_reschedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  payload jsonb;
  edge_function_url text;
  anon_key text;
BEGIN
  edge_function_url := 'https://pgbgenvyjxxgdztymakp.supabase.co/functions/v1/notify-reschedule';
  
  SELECT value INTO anon_key FROM app_settings WHERE key = 'supabase_anon_key';
  
  payload := jsonb_build_object(
    'type', 'INSERT',
    'record', row_to_json(NEW)
  );

  PERFORM net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', anon_key,
      'Authorization', 'Bearer ' || anon_key
    ),
    body := payload,
    timeout_milliseconds := 30000
  );

  RETURN NEW;
END;
$function$;

-- Create trigger
CREATE TRIGGER on_booking_reschedule
AFTER INSERT ON public.booking_reschedules
FOR EACH ROW
EXECUTE FUNCTION public.notify_reschedule();
