


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."app_role" AS ENUM (
    'admin',
    'creator',
    'user'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."event_type" AS ENUM (
    'group',
    'individual'
);


ALTER TYPE "public"."event_type" OWNER TO "postgres";


CREATE TYPE "public"."material_type" AS ENUM (
    'file',
    'video',
    'text',
    'link',
    'folder'
);


ALTER TYPE "public"."material_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."call_edge_function"("_name" "text", "_payload" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."call_edge_function"("_name" "text", "_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_booking_reminders"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_slot_datetime TIMESTAMPTZ;
  v_product_title TEXT;
  v_slot_date DATE;
  v_slot_time TIME;
  v_prefs RECORD;
  v_morning_datetime TIMESTAMPTZ;
  v_schedule_teacher_id UUID;
  v_creator_id TEXT;
BEGIN
  SELECT ts.date, ts.start_time, p.title, s.teacher_id, p.creator_id
  INTO v_slot_date, v_slot_time, v_product_title, v_schedule_teacher_id, v_creator_id
  FROM time_slots ts
  JOIN schedules s ON s.id = ts.schedule_id
  JOIN products p ON p.id = s.product_id
  WHERE ts.id = NEW.time_slot_id;

  v_slot_datetime := ((v_slot_date::TEXT || ' ' || v_slot_time::TEXT)::TIMESTAMP AT TIME ZONE 'Asia/Almaty');

  SELECT
    COALESCE(np.reminder_24h, true) AS reminder_24h,
    COALESCE(np.reminder_morning, false) AS reminder_morning,
    COALESCE(np.morning_time, '08:00'::TIME) AS morning_time,
    COALESCE(np.reminder_2h, true) AS reminder_2h
  INTO v_prefs
  FROM (SELECT 1) AS dummy
  LEFT JOIN notification_preferences np ON np.user_id = NEW.simple_user_id::text;

  IF v_prefs.reminder_24h AND v_slot_datetime > now() + INTERVAL '24 hours' THEN
    INSERT INTO public.booking_reminders (booking_id, simple_user_id, reminder_type, scheduled_at, product_title, slot_date, slot_time, target_role)
    VALUES (NEW.id, NEW.simple_user_id, '24h', v_slot_datetime - INTERVAL '24 hours', v_product_title, v_slot_date, v_slot_time, 'student');
  END IF;

  IF v_prefs.reminder_morning THEN
    v_morning_datetime := ((v_slot_date::TEXT || ' ' || v_prefs.morning_time::TEXT)::TIMESTAMP AT TIME ZONE 'Asia/Almaty');
    IF v_morning_datetime > now() THEN
      INSERT INTO public.booking_reminders (booking_id, simple_user_id, reminder_type, scheduled_at, product_title, slot_date, slot_time, target_role)
      VALUES (NEW.id, NEW.simple_user_id, 'morning', v_morning_datetime, v_product_title, v_slot_date, v_slot_time, 'student');
    END IF;
  END IF;

  IF v_prefs.reminder_2h AND v_slot_datetime > now() + INTERVAL '2 hours' THEN
    INSERT INTO public.booking_reminders (booking_id, simple_user_id, reminder_type, scheduled_at, product_title, slot_date, slot_time, target_role)
    VALUES (NEW.id, NEW.simple_user_id, '2h', v_slot_datetime - INTERVAL '2 hours', v_product_title, v_slot_date, v_slot_time, 'student');
  END IF;

  IF v_slot_datetime > now() + INTERVAL '24 hours' THEN
    INSERT INTO public.booking_reminders (booking_id, simple_user_id, reminder_type, scheduled_at, product_title, slot_date, slot_time, target_role)
    VALUES (NEW.id, NULL, '24h', v_slot_datetime - INTERVAL '24 hours', v_product_title, v_slot_date, v_slot_time, 'creator');
  END IF;

  IF v_slot_datetime > now() + INTERVAL '2 hours' THEN
    INSERT INTO public.booking_reminders (booking_id, simple_user_id, reminder_type, scheduled_at, product_title, slot_date, slot_time, target_role)
    VALUES (NEW.id, NULL, '2h', v_slot_datetime - INTERVAL '2 hours', v_product_title, v_slot_date, v_slot_time, 'creator');
  END IF;

  v_morning_datetime := ((v_slot_date::TEXT || ' 08:00:00')::TIMESTAMP AT TIME ZONE 'Asia/Almaty');
  IF v_morning_datetime > now() THEN
    INSERT INTO public.booking_reminders (booking_id, simple_user_id, reminder_type, scheduled_at, product_title, slot_date, slot_time, target_role)
    VALUES (NEW.id, NULL, 'morning', v_morning_datetime, v_product_title, v_slot_date, v_slot_time, 'creator');
  END IF;

  IF v_schedule_teacher_id IS NOT NULL THEN
    IF v_slot_datetime > now() + INTERVAL '24 hours' THEN
      INSERT INTO public.booking_reminders (booking_id, simple_user_id, reminder_type, scheduled_at, product_title, slot_date, slot_time, target_role)
      VALUES (NEW.id, v_schedule_teacher_id, '24h', v_slot_datetime - INTERVAL '24 hours', v_product_title, v_slot_date, v_slot_time, 'teacher');
    END IF;

    IF v_slot_datetime > now() + INTERVAL '2 hours' THEN
      INSERT INTO public.booking_reminders (booking_id, simple_user_id, reminder_type, scheduled_at, product_title, slot_date, slot_time, target_role)
      VALUES (NEW.id, v_schedule_teacher_id, '2h', v_slot_datetime - INTERVAL '2 hours', v_product_title, v_slot_date, v_slot_time, 'teacher');
    END IF;

    v_morning_datetime := ((v_slot_date::TEXT || ' 08:00:00')::TIMESTAMP AT TIME ZONE 'Asia/Almaty');
    IF v_morning_datetime > now() THEN
      INSERT INTO public.booking_reminders (booking_id, simple_user_id, reminder_type, scheduled_at, product_title, slot_date, slot_time, target_role)
      VALUES (NEW.id, v_schedule_teacher_id, 'morning', v_morning_datetime, v_product_title, v_slot_date, v_slot_time, 'teacher');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_booking_reminders"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'name', NEW.email);
  
  -- Assign default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_booking_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."notify_booking_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_purchase_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."notify_purchase_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_reschedule"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM public.call_edge_function('notify-reschedule',
    jsonb_build_object('type','INSERT','record',row_to_json(NEW)));
  RETURN NEW;
