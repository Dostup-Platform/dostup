-- Reports are durable evidence. All moderation mutations run in one transaction.
CREATE SCHEMA IF NOT EXISTS moderation;
REVOKE ALL ON SCHEMA moderation FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA moderation TO service_role;

ALTER TABLE public.creator_accounts ADD COLUMN IF NOT EXISTS moderation_restricted boolean NOT NULL DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS moderation_locked boolean NOT NULL DEFAULT false;

-- Some installations predate the reports table (it was previously created outside migrations).
CREATE TABLE IF NOT EXISTS public.product_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  user_id uuid,
  reporter_name text,
  reporter_contact text,
  reason text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by text
);
ALTER TABLE public.product_reports
  ADD COLUMN IF NOT EXISTS creator_account_id uuid REFERENCES public.creator_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reporter_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reporter_user_type text,
  ADD COLUMN IF NOT EXISTS reporter_user_ref text,
  ADD COLUMN IF NOT EXISTS product_title text,
  ADD COLUMN IF NOT EXISTS original_product_id uuid,
  ADD COLUMN IF NOT EXISTS seller_name text,
  ADD COLUMN IF NOT EXISTS target_type text NOT NULL DEFAULT 'product',
  ADD COLUMN IF NOT EXISTS correction_text text,
  ADD COLUMN IF NOT EXISTS correction_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS correction_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS overdue_notified_at timestamptz;
