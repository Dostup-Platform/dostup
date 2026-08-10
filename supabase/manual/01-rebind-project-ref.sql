-- Запускать ОДИН РАЗ в SQL Editor проекта mebomnqdtuqmjjefvgkx
-- ПОСЛЕ применения всех миграций (supabase db push).

INSERT INTO public.app_settings (key, value)
VALUES ('functions_base_url', 'https://mebomnqdtuqmjjefvgkx.supabase.co/functions/v1')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO public.app_settings (key, value)
VALUES ('supabase_anon_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lYm9tbnFkdHVxbWpqZWZ2Z2t4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNzY5MjIsImV4cCI6MjEwMTk1MjkyMn0.njVi_fa7ruu1ovJ9XFUzLlWNS71hti3Di0sLkLIUwLY')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

CREATE OR REPLACE FUNCTION public.call_edge_function(_name text, _payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  base_url text;
  anon_key text;
BEGIN
  SELECT value INTO base_url FROM app_settings WHERE key = 'functions_base_url';
  SELECT value INTO anon_key FROM app_settings WHERE key = 'supabase_anon_key';

  IF base_url IS NULL OR anon_key IS NULL THEN
    RAISE WARNING 'call_edge_function: functions_base_url или supabase_anon_key не заданы';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := base_url || '/' || _name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', anon_key,
      'Authorization', 'Bearer ' || anon_key
    ),
    body := _payload,
    timeout_milliseconds := 30000
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_purchase_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.call_edge_function('notify-purchase-change',
      jsonb_build_object('type','INSERT','record',row_to_json(NEW)));
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.call_edge_function('notify-purchase-change',
      jsonb_build_object('type','UPDATE','record',row_to_json(NEW),'old_record',row_to_json(OLD)));
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_booking_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.call_edge_function('notify-booking-change',
      jsonb_build_object('type','INSERT','record',row_to_json(NEW)));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.call_edge_function('notify-booking-change',
      jsonb_build_object('type','DELETE','old_record',row_to_json(OLD)));
    RETURN OLD;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_reschedule()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.call_edge_function('notify-reschedule',
    jsonb_build_object('type','INSERT','record',row_to_json(NEW)));
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_reschedule_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.call_edge_function('notify-reschedule-request',
    jsonb_build_object('type','INSERT','record',row_to_json(NEW)));
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_reschedule_response()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status IN ('approved','rejected') THEN
    PERFORM public.call_edge_function('notify-reschedule-response',
      jsonb_build_object('type','UPDATE','record',row_to_json(NEW),'old_record',row_to_json(OLD)));
  END IF;
  RETURN NEW;
END; $$;