END; $$;


ALTER FUNCTION "public"."notify_reschedule"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_reschedule_request"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM public.call_edge_function('notify-reschedule-request',
    jsonb_build_object('type','INSERT','record',row_to_json(NEW)));
  RETURN NEW;
END; $$;


ALTER FUNCTION "public"."notify_reschedule_request"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_reschedule_response"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status IN ('approved','rejected') THEN
    PERFORM public.call_edge_function('notify-reschedule-response',
      jsonb_build_object('type','UPDATE','record',row_to_json(NEW),'old_record',row_to_json(OLD)));
  END IF;
  RETURN NEW;
END; $$;


ALTER FUNCTION "public"."notify_reschedule_response"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_purchase_fraud"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Only allow status change to 'completed' via service role
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    IF NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role' IS DISTINCT FROM 'service_role' THEN
      RAISE EXCEPTION 'Only administrators can approve purchases';
    END IF;
  END IF;
  
  -- Prevent changing confirmed_at directly from client
  IF NEW.confirmed_at IS DISTINCT FROM OLD.confirmed_at THEN
    IF NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role' IS DISTINCT FROM 'service_role' THEN
      RAISE EXCEPTION 'Cannot modify confirmation timestamp';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_purchase_fraud"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_simple_purchase_fraud"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    IF NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role' IS DISTINCT FROM 'service_role' THEN
      RAISE EXCEPTION 'Only administrators can approve purchases';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_simple_purchase_fraud"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."announcements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "creator_id" "text" NOT NULL,
    "content_html" "text" DEFAULT ''::"text" NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."announcements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."app_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."auth_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "identifier" "text" NOT NULL,
    "ip" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."auth_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_cancellations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "user_name" "text" NOT NULL,
    "user_phone" "text",
    "product_title" "text" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "schedule_title" "text",
    "slot_date" "date" NOT NULL,
    "slot_time" time without time zone NOT NULL,
    "cancelled_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cancelled_by" "text" DEFAULT 'student'::"text" NOT NULL,
    "schedule_id" "uuid",
    "cancellation_reasons" "text"[] DEFAULT '{}'::"text"[],
    "cancellation_comment" "text",
    "simple_user_id" "uuid"
);


ALTER TABLE "public"."booking_cancellations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_reminders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid",
    "reminder_type" "text" NOT NULL,
    "scheduled_at" timestamp with time zone NOT NULL,
    "sent_at" timestamp with time zone,
    "product_title" "text",
    "slot_date" "date",
    "slot_time" time without time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "simple_user_id" "uuid",
    "target_role" "text" DEFAULT 'student'::"text" NOT NULL,
    CONSTRAINT "booking_reminders_reminder_type_check" CHECK (("reminder_type" = ANY (ARRAY['24h'::"text", '2h'::"text", 'morning'::"text"])))
);


