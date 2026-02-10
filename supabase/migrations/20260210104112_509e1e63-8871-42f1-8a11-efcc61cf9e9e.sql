
-- Store the anon key (public key, safe to store) for use in trigger HTTP calls
INSERT INTO app_settings (key, value) VALUES ('supabase_anon_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnYmdlbnZ5anh4Z2R6dHltYWtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxODI5NjMsImV4cCI6MjA4Mzc1ODk2M30.3ppZd4hlFCe34wH2OLb9dzC0sI1VUooSXzwO0-aPs8I')
ON CONFLICT DO NOTHING;

-- Update notify_booking_change to use anon key from app_settings
CREATE OR REPLACE FUNCTION public.notify_booking_change()
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
  edge_function_url := 'https://pgbgenvyjxxgdztymakp.supabase.co/functions/v1/notify-booking-change';
  
  -- Get the anon key from app_settings
  SELECT value INTO anon_key FROM app_settings WHERE key = 'supabase_anon_key';
  
  IF TG_OP = 'INSERT' THEN
    payload := jsonb_build_object(
      'type', 'INSERT',
      'record', row_to_json(NEW)
    );
  ELSIF TG_OP = 'DELETE' THEN
    payload := jsonb_build_object(
      'type', 'DELETE',
      'old_record', row_to_json(OLD)
    );
  END IF;

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

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$function$;

-- Update notify_purchase_change to use anon key from app_settings
CREATE OR REPLACE FUNCTION public.notify_purchase_change()
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
  edge_function_url := 'https://pgbgenvyjxxgdztymakp.supabase.co/functions/v1/notify-purchase-change';
  
  -- Get the anon key from app_settings
  SELECT value INTO anon_key FROM app_settings WHERE key = 'supabase_anon_key';
  
  IF TG_OP = 'INSERT' THEN
    payload := jsonb_build_object(
      'type', 'INSERT',
      'record', row_to_json(NEW)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    payload := jsonb_build_object(
      'type', 'UPDATE',
      'record', row_to_json(NEW),
      'old_record', row_to_json(OLD)
    );
  END IF;

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