ALTER TABLE public.product_reports ALTER COLUMN product_id DROP NOT NULL;
-- Replace legacy status checks and cascading product FK; deletion must not erase a report.
DO $$ DECLARE c record; BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'public.product_reports'::regclass
    AND ((contype = 'c' AND pg_get_constraintdef(oid) LIKE '%status%') OR
         (contype = 'f' AND pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (product_id)%'))
  LOOP EXECUTE format('ALTER TABLE public.product_reports DROP CONSTRAINT %I', c.conname); END LOOP;
END $$;
ALTER TABLE public.product_reports ADD CONSTRAINT product_reports_product_fk FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;
ALTER TABLE public.product_reports ADD CONSTRAINT product_reports_status_check CHECK (status IN ('pending','correction_requested','dismissed','blocked','resolved'));
ALTER TABLE public.product_reports ADD CONSTRAINT product_reports_target_check CHECK (target_type IN ('product','account'));
UPDATE public.product_reports r SET creator_account_id = p.creator_account_id, product_title = p.title, original_product_id = p.id,
  seller_name = c.display_name FROM public.products p LEFT JOIN public.creator_accounts c ON c.id = p.creator_account_id
  WHERE r.product_id = p.id AND r.creator_account_id IS NULL;
CREATE INDEX IF NOT EXISTS product_reports_creator_history_idx ON public.product_reports(creator_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS product_reports_incoming_idx ON public.product_reports(status, correction_deadline) WHERE status IN ('pending','correction_requested');
ALTER TABLE public.product_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.product_reports FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.product_reports TO service_role;

CREATE TABLE moderation.product_state (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  creator_account_id uuid NOT NULL REFERENCES public.creator_accounts(id) ON DELETE CASCADE,
  is_published boolean NOT NULL,
  is_paused boolean NOT NULL,
  paused_message text
);
CREATE INDEX ON moderation.product_state(creator_account_id);
CREATE TABLE moderation.banned_identifiers (
  kind text NOT NULL CHECK (kind IN ('auth','email','google','device','ip','login')),
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(kind,value)
);
CREATE TABLE moderation.session_signals (
  token text PRIMARY KEY REFERENCES public.creator_sessions(token) ON DELETE CASCADE,
  device_hash text,
  ip_hash text
);
CREATE TABLE public.moderation_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_account_id uuid REFERENCES public.creator_accounts(id) ON DELETE CASCADE,
  report_id uuid REFERENCES public.product_reports(id) ON DELETE SET NULL,
  event text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(report_id, event)
);
CREATE INDEX ON public.moderation_notifications(creator_account_id, created_at DESC);
ALTER TABLE public.moderation_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.moderation_notifications FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.moderation_notifications TO service_role;
ALTER TABLE moderation.product_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation.banned_identifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation.session_signals ENABLE ROW LEVEL SECURITY;
GRANT ALL ON ALL TABLES IN SCHEMA moderation TO service_role;

CREATE FUNCTION moderation.auth_is_banned(uid uuid, email_address text DEFAULT NULL) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM moderation.banned_identifiers b WHERE
    (b.kind = 'auth' AND b.value = uid::text) OR
    (b.kind = 'email' AND b.value = lower(trim(email_address))))
  OR EXISTS (SELECT 1 FROM public.creator_accounts c WHERE c.auth_user_id = uid AND c.is_blocked);
$$;

CREATE FUNCTION moderation.notify(seller uuid, report uuid, event_name text, message text) RETURNS void
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE c public.creator_accounts; tid uuid;
BEGIN
  INSERT INTO public.moderation_notifications(creator_account_id, report_id, event, body)
    VALUES(seller, report, event_name, message) ON CONFLICT(report_id,event) DO NOTHING;
  IF NOT FOUND OR seller IS NULL THEN RETURN; END IF;
  SELECT * INTO c FROM public.creator_accounts WHERE id = seller;
  INSERT INTO public.support_threads(user_type,user_ref,display_name) VALUES('creator',c.login,c.display_name)
    ON CONFLICT(user_type,user_ref) DO UPDATE SET display_name = excluded.display_name RETURNING id INTO tid;
  INSERT INTO public.support_messages(thread_id,sender,text) VALUES(tid,'moderator',message);
  UPDATE public.support_threads SET unread_for_user = unread_for_user + 1, last_message_at = now(), last_message_preview = left(message,200) WHERE id = tid;
END $$;

CREATE FUNCTION moderation.guard_product() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE c public.creator_accounts;
BEGIN
  SELECT * INTO c FROM public.creator_accounts WHERE id = NEW.creator_account_id FOR SHARE;
  IF c.is_blocked THEN RAISE EXCEPTION 'Аккаунт заблокирован' USING ERRCODE = '42501'; END IF;
  IF TG_OP = 'UPDATE' AND NEW.creator_account_id IS DISTINCT FROM OLD.creator_account_id THEN
    RAISE EXCEPTION 'Нельзя менять владельца продукта' USING ERRCODE = '42501';
  END IF;
  IF c.moderation_restricted THEN
    IF TG_OP = 'INSERT' THEN RAISE EXCEPTION 'Создание продуктов недоступно до завершения проверки' USING ERRCODE = '42501'; END IF;
    IF NEW.is_published OR NOT NEW.is_paused THEN
      RAISE EXCEPTION 'Продажи и публикация приостановлены на время проверки' USING ERRCODE = '42501';
    END IF;
  END IF;
  NEW.moderation_locked := coalesce(c.moderation_restricted,false);
  RETURN NEW;
END $$;
CREATE TRIGGER moderation_guard_product BEFORE INSERT OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION moderation.guard_product();

CREATE FUNCTION moderation.prepare_report() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE c public.creator_accounts; p public.products;
BEGIN
  IF NEW.reason NOT IN ('Продукт не соответствует описанию','Неприемлемый контент','Выдаёт себя за другого человека','Другое') THEN
    RAISE EXCEPTION 'Выберите причину жалобы';
  END IF;
  NEW.description := nullif(trim(NEW.description),'');
  IF NEW.reason = 'Другое' AND NEW.description IS NULL THEN RAISE EXCEPTION 'Для причины «Другое» заполните комментарий'; END IF;
  IF length(NEW.description) > 4000 THEN RAISE EXCEPTION 'Комментарий слишком длинный'; END IF;
  IF NEW.target_type = 'product' THEN
    SELECT * INTO p FROM public.products WHERE id = NEW.product_id;
    IF NOT FOUND OR p.creator_account_id IS NULL THEN RAISE EXCEPTION 'Продукт не найден'; END IF;
    NEW.creator_account_id := p.creator_account_id;
    NEW.product_title := p.title;
    NEW.original_product_id := p.id;
  END IF;
  SELECT * INTO c FROM public.creator_accounts WHERE id = NEW.creator_account_id FOR UPDATE;
  IF NOT FOUND OR c.is_blocked THEN RAISE EXCEPTION 'Продавец недоступен'; END IF;
  IF NEW.reporter_profile_id IS NULL THEN RAISE EXCEPTION 'Необходима авторизация'; END IF;
  IF NEW.reporter_profile_id = c.profile_id OR EXISTS(SELECT 1 FROM public.profiles pr WHERE pr.id = NEW.reporter_profile_id AND pr.auth_user_id = c.auth_user_id) THEN
    RAISE EXCEPTION 'Нельзя пожаловаться на свой профиль';
  END IF;
  IF EXISTS(SELECT 1 FROM public.product_reports r WHERE r.creator_account_id = c.id
      AND r.reporter_profile_id = NEW.reporter_profile_id AND r.target_type = NEW.target_type
      AND r.product_id IS NOT DISTINCT FROM NEW.product_id AND r.status IN ('pending','correction_requested')) THEN
    RAISE EXCEPTION 'Ваша жалоба уже находится на проверке';
  END IF;
  NEW.status := 'pending'; NEW.seller_name := c.display_name;
  RETURN NEW;
END $$;
CREATE TRIGGER moderation_prepare_report BEFORE INSERT ON public.product_reports FOR EACH ROW EXECUTE FUNCTION moderation.prepare_report();
CREATE FUNCTION moderation.restrict_report() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  INSERT INTO moderation.product_state(product_id,creator_account_id,is_published,is_paused,paused_message)
    SELECT id, creator_account_id, is_published, is_paused, paused_message FROM public.products WHERE creator_account_id = NEW.creator_account_id
    ON CONFLICT(product_id) DO NOTHING;
  UPDATE public.creator_accounts SET moderation_restricted = true WHERE id = NEW.creator_account_id;
  UPDATE public.products SET is_published = false, is_paused = true, paused_message = 'Продажи приостановлены на время проверки.' WHERE creator_account_id = NEW.creator_account_id;
  PERFORM moderation.notify(NEW.creator_account_id,NEW.id,'received',
    'На ваш профиль поступила жалоба: «' || NEW.reason || '». На время проверки к профилю применены временные ограничения. Если нарушение не подтвердится, ограничения будут сняты. Если нарушение подтвердится, вам нужно будет устранить его в течение 72 часов. В противном случае аккаунт может быть заблокирован.');
  RETURN NEW;
END $$;
CREATE TRIGGER moderation_restrict_report AFTER INSERT ON public.product_reports FOR EACH ROW EXECUTE FUNCTION moderation.restrict_report();

CREATE FUNCTION moderation.ban_seller(seller uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.creator_accounts; uid uuid; emails text[]; seller_ids uuid[];
BEGIN
  SELECT * INTO STRICT c FROM public.creator_accounts WHERE id = seller FOR UPDATE;
  uid := c.auth_user_id;
  SELECT array_agg(DISTINCT lower(email)) INTO emails FROM (
    SELECT c.email AS email UNION ALL SELECT u.email FROM auth.users u WHERE u.id = uid
  ) x WHERE email IS NOT NULL;
  SELECT array_agg(id) INTO seller_ids FROM public.creator_accounts
    WHERE id = seller OR (uid IS NOT NULL AND auth_user_id = uid) OR lower(email) = ANY(emails);
  INSERT INTO moderation.banned_identifiers(kind,value)
    SELECT 'auth', uid::text WHERE uid IS NOT NULL UNION ALL
    SELECT 'email', unnest(emails) UNION ALL
    SELECT 'login', lower(login) FROM public.creator_accounts WHERE id = ANY(seller_ids)
    ON CONFLICT DO NOTHING;
  INSERT INTO moderation.banned_identifiers(kind,value)
    SELECT 'google', coalesce(i.identity_data->>'sub',to_jsonb(i)->>'provider_id',i.id::text)
    FROM auth.identities i WHERE i.user_id = uid AND i.provider = 'google' ON CONFLICT DO NOTHING;
  INSERT INTO moderation.banned_identifiers(kind,value)
    SELECT 'device', sig.device_hash FROM moderation.session_signals sig JOIN public.creator_sessions s ON s.token = sig.token
      LEFT JOIN public.profiles p ON p.id = s.profile_id
      WHERE sig.device_hash IS NOT NULL AND (p.auth_user_id = uid OR s.creator_name IN (SELECT login FROM public.creator_accounts WHERE id = ANY(seller_ids)))
    UNION ALL
    SELECT 'ip', sig.ip_hash FROM moderation.session_signals sig JOIN public.creator_sessions s ON s.token = sig.token
      LEFT JOIN public.profiles p ON p.id = s.profile_id
      WHERE sig.ip_hash IS NOT NULL AND (p.auth_user_id = uid OR s.creator_name IN (SELECT login FROM public.creator_accounts WHERE id = ANY(seller_ids)))
    ON CONFLICT DO NOTHING;
  -- Pause first, while product guards still allow the moderation transition.
  UPDATE public.creator_accounts SET moderation_restricted = true WHERE id = ANY(seller_ids);
  UPDATE public.products SET is_published = false,is_paused = true WHERE creator_account_id = ANY(seller_ids);
  UPDATE public.creator_accounts SET is_blocked = true WHERE id = ANY(seller_ids);
  DELETE FROM public.creator_sessions s WHERE s.creator_name IN (SELECT login FROM public.creator_accounts WHERE id = ANY(seller_ids))
    OR s.creator_name = 'onboarding:' || uid::text
    OR s.profile_id IN (SELECT id FROM public.profiles WHERE auth_user_id = uid);
  UPDATE auth.users SET banned_until = '2999-12-31'::timestamptz WHERE id = uid;
  DELETE FROM auth.sessions WHERE user_id = uid;
END $$;

CREATE FUNCTION public.moderate_report(p_report_id uuid, p_decision text, p_correction text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE r public.product_reports; seller uuid;
BEGIN
  SELECT creator_account_id INTO seller FROM public.product_reports WHERE id = p_report_id;
  IF seller IS NULL THEN RAISE EXCEPTION 'Продавец удалён; жалоба сохранена в истории'; END IF;
  PERFORM 1 FROM public.creator_accounts WHERE id = seller FOR UPDATE;
  SELECT * INTO STRICT r FROM public.product_reports WHERE id = p_report_id FOR UPDATE;
  IF r.status NOT IN ('pending','correction_requested') THEN RAISE EXCEPTION 'По этой жалобе уже принято решение'; END IF;
  IF p_decision = 'correction_requested' THEN
    IF r.status <> 'pending' THEN RAISE EXCEPTION 'Исправление уже запрошено'; END IF;
    IF nullif(trim(p_correction),'') IS NULL OR length(p_correction) > 4000 THEN RAISE EXCEPTION 'Опишите необходимые исправления (до 4000 символов)'; END IF;
    UPDATE public.product_reports SET status = p_decision, correction_text = trim(p_correction), correction_requested_at = now(),
      correction_deadline = now() + interval '72 hours', reviewed_by = 'moderator' WHERE id = r.id;
    PERFORM moderation.notify(seller,r.id,'correction_requested','Запросить исправление (72 часа): ' || trim(p_correction) || E'\nСрок: ' || to_char(now() + interval '72 hours','DD.MM.YYYY HH24:MI TZ') || '. После исправления напишите в техподдержку.');
  ELSIF p_decision = 'dismissed' THEN
    UPDATE public.product_reports SET status = p_decision,reviewed_at = now(),reviewed_by = 'moderator' WHERE id = r.id;
    IF NOT EXISTS(SELECT 1 FROM public.product_reports WHERE creator_account_id = seller AND status IN ('pending','correction_requested'))
      AND NOT EXISTS(SELECT 1 FROM public.creator_accounts WHERE id = seller AND is_blocked) THEN
      UPDATE public.creator_accounts SET moderation_restricted = false WHERE id = seller;
      UPDATE public.products p SET is_published = s.is_published,is_paused = s.is_paused, paused_message = s.paused_message
        FROM moderation.product_state s WHERE p.id = s.product_id AND s.creator_account_id = seller;
      DELETE FROM moderation.product_state WHERE creator_account_id = seller;
      PERFORM moderation.notify(seller,r.id,'dismissed','Жалоба отклонена. Временные ограничения сняты.');
    ELSE
      PERFORM moderation.notify(seller,r.id,'dismissed','Жалоба отклонена. Ограничения сохраняются по другим открытым жалобам или блокировке аккаунта.');
    END IF;
  ELSIF p_decision = 'blocked' THEN
    PERFORM moderation.ban_seller(seller);
    UPDATE public.product_reports SET status = 'blocked',reviewed_at = now(),reviewed_by = 'moderator'
      WHERE creator_account_id IN (SELECT id FROM public.creator_accounts WHERE is_blocked AND (id = seller OR auth_user_id = (SELECT auth_user_id FROM public.creator_accounts WHERE id = seller)))
      AND status IN ('pending','correction_requested');
    PERFORM moderation.notify(seller,r.id,'blocked','Аккаунт заблокирован по результатам проверки жалобы.');
  ELSE RAISE EXCEPTION 'Недопустимое решение'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.moderate_report(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.moderate_report(uuid,text,text) TO service_role;

-- Run from pg_cron independently of browser sessions. A deadline never bans automatically.
CREATE FUNCTION public.process_moderation_deadlines() RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE r public.product_reports;
BEGIN
  FOR r IN SELECT * FROM public.product_reports WHERE status = 'correction_requested'
    AND correction_deadline <= now() + interval '24 hours'
    AND (reminder_sent_at IS NULL OR (correction_deadline <= now() AND overdue_notified_at IS NULL)) FOR UPDATE SKIP LOCKED
  LOOP
    IF r.correction_deadline > now() AND r.reminder_sent_at IS NULL THEN
      PERFORM moderation.notify(r.creator_account_id,r.id,'reminder','До окончания срока исправления осталось менее 24 часов. ' || r.correction_text);
      UPDATE public.product_reports SET reminder_sent_at = now() WHERE id = r.id;
    ELSIF r.correction_deadline <= now() AND r.overdue_notified_at IS NULL THEN
      PERFORM moderation.notify(NULL,r.id,'overdue','Истекли 72 часа на исправление: ' || coalesce(r.seller_name,'Продавец') || '. Требуется повторная ручная проверка.');
      UPDATE public.product_reports SET overdue_notified_at = now() WHERE id = r.id;
    END IF;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.process_moderation_deadlines() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.process_moderation_deadlines() TO service_role;

CREATE FUNCTION moderation.guard_purchase() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE c public.creator_accounts; buyer_auth uuid;
BEGIN
  SELECT c1.* INTO c FROM public.creator_accounts c1 JOIN public.products p ON p.creator_account_id = c1.id WHERE p.id = NEW.product_id FOR SHARE OF c1;
  IF c.moderation_restricted OR c.is_blocked THEN RAISE EXCEPTION 'Продажи приостановлены на время проверки' USING ERRCODE = '42501'; END IF;
  SELECT auth_user_id INTO buyer_auth FROM public.profiles WHERE id = NEW.buyer_profile_id;
  IF moderation.auth_is_banned(buyer_auth) THEN RAISE EXCEPTION 'Аккаунт покупателя заблокирован' USING ERRCODE = '42501'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER moderation_guard_purchase BEFORE INSERT OR UPDATE ON public.simple_purchases FOR EACH ROW EXECUTE FUNCTION moderation.guard_purchase();
CREATE TRIGGER moderation_guard_trial BEFORE INSERT OR UPDATE ON public.product_trials FOR EACH ROW EXECUTE FUNCTION moderation.guard_purchase();
CREATE TRIGGER moderation_guard_subscription BEFORE INSERT OR UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION moderation.guard_purchase();

CREATE FUNCTION moderation.guard_profile() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF moderation.auth_is_banned(NEW.auth_user_id) THEN RAISE EXCEPTION 'Аккаунт заблокирован' USING ERRCODE = '42501'; END IF;
  IF TG_OP = 'INSERT' AND NEW.type IN ('creator','school') AND EXISTS(SELECT 1 FROM public.creator_accounts WHERE auth_user_id = NEW.auth_user_id AND moderation_restricted) THEN
    RAISE EXCEPTION 'Создание профиля продавца недоступно до завершения проверки' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER moderation_guard_profile BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION moderation.guard_profile();
CREATE FUNCTION moderation.guard_account() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF moderation.auth_is_banned(NEW.auth_user_id,NEW.email) OR EXISTS(SELECT 1 FROM moderation.banned_identifiers WHERE kind = 'login' AND value = lower(NEW.login)) THEN
    RAISE EXCEPTION 'Аккаунт заблокирован' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER moderation_guard_account BEFORE INSERT ON public.creator_accounts FOR EACH ROW EXECUTE FUNCTION moderation.guard_account();
CREATE FUNCTION moderation.guard_auth_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Updating banned_until as part of ban_seller must remain possible.
  IF TG_OP = 'UPDATE' AND NEW.email IS NOT DISTINCT FROM OLD.email THEN RETURN NEW; END IF;
  IF moderation.auth_is_banned(NEW.id,NEW.email) THEN RAISE EXCEPTION 'Аккаунт заблокирован' USING ERRCODE = '42501'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER moderation_guard_auth_user BEFORE INSERT OR UPDATE OF email ON auth.users FOR EACH ROW EXECUTE FUNCTION moderation.guard_auth_user();
CREATE FUNCTION moderation.guard_google_identity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF moderation.auth_is_banned(NEW.user_id) OR (NEW.provider = 'google' AND EXISTS(SELECT 1 FROM moderation.banned_identifiers WHERE kind = 'google'
    AND value = coalesce(NEW.identity_data->>'sub',to_jsonb(NEW)->>'provider_id',NEW.id::text))) THEN
    RAISE EXCEPTION 'Аккаунт заблокирован' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER moderation_guard_google BEFORE INSERT OR UPDATE ON auth.identities FOR EACH ROW EXECUTE FUNCTION moderation.guard_google_identity();
CREATE FUNCTION moderation.guard_session() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid;
BEGIN
  SELECT auth_user_id INTO uid FROM public.profiles WHERE id = NEW.profile_id;
  IF uid IS NULL THEN SELECT auth_user_id INTO uid FROM public.creator_accounts WHERE lower(login) = lower(NEW.creator_name); END IF;
  IF NEW.creator_name LIKE 'onboarding:%' THEN uid := substring(NEW.creator_name FROM 12)::uuid; END IF;
  IF moderation.auth_is_banned(uid) OR EXISTS(SELECT 1 FROM public.creator_accounts WHERE lower(login) = lower(NEW.creator_name) AND is_blocked) THEN
    RAISE EXCEPTION 'Аккаунт заблокирован' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER moderation_guard_session BEFORE INSERT OR UPDATE ON public.creator_sessions FOR EACH ROW EXECUTE FUNCTION moderation.guard_session();

CREATE FUNCTION public.check_moderation_signals(p_token text, p_device_hash text, p_ip_hash text) RETURNS boolean LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM moderation.banned_identifiers WHERE (kind = 'device' AND value = p_device_hash) OR (kind = 'ip' AND value = p_ip_hash)) THEN RETURN false; END IF;
  IF EXISTS(SELECT 1 FROM public.creator_sessions WHERE token = p_token AND expires_at > now()) THEN
    INSERT INTO moderation.session_signals(token,device_hash,ip_hash) VALUES(p_token,p_device_hash,p_ip_hash)
      ON CONFLICT(token) DO UPDATE SET device_hash = coalesce(excluded.device_hash,moderation.session_signals.device_hash), ip_hash = coalesce(excluded.ip_hash,moderation.session_signals.ip_hash);
  END IF;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.check_moderation_signals(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.check_moderation_signals(text,text,text) TO service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA moderation FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA moderation TO service_role;

-- Bring legacy pending reports under the same restrictions without erasing their history.
INSERT INTO moderation.product_state SELECT p.id,p.creator_account_id,p.is_published,p.is_paused,p.paused_message FROM public.products p
  WHERE EXISTS(SELECT 1 FROM public.product_reports r WHERE r.creator_account_id = p.creator_account_id AND r.status = 'pending');
UPDATE public.creator_accounts SET moderation_restricted = true WHERE EXISTS(SELECT 1 FROM public.product_reports r WHERE r.creator_account_id = creator_accounts.id AND r.status = 'pending');
UPDATE public.products SET is_published = false,is_paused = true WHERE creator_account_id IN (SELECT id FROM public.creator_accounts WHERE moderation_restricted AND NOT is_blocked);

-- Install pg_cron when available; the deployment runbook covers hosted enablement.
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') OR
     (EXISTS(SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') AND coalesce(current_setting('shared_preload_libraries',true),'') LIKE '%pg_cron%') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    PERFORM cron.schedule('moderation-deadlines','*/5 * * * *','SELECT public.process_moderation_deadlines()');
  ELSE RAISE NOTICE 'Enable pg_cron and schedule process_moderation_deadlines every five minutes before rollout.'; END IF;
END $$;