ALTER TABLE "public"."booking_reminders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_reschedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "simple_user_id" "uuid",
    "schedule_id" "uuid",
    "product_id" "uuid" NOT NULL,
    "product_title" "text" NOT NULL,
    "old_date" "date" NOT NULL,
    "old_time" time without time zone NOT NULL,
    "new_date" "date" NOT NULL,
    "new_time" time without time zone NOT NULL,
    "rescheduled_by" "text" DEFAULT 'creator'::"text" NOT NULL,
    "reasons" "text"[] DEFAULT '{}'::"text"[],
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."booking_reschedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."creator_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "login" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "password_hash" "text",
    "account_type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_blocked" boolean DEFAULT false NOT NULL,
    "recovery_phone" "text",
    "email" "text",
    "auth_user_id" "uuid",
    CONSTRAINT "creator_accounts_account_type_check" CHECK (("account_type" = ANY (ARRAY['course_creator'::"text", 'online_school'::"text"])))
);


ALTER TABLE "public"."creator_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."creator_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "token" "text" NOT NULL,
    "creator_name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."creator_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."material_access_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "token" "text" NOT NULL,
    "file_path" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "used" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."material_access_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."material_bookmarks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "material_id" "uuid" NOT NULL,
    "user_type" "text" NOT NULL,
    "user_ref" "text" NOT NULL,
    "is_public" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "material_bookmarks_user_type_check" CHECK (("user_type" = ANY (ARRAY['creator'::"text", 'teacher'::"text", 'student'::"text"])))
);


ALTER TABLE "public"."material_bookmarks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."material_unlocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "material_id" "uuid",
    "product_id" "uuid",
    "material_title" "text" NOT NULL,
    "product_title" "text" NOT NULL,
    "unlocked_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."material_unlocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."materials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "type" "public"."material_type" DEFAULT 'text'::"public"."material_type" NOT NULL,
    "content" "text",
    "file_url" "text",
    "order_index" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "parent_id" "uuid",
    "allow_view" boolean DEFAULT true NOT NULL,
    "allow_download" boolean DEFAULT true NOT NULL,
    "teacher_id" "uuid",
    "available_at" timestamp with time zone,
    "teacher_allow_download" boolean DEFAULT true NOT NULL,
    "deleted_at" timestamp with time zone,
    "file_size" bigint,
    "original_parent_id" "uuid"
);


ALTER TABLE "public"."materials" OWNER TO "postgres";


COMMENT ON COLUMN "public"."materials"."allow_view" IS 'Whether students/teachers can view this file in browser';



COMMENT ON COLUMN "public"."materials"."allow_download" IS 'Whether students/teachers can download this file';



CREATE TABLE IF NOT EXISTS "public"."moderator_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "token" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '30 days'::interval) NOT NULL
);


ALTER TABLE "public"."moderator_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reminder_24h" boolean DEFAULT true NOT NULL,
    "reminder_morning" boolean DEFAULT false NOT NULL,
    "morning_time" time without time zone DEFAULT '08:00:00'::time without time zone NOT NULL,
    "reminder_2h" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "text"
);


ALTER TABLE "public"."notification_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_teachers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "teacher_name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."product_teachers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "creator_id" "text",
    "title" "text" NOT NULL,
    "headline" "text",
    "description" "text",
    "price" numeric(10,2) DEFAULT 0 NOT NULL,
    "image_url" "text",
    "has_schedule" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "slug" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "kaspi_link" "text",
    "telegram_link" "text",
    "video_url" "text",
    "faq" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "kaspi_phone" "text",
    "access_duration_days" integer,
    "group_link_label" "text",
    "is_paused" boolean DEFAULT false NOT NULL,
    "paused_message" "text",
    "creator_account_id" "uuid"
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."products_catalog" WITH ("security_invoker"='true') AS
 SELECT "id",
    "created_at",
    "updated_at",
    "creator_id",
    "creator_account_id",
    "title",
    "headline",
    "description",
    "price",
    "image_url",
    "video_url",
    "has_schedule",
    "is_active",
    "is_paused",
    "paused_message",
    "slug",
    "telegram_link",
    "group_link_label",
    "faq",
    "access_duration_days"
   FROM "public"."products"
  WHERE (("is_active" = true) AND ("is_paused" = false));


ALTER VIEW "public"."products_catalog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_role" "text" DEFAULT 'student'::"text" NOT NULL,
    "fcm_token" "text" NOT NULL,
    "device_info" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid"
);


ALTER TABLE "public"."push_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reschedule_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "simple_user_id" "uuid",
    "schedule_id" "uuid",
    "product_id" "uuid" NOT NULL,
    "product_title" "text" NOT NULL,
    "old_date" "date" NOT NULL,
    "old_time" time without time zone NOT NULL,
    "new_date" "date" NOT NULL,
    "new_time" time without time zone NOT NULL,
    "reasons" "text"[] DEFAULT '{}'::"text"[],
    "comment" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "response_comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "responded_at" timestamp with time zone,
    "requested_by" "text" DEFAULT 'student'::"text" NOT NULL,
    "teacher_id" "uuid"
);


