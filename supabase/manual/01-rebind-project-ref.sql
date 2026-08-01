-- ============================================================
-- Запускать ОДИН РАЗ в НОВОМ проекте Supabase,
-- ПОСЛЕ `supabase db push` (после применения всех миграций).
--
-- Зачем: функции notify_* содержат адрес старого проекта
-- прямо в тексте. Здесь мы делаем адрес настраиваемым:
-- он берётся из таблицы app_settings, ключ 'functions_base_url'.
-- ============================================================

-- 1) Прописать адрес нового проекта и его anon-ключ.
--    Значения уже подставлены для проекта okbuktaggaspnqpzmbyn.
INSERT INTO public.app_settings (key, value)
VALUES ('functions_base_url', 'https://okbuktaggaspnqpzmbyn.supabase.co/functions/v1')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO public.app_settings (key, value)
VALUES ('supabase_anon_key', 'sb_publishable_XtBCL2yRCZC1PSYU901Slw_JmoR1pVd')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 2) Общий помощник: дергает edge-функцию по имени.
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
    RAISE WARNING 'call_edge_function: functions_base_url или supabase_anon_key не заданы в app_settings';
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

-- 3) Переписываем notify_* на помощника (без хардкода адреса).
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
