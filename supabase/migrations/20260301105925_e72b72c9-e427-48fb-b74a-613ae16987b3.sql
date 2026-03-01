
-- Create reschedule_requests table
CREATE TABLE public.reschedule_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL,
  simple_user_id UUID,
  schedule_id UUID,
  product_id UUID NOT NULL,
  product_title TEXT NOT NULL,
  old_date DATE NOT NULL,
  old_time TIME NOT NULL,
  new_date DATE NOT NULL,
  new_time TIME NOT NULL,
  reasons TEXT[] DEFAULT '{}',
  comment TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  response_comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  responded_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.reschedule_requests ENABLE ROW LEVEL SECURITY;

-- RLS: allow all (like booking_reschedules)
CREATE POLICY "Allow all operations on reschedule_requests"
  ON public.reschedule_requests
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.reschedule_requests;

-- Trigger function for INSERT (notify creator/teacher about new request)
CREATE OR REPLACE FUNCTION public.notify_reschedule_request()
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
  edge_function_url := 'https://pgbgenvyjxxgdztymakp.supabase.co/functions/v1/notify-reschedule-request';
  
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

-- Trigger function for UPDATE (notify student about response)
CREATE OR REPLACE FUNCTION public.notify_reschedule_response()
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
  -- Only trigger when status changes from pending
  IF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') THEN
    edge_function_url := 'https://pgbgenvyjxxgdztymakp.supabase.co/functions/v1/notify-reschedule-response';
    
    SELECT value INTO anon_key FROM app_settings WHERE key = 'supabase_anon_key';
    
    payload := jsonb_build_object(
      'type', 'UPDATE',
      'record', row_to_json(NEW),
      'old_record', row_to_json(OLD)
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
  END IF;

  RETURN NEW;
END;
$function$;

-- Create triggers
CREATE TRIGGER on_reschedule_request_insert
  AFTER INSERT ON public.reschedule_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_reschedule_request();

CREATE TRIGGER on_reschedule_request_update
  AFTER UPDATE ON public.reschedule_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_reschedule_response();