ALTER TABLE "public"."reschedule_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "event_type" "public"."event_type" DEFAULT 'individual'::"public"."event_type" NOT NULL,
    "max_participants" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "teacher_id" "uuid"
);


ALTER TABLE "public"."schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."signup_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "token" "text" NOT NULL,
    "email" "text" NOT NULL,
    "name" "text" NOT NULL,
    "product_id" "uuid",
    "expires_at" timestamp with time zone NOT NULL,
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."signup_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."simple_bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "simple_user_id" "uuid" NOT NULL,
    "time_slot_id" "uuid" NOT NULL,
    "schedule_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'confirmed'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."simple_bookings" REPLICA IDENTITY FULL;


ALTER TABLE "public"."simple_bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."simple_purchases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "simple_user_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "amount" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "confirmed_at" timestamp with time zone,
    "assigned_teacher_id" "uuid",
    "can_choose_teacher" boolean DEFAULT false,
    CONSTRAINT "simple_purchases_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'revoked'::"text"])))
);

ALTER TABLE ONLY "public"."simple_purchases" REPLICA IDENTITY FULL;


ALTER TABLE "public"."simple_purchases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."simple_user_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "token" "text" NOT NULL,
    "simple_user_id" "uuid" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."simple_user_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."simple_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "phone" "text" NOT NULL,
    "name" "text" NOT NULL,
    "role" "text" DEFAULT 'student'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "pin_hash" "text",
    CONSTRAINT "simple_users_role_check" CHECK (("role" = ANY (ARRAY['student'::"text", 'creator'::"text", 'teacher'::"text"])))
);


ALTER TABLE "public"."simple_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."support_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "thread_id" "uuid" NOT NULL,
    "sender" "text" NOT NULL,
    "text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "read_at" timestamp with time zone,
    CONSTRAINT "support_messages_sender_check" CHECK (("sender" = ANY (ARRAY['user'::"text", 'moderator'::"text"])))
);


ALTER TABLE "public"."support_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."support_threads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_type" "text" NOT NULL,
    "user_ref" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "last_message_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_message_preview" "text",
    "unread_for_moderator" integer DEFAULT 0 NOT NULL,
    "unread_for_user" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "support_threads_user_type_check" CHECK (("user_type" = ANY (ARRAY['creator'::"text", 'teacher'::"text", 'student'::"text"])))
);


ALTER TABLE "public"."support_threads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."time_slots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "schedule_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "is_available" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "max_participants" integer,
    "lesson_link" "text"
);

ALTER TABLE ONLY "public"."time_slots" REPLICA IDENTITY FULL;


ALTER TABLE "public"."time_slots" OWNER TO "postgres";


COMMENT ON COLUMN "public"."time_slots"."max_participants" IS 'Override max participants for this specific slot. NULL means use schedule default.';



ALTER TABLE ONLY "public"."announcements"
    ADD CONSTRAINT "announcements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_settings"
    ADD CONSTRAINT "app_settings_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."app_settings"
    ADD CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auth_attempts"
    ADD CONSTRAINT "auth_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_cancellations"
    ADD CONSTRAINT "booking_cancellations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_reminders"
    ADD CONSTRAINT "booking_reminders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_reschedules"
    ADD CONSTRAINT "booking_reschedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."creator_accounts"
    ADD CONSTRAINT "creator_accounts_auth_user_id_key" UNIQUE ("auth_user_id");



ALTER TABLE ONLY "public"."creator_accounts"
    ADD CONSTRAINT "creator_accounts_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."creator_accounts"
    ADD CONSTRAINT "creator_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."creator_sessions"
    ADD CONSTRAINT "creator_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."creator_sessions"
    ADD CONSTRAINT "creator_sessions_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."material_access_tokens"
    ADD CONSTRAINT "material_access_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."material_access_tokens"
    ADD CONSTRAINT "material_access_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."material_bookmarks"
    ADD CONSTRAINT "material_bookmarks_material_id_user_type_user_ref_key" UNIQUE ("material_id", "user_type", "user_ref");



