-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function to notify about booking changes via Edge Function
CREATE OR REPLACE FUNCTION public.notify_booking_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payload jsonb;
  edge_function_url text;
BEGIN
  -- Build the Edge Function URL
  edge_function_url := 'https://pgbgenvyjxxgdztymakp.supabase.co/functions/v1/notify-booking-change';
  
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

  -- Call Edge Function asynchronously
  PERFORM net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := payload
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Function to notify about purchase changes via Edge Function
CREATE OR REPLACE FUNCTION public.notify_purchase_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payload jsonb;
  edge_function_url text;
BEGIN
  edge_function_url := 'https://pgbgenvyjxxgdztymakp.supabase.co/functions/v1/notify-purchase-change';
  
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
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := payload
  );

  RETURN NEW;
END;
$$;

-- Create trigger for booking changes (INSERT and DELETE)
DROP TRIGGER IF EXISTS trigger_notify_booking_insert ON public.simple_bookings;
CREATE TRIGGER trigger_notify_booking_insert
  AFTER INSERT ON public.simple_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_booking_change();

DROP TRIGGER IF EXISTS trigger_notify_booking_delete ON public.simple_bookings;
CREATE TRIGGER trigger_notify_booking_delete
  AFTER DELETE ON public.simple_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_booking_change();

-- Create trigger for purchase changes (INSERT and UPDATE)
DROP TRIGGER IF EXISTS trigger_notify_purchase_insert ON public.simple_purchases;
CREATE TRIGGER trigger_notify_purchase_insert
  AFTER INSERT ON public.simple_purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_purchase_change();

DROP TRIGGER IF EXISTS trigger_notify_purchase_update ON public.simple_purchases;
CREATE TRIGGER trigger_notify_purchase_update
  AFTER UPDATE ON public.simple_purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_purchase_change();