ALTER TABLE ONLY "public"."material_bookmarks"
    ADD CONSTRAINT "material_bookmarks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."material_unlocks"
    ADD CONSTRAINT "material_unlocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."materials"
    ADD CONSTRAINT "materials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."moderator_sessions"
    ADD CONSTRAINT "moderator_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."moderator_sessions"
    ADD CONSTRAINT "moderator_sessions_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_teachers"
    ADD CONSTRAINT "product_teachers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reschedule_requests"
    ADD CONSTRAINT "reschedule_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."signup_tokens"
    ADD CONSTRAINT "signup_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."signup_tokens"
    ADD CONSTRAINT "signup_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."simple_bookings"
    ADD CONSTRAINT "simple_bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."simple_purchases"
    ADD CONSTRAINT "simple_purchases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."simple_user_sessions"
    ADD CONSTRAINT "simple_user_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."simple_user_sessions"
    ADD CONSTRAINT "simple_user_sessions_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."simple_users"
    ADD CONSTRAINT "simple_users_phone_key" UNIQUE ("phone");



ALTER TABLE ONLY "public"."simple_users"
    ADD CONSTRAINT "simple_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."support_messages"
    ADD CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."support_threads"
    ADD CONSTRAINT "support_threads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."support_threads"
    ADD CONSTRAINT "support_threads_user_type_user_ref_key" UNIQUE ("user_type", "user_ref");



ALTER TABLE ONLY "public"."time_slots"
    ADD CONSTRAINT "time_slots_pkey" PRIMARY KEY ("id");



CREATE INDEX "announcements_creator_id_idx" ON "public"."announcements" USING "btree" ("creator_id");



CREATE INDEX "announcements_product_id_idx" ON "public"."announcements" USING "btree" ("product_id");



CREATE UNIQUE INDEX "creator_accounts_email_lower_idx" ON "public"."creator_accounts" USING "btree" ("lower"("email")) WHERE ("email" IS NOT NULL);



CREATE UNIQUE INDEX "creator_accounts_login_lower_idx" ON "public"."creator_accounts" USING "btree" ("lower"("login"));



CREATE INDEX "idx_auth_attempts_identifier_created_at" ON "public"."auth_attempts" USING "btree" ("identifier", "created_at" DESC);



CREATE INDEX "idx_booking_cancellations_schedule_id" ON "public"."booking_cancellations" USING "btree" ("schedule_id");



CREATE INDEX "idx_booking_reminders_pending" ON "public"."booking_reminders" USING "btree" ("scheduled_at") WHERE ("sent_at" IS NULL);



CREATE UNIQUE INDEX "idx_creator_accounts_login_lower" ON "public"."creator_accounts" USING "btree" ("lower"("login"));



CREATE INDEX "idx_creator_sessions_creator_name" ON "public"."creator_sessions" USING "btree" ("creator_name");



CREATE INDEX "idx_material_access_tokens_expires" ON "public"."material_access_tokens" USING "btree" ("expires_at");



CREATE INDEX "idx_material_access_tokens_token" ON "public"."material_access_tokens" USING "btree" ("token");



CREATE INDEX "idx_material_bookmarks_material" ON "public"."material_bookmarks" USING "btree" ("material_id");



CREATE INDEX "idx_material_bookmarks_public" ON "public"."material_bookmarks" USING "btree" ("material_id") WHERE ("is_public" = true);



CREATE UNIQUE INDEX "idx_material_bookmarks_unique_ref" ON "public"."material_bookmarks" USING "btree" ("material_id", "user_type", "user_ref") WHERE ("user_ref" IS NOT NULL);



CREATE INDEX "idx_material_bookmarks_user" ON "public"."material_bookmarks" USING "btree" ("user_type", "user_ref");



CREATE INDEX "idx_materials_parent_id" ON "public"."materials" USING "btree" ("parent_id");



CREATE INDEX "idx_materials_teacher_id" ON "public"."materials" USING "btree" ("teacher_id");



CREATE UNIQUE INDEX "idx_notification_preferences_user_id" ON "public"."notification_preferences" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE UNIQUE INDEX "idx_product_teachers_product_name" ON "public"."product_teachers" USING "btree" ("product_id", "teacher_name") WHERE ("teacher_name" IS NOT NULL);



CREATE UNIQUE INDEX "idx_product_teachers_unique" ON "public"."product_teachers" USING "btree" ("product_id", "teacher_name");



CREATE INDEX "idx_push_tokens_fcm_token" ON "public"."push_tokens" USING "btree" ("fcm_token");



CREATE INDEX "idx_push_tokens_user_id" ON "public"."push_tokens" USING "btree" ("user_id");



CREATE INDEX "idx_simple_bookings_schedule" ON "public"."simple_bookings" USING "btree" ("schedule_id");



CREATE INDEX "idx_simple_bookings_slot" ON "public"."simple_bookings" USING "btree" ("time_slot_id");



CREATE INDEX "idx_simple_bookings_user" ON "public"."simple_bookings" USING "btree" ("simple_user_id");



CREATE INDEX "idx_simple_purchases_product" ON "public"."simple_purchases" USING "btree" ("product_id");



CREATE INDEX "idx_simple_purchases_user" ON "public"."simple_purchases" USING "btree" ("simple_user_id");



CREATE INDEX "idx_simple_user_sessions_expires_at" ON "public"."simple_user_sessions" USING "btree" ("expires_at");



CREATE INDEX "idx_simple_user_sessions_user_id" ON "public"."simple_user_sessions" USING "btree" ("simple_user_id");



CREATE INDEX "idx_simple_users_name" ON "public"."simple_users" USING "btree" ("name");



CREATE UNIQUE INDEX "idx_simple_users_name_unique" ON "public"."simple_users" USING "btree" ("name");



CREATE INDEX "idx_simple_users_phone" ON "public"."simple_users" USING "btree" ("phone");



CREATE UNIQUE INDEX "idx_support_threads_user_ref" ON "public"."support_threads" USING "btree" ("user_type", "user_ref") WHERE ("user_ref" IS NOT NULL);



CREATE INDEX "materials_deleted_at_idx" ON "public"."materials" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NOT NULL);



CREATE INDEX "products_creator_account_id_idx" ON "public"."products" USING "btree" ("creator_account_id");



CREATE UNIQUE INDEX "simple_bookings_user_slot_unique" ON "public"."simple_bookings" USING "btree" ("simple_user_id", "time_slot_id");



CREATE INDEX "support_messages_thread_idx" ON "public"."support_messages" USING "btree" ("thread_id", "created_at");



CREATE OR REPLACE TRIGGER "check_purchase_approval" BEFORE UPDATE ON "public"."simple_purchases" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_purchase_fraud"();



CREATE OR REPLACE TRIGGER "create_reminders_on_booking" AFTER INSERT ON "public"."simple_bookings" FOR EACH ROW EXECUTE FUNCTION "public"."create_booking_reminders"();



CREATE OR REPLACE TRIGGER "on_booking_reschedule" AFTER INSERT ON "public"."booking_reschedules" FOR EACH ROW EXECUTE FUNCTION "public"."notify_reschedule"();



CREATE OR REPLACE TRIGGER "on_reschedule_request_insert" AFTER INSERT ON "public"."reschedule_requests" FOR EACH ROW EXECUTE FUNCTION "public"."notify_reschedule_request"();



CREATE OR REPLACE TRIGGER "on_reschedule_request_update" AFTER UPDATE ON "public"."reschedule_requests" FOR EACH ROW EXECUTE FUNCTION "public"."notify_reschedule_response"();



CREATE OR REPLACE TRIGGER "on_simple_purchase_change" AFTER INSERT OR UPDATE ON "public"."simple_purchases" FOR EACH ROW EXECUTE FUNCTION "public"."notify_purchase_change"();



CREATE OR REPLACE TRIGGER "prevent_simple_purchase_fraud_trg" BEFORE UPDATE ON "public"."simple_purchases" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_simple_purchase_fraud"();



CREATE OR REPLACE TRIGGER "support_threads_updated_at" BEFORE UPDATE ON "public"."support_threads" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trigger_notify_booking_delete" AFTER DELETE ON "public"."simple_bookings" FOR EACH ROW EXECUTE FUNCTION "public"."notify_booking_change"();



CREATE OR REPLACE TRIGGER "trigger_notify_booking_insert" AFTER INSERT ON "public"."simple_bookings" FOR EACH ROW EXECUTE FUNCTION "public"."notify_booking_change"();



CREATE OR REPLACE TRIGGER "trigger_notify_purchase_insert" AFTER INSERT ON "public"."simple_purchases" FOR EACH ROW EXECUTE FUNCTION "public"."notify_purchase_change"();



CREATE OR REPLACE TRIGGER "trigger_notify_purchase_update" AFTER UPDATE ON "public"."simple_purchases" FOR EACH ROW EXECUTE FUNCTION "public"."notify_purchase_change"();



CREATE OR REPLACE TRIGGER "update_announcements_updated_at" BEFORE UPDATE ON "public"."announcements" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_creator_accounts_updated_at" BEFORE UPDATE ON "public"."creator_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_notification_preferences_updated_at" BEFORE UPDATE ON "public"."notification_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_products_updated_at" BEFORE UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_push_tokens_updated_at" BEFORE UPDATE ON "public"."push_tokens" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_simple_users_updated_at" BEFORE UPDATE ON "public"."simple_users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."announcements"
    ADD CONSTRAINT "announcements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_cancellations"
    ADD CONSTRAINT "booking_cancellations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_cancellations"
    ADD CONSTRAINT "booking_cancellations_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."booking_reminders"
    ADD CONSTRAINT "booking_reminders_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."simple_bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."creator_accounts"
    ADD CONSTRAINT "creator_accounts_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."material_bookmarks"
    ADD CONSTRAINT "material_bookmarks_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."material_unlocks"
    ADD CONSTRAINT "material_unlocks_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."material_unlocks"
    ADD CONSTRAINT "material_unlocks_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."materials"
    ADD CONSTRAINT "materials_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."materials"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."materials"
    ADD CONSTRAINT "materials_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."materials"
    ADD CONSTRAINT "materials_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."simple_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_teachers"
    ADD CONSTRAINT "product_teachers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_creator_account_id_fkey" FOREIGN KEY ("creator_account_id") REFERENCES "public"."creator_accounts"("id");



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."simple_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."signup_tokens"
    ADD CONSTRAINT "signup_tokens_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."simple_bookings"
    ADD CONSTRAINT "simple_bookings_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."simple_bookings"
    ADD CONSTRAINT "simple_bookings_simple_user_id_fkey" FOREIGN KEY ("simple_user_id") REFERENCES "public"."simple_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."simple_bookings"
    ADD CONSTRAINT "simple_bookings_time_slot_id_fkey" FOREIGN KEY ("time_slot_id") REFERENCES "public"."time_slots"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."simple_purchases"
    ADD CONSTRAINT "simple_purchases_assigned_teacher_id_fkey" FOREIGN KEY ("assigned_teacher_id") REFERENCES "public"."simple_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."simple_purchases"
    ADD CONSTRAINT "simple_purchases_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."simple_purchases"
    ADD CONSTRAINT "simple_purchases_simple_user_id_fkey" FOREIGN KEY ("simple_user_id") REFERENCES "public"."simple_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."simple_user_sessions"
    ADD CONSTRAINT "simple_user_sessions_simple_user_id_fkey" FOREIGN KEY ("simple_user_id") REFERENCES "public"."simple_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."support_messages"
    ADD CONSTRAINT "support_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."support_threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_slots"
    ADD CONSTRAINT "time_slots_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE CASCADE;



CREATE POLICY "Allow insert push_tokens" ON "public"."push_tokens" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can read settings" ON "public"."app_settings" FOR SELECT USING (true);



CREATE POLICY "No direct access to creator_sessions" ON "public"."creator_sessions" USING (false);



CREATE POLICY "No direct access to material_access_tokens" ON "public"."material_access_tokens" USING (false);



CREATE POLICY "No direct access to signup_tokens" ON "public"."signup_tokens" USING (false);



CREATE POLICY "No direct delete push_tokens" ON "public"."push_tokens" FOR DELETE USING (false);



CREATE POLICY "No direct read push_tokens" ON "public"."push_tokens" FOR SELECT USING (false);



CREATE POLICY "No direct update push_tokens" ON "public"."push_tokens" FOR UPDATE USING (false);



CREATE POLICY "Service role can manage reminders" ON "public"."booking_reminders" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access" ON "public"."creator_accounts" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."announcements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."app_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."auth_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."booking_cancellations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."booking_reminders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."booking_reschedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."creator_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."creator_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."material_access_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."material_bookmarks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."material_unlocks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."materials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."moderator_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "no direct access moderator_sessions" ON "public"."moderator_sessions" USING (false) WITH CHECK (false);



ALTER TABLE "public"."notification_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_teachers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "products_public_read_active" ON "public"."products" FOR SELECT TO "authenticated", "anon" USING ((("is_active" = true) AND ("is_paused" = false)));



ALTER TABLE "public"."push_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reschedule_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."signup_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."simple_bookings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."simple_purchases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."simple_user_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."simple_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."support_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."support_threads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."time_slots" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."booking_cancellations";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."booking_reschedules";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."material_unlocks";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notification_preferences";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."product_teachers";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."reschedule_requests";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."simple_bookings";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."simple_purchases";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."support_messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."support_threads";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."time_slots";



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";











































































































































































GRANT ALL ON FUNCTION "public"."call_edge_function"("_name" "text", "_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."call_edge_function"("_name" "text", "_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."call_edge_function"("_name" "text", "_payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_booking_reminders"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_booking_reminders"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_booking_reminders"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_booking_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_booking_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_booking_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_purchase_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_purchase_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_purchase_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_reschedule"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_reschedule"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_reschedule"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_reschedule_request"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_reschedule_request"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_reschedule_request"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_reschedule_response"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_reschedule_response"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_reschedule_response"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_purchase_fraud"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_purchase_fraud"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_purchase_fraud"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_simple_purchase_fraud"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_simple_purchase_fraud"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_simple_purchase_fraud"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";












SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;









GRANT ALL ON TABLE "public"."announcements" TO "service_role";



GRANT ALL ON TABLE "public"."app_settings" TO "anon";
GRANT ALL ON TABLE "public"."app_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."app_settings" TO "service_role";



GRANT ALL ON TABLE "public"."auth_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."booking_cancellations" TO "service_role";



GRANT ALL ON TABLE "public"."booking_reminders" TO "service_role";



GRANT ALL ON TABLE "public"."booking_reschedules" TO "service_role";



GRANT ALL ON TABLE "public"."creator_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."creator_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."material_access_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."material_bookmarks" TO "service_role";



GRANT ALL ON TABLE "public"."material_unlocks" TO "service_role";



GRANT ALL ON TABLE "public"."materials" TO "service_role";



GRANT ALL ON TABLE "public"."moderator_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."notification_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."product_teachers" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."products" TO "anon";
GRANT SELECT("id") ON TABLE "public"."products" TO "authenticated";



GRANT SELECT("creator_id") ON TABLE "public"."products" TO "anon";
GRANT SELECT("creator_id") ON TABLE "public"."products" TO "authenticated";



GRANT SELECT("title") ON TABLE "public"."products" TO "anon";
GRANT SELECT("title") ON TABLE "public"."products" TO "authenticated";



GRANT SELECT("headline") ON TABLE "public"."products" TO "anon";
GRANT SELECT("headline") ON TABLE "public"."products" TO "authenticated";



GRANT SELECT("description") ON TABLE "public"."products" TO "anon";
GRANT SELECT("description") ON TABLE "public"."products" TO "authenticated";



GRANT SELECT("price") ON TABLE "public"."products" TO "anon";
GRANT SELECT("price") ON TABLE "public"."products" TO "authenticated";



GRANT SELECT("image_url") ON TABLE "public"."products" TO "anon";
GRANT SELECT("image_url") ON TABLE "public"."products" TO "authenticated";



GRANT SELECT("has_schedule") ON TABLE "public"."products" TO "anon";
GRANT SELECT("has_schedule") ON TABLE "public"."products" TO "authenticated";



GRANT SELECT("is_active") ON TABLE "public"."products" TO "anon";
GRANT SELECT("is_active") ON TABLE "public"."products" TO "authenticated";



GRANT SELECT("slug") ON TABLE "public"."products" TO "anon";
GRANT SELECT("slug") ON TABLE "public"."products" TO "authenticated";



GRANT SELECT("created_at") ON TABLE "public"."products" TO "anon";
GRANT SELECT("created_at") ON TABLE "public"."products" TO "authenticated";



GRANT SELECT("updated_at") ON TABLE "public"."products" TO "anon";
GRANT SELECT("updated_at") ON TABLE "public"."products" TO "authenticated";



GRANT SELECT("telegram_link") ON TABLE "public"."products" TO "anon";
GRANT SELECT("telegram_link") ON TABLE "public"."products" TO "authenticated";



GRANT SELECT("video_url") ON TABLE "public"."products" TO "anon";
GRANT SELECT("video_url") ON TABLE "public"."products" TO "authenticated";



GRANT SELECT("faq") ON TABLE "public"."products" TO "anon";
GRANT SELECT("faq") ON TABLE "public"."products" TO "authenticated";



GRANT SELECT("access_duration_days") ON TABLE "public"."products" TO "anon";
GRANT SELECT("access_duration_days") ON TABLE "public"."products" TO "authenticated";



GRANT SELECT("group_link_label") ON TABLE "public"."products" TO "anon";
GRANT SELECT("group_link_label") ON TABLE "public"."products" TO "authenticated";



GRANT SELECT("is_paused") ON TABLE "public"."products" TO "anon";
GRANT SELECT("is_paused") ON TABLE "public"."products" TO "authenticated";



GRANT SELECT("paused_message") ON TABLE "public"."products" TO "anon";
GRANT SELECT("paused_message") ON TABLE "public"."products" TO "authenticated";



GRANT SELECT("creator_account_id") ON TABLE "public"."products" TO "anon";
GRANT SELECT("creator_account_id") ON TABLE "public"."products" TO "authenticated";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."products_catalog" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."products_catalog" TO "authenticated";
GRANT ALL ON TABLE "public"."products_catalog" TO "service_role";



GRANT ALL ON TABLE "public"."push_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."reschedule_requests" TO "service_role";



GRANT ALL ON TABLE "public"."schedules" TO "service_role";



GRANT ALL ON TABLE "public"."signup_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."simple_bookings" TO "service_role";



GRANT ALL ON TABLE "public"."simple_purchases" TO "service_role";



GRANT ALL ON TABLE "public"."simple_user_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."simple_users" TO "service_role";



GRANT ALL ON TABLE "public"."support_messages" TO "service_role";



GRANT ALL ON TABLE "public"."support_threads" TO "service_role";



GRANT ALL ON TABLE "public"."time_slots" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































