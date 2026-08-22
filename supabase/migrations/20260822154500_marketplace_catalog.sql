-- Marketplace catalog: product format/subject, public seller identity,
-- public_products view, search RPCs, avatars bucket.
-- Idempotent. Does not insert demo products.
-- kaspi_link / kaspi_phone stay off public views and RPCs.

-- ---------------------------------------------------------------------------
-- Extensions used for typo-tolerant search
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- 1. Product classification
-- ---------------------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS format text;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS subject text;

UPDATE public.products p
SET format = CASE
  WHEN COALESCE(p.has_schedule, false) = false THEN 'recorded'
  WHEN EXISTS (
    SELECT 1
    FROM public.schedules s
    LEFT JOIN public.time_slots ts ON ts.schedule_id = s.id
    WHERE s.product_id = p.id
      AND (
        s.event_type::text = 'group'
        OR COALESCE(ts.max_participants, s.max_participants, 1) > 1
      )
  ) THEN 'group'
  ELSE 'individual'
END
WHERE p.format IS NULL
   OR p.format NOT IN ('recorded', 'individual', 'group');

ALTER TABLE public.products
  ALTER COLUMN format SET DEFAULT 'recorded';

UPDATE public.products
SET format = 'recorded'
WHERE format IS NULL;

ALTER TABLE public.products
  ALTER COLUMN format SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_format_check'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_format_check
      CHECK (format IN ('recorded', 'individual', 'group'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS products_format_idx
  ON public.products (format);

CREATE INDEX IF NOT EXISTS products_subject_idx
  ON public.products (subject);

CREATE INDEX IF NOT EXISTS products_public_browse_idx
  ON public.products (format, subject, price)
  WHERE is_active = true AND is_paused = false;

-- ---------------------------------------------------------------------------
-- 2. Seller identity on profiles
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS handle text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio text;

CREATE OR REPLACE FUNCTION public.immutable_unaccent(txt text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
SET search_path = extensions, pg_temp
AS $$
  SELECT unaccent(txt)
$$;

CREATE OR REPLACE FUNCTION public.slugify_handle_source(src text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  s text := lower(coalesce(src, ''));
BEGIN
  s := replace(s, 'щ', 'shch');
  s := replace(s, 'ш', 'sh');
  s := replace(s, 'ч', 'ch');
  s := replace(s, 'ц', 'ts');
  s := replace(s, 'ю', 'yu');
  s := replace(s, 'я', 'ya');
  s := replace(s, 'ё', 'yo');
  s := replace(s, 'ж', 'zh');
  s := replace(s, 'х', 'kh');
  s := replace(s, 'ъ', '');
  s := replace(s, 'ь', '');
  s := replace(s, 'а', 'a');
  s := replace(s, 'б', 'b');
  s := replace(s, 'в', 'v');
  s := replace(s, 'г', 'g');
  s := replace(s, 'д', 'd');
  s := replace(s, 'е', 'e');
  s := replace(s, 'и', 'i');
  s := replace(s, 'й', 'y');
  s := replace(s, 'к', 'k');
  s := replace(s, 'л', 'l');
  s := replace(s, 'м', 'm');
  s := replace(s, 'н', 'n');
  s := replace(s, 'о', 'o');
  s := replace(s, 'п', 'p');
  s := replace(s, 'р', 'r');
  s := replace(s, 'с', 's');
  s := replace(s, 'т', 't');
  s := replace(s, 'у', 'u');
  s := replace(s, 'ф', 'f');
  s := replace(s, 'ы', 'y');
  s := replace(s, 'э', 'e');
  s := replace(s, 'ә', 'a');
  s := replace(s, 'ғ', 'g');
  s := replace(s, 'қ', 'q');
  s := replace(s, 'ң', 'n');
  s := replace(s, 'ө', 'o');
  s := replace(s, 'ұ', 'u');
  s := replace(s, 'ү', 'u');
  s := replace(s, 'һ', 'h');
  s := replace(s, 'і', 'i');
  s := public.immutable_unaccent(s);
  s := regexp_replace(s, '[^a-z0-9]+', '-', 'g');
  s := regexp_replace(s, '-+', '-', 'g');
  s := trim(both '-' from s);
  RETURN s;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_reserved_handle(p_handle text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT lower(coalesce(p_handle, '')) IN (
    'admin', 'api', 'auth', 'login', 'dashboard', 'creator', 'school', 's', 'p'
  )
$$;

CREATE OR REPLACE FUNCTION public.allocate_profile_handle(p_display_name text, p_id uuid)
RETURNS text
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  base text;
  candidate text;
  n int := 2;
  suffix text;
BEGIN
  base := public.slugify_handle_source(p_display_name);
  IF length(base) < 3 OR public.is_reserved_handle(base) THEN
    base := 'user-' || substr(replace(p_id::text, '-', ''), 1, 8);
  END IF;
  base := left(base, 30);
  candidate := base;

  LOOP
    IF length(candidate) >= 3
       AND NOT public.is_reserved_handle(candidate)
       AND NOT EXISTS (
         SELECT 1
         FROM public.profiles pr
         WHERE pr.handle = candidate
           AND pr.id IS DISTINCT FROM p_id
       )
    THEN
      RETURN candidate;
    END IF;
    suffix := n::text;
    candidate := left(base, greatest(3, 30 - length(suffix))) || suffix;
    n := n + 1;
    IF n > 10000 THEN
      RETURN left('u' || replace(p_id::text, '-', ''), 30);
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.profiles_assign_handle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.handle IS NULL OR btrim(NEW.handle) = '' THEN
    NEW.handle := public.allocate_profile_handle(NEW.display_name, NEW.id);
  ELSE
    NEW.handle := lower(btrim(NEW.handle));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_assign_handle ON public.profiles;
CREATE TRIGGER profiles_assign_handle
  BEFORE INSERT OR UPDATE OF handle, display_name
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_assign_handle();

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id, display_name
    FROM public.profiles
    WHERE handle IS NULL OR btrim(handle) = ''
    ORDER BY created_at, id
  LOOP
    UPDATE public.profiles
    SET handle = public.allocate_profile_handle(r.display_name, r.id)
    WHERE id = r.id;
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_handle_format_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_handle_format_check
      CHECK (
        handle ~ '^[a-z0-9-]{3,30}$'
        AND handle NOT IN ('admin', 'api', 'auth', 'login', 'dashboard', 'creator', 'school', 's', 'p')
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_handle_key
  ON public.profiles (handle);

ALTER TABLE public.profiles
  ALTER COLUMN handle SET NOT NULL;

REVOKE ALL ON FUNCTION public.slugify_handle_source(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_reserved_handle(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.allocate_profile_handle(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.profiles_assign_handle() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.immutable_unaccent(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.immutable_unaccent(text) TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Lock products base table (column grants from the invoker-view era)
--    Public access goes through views / RPCs only.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  col text;
BEGIN
  FOR col IN
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
  LOOP
    EXECUTE format(
      'REVOKE ALL (%I) ON public.products FROM anon, authenticated, PUBLIC',
      col
    );
  END LOOP;
END $$;

REVOKE ALL ON TABLE public.products FROM anon, authenticated, PUBLIC;
GRANT ALL ON TABLE public.products TO service_role;

-- Recreate products_catalog as an owner view so it still works after the revoke.
-- Does not expose kaspi_link / kaspi_phone.
DROP VIEW IF EXISTS public.products_catalog;
CREATE VIEW public.products_catalog
WITH (security_invoker = false, security_barrier = true) AS
SELECT
  id,
  created_at,
  updated_at,
  creator_id,
  creator_account_id,
  title,
  headline,
  description,
  price,
  image_url,
  video_url,
  has_schedule,
  is_active,
  is_paused,
  paused_message,
  slug,
  telegram_link,
  group_link_label,
  faq,
  access_duration_days,
  format,
  subject
FROM public.products
WHERE is_active = true
  AND is_paused = false;

REVOKE ALL ON public.products_catalog FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.products_catalog TO anon, authenticated;
GRANT ALL ON public.products_catalog TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Public catalog view — safe columns + seller identity
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.public_products;
CREATE VIEW public.public_products
WITH (security_invoker = false, security_barrier = true) AS
SELECT
  p.id,
  p.slug,
  p.title,
  p.headline,
  p.image_url,
  p.price,
  p.format,
  p.subject,
  p.has_schedule,
  p.created_at,
  pr.handle AS seller_handle,
  pr.display_name AS seller_display_name,
  pr.avatar_url AS seller_avatar_url,
  pr.type AS seller_type
FROM public.products p
JOIN public.creator_accounts ca ON ca.id = p.creator_account_id
JOIN public.profiles pr ON pr.id = ca.profile_id
WHERE p.is_active = true
  AND p.is_paused = false
  AND COALESCE(ca.is_blocked, false) = false;

REVOKE ALL ON public.public_products FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.public_products TO anon, authenticated;
GRANT ALL ON public.public_products TO service_role;

COMMENT ON VIEW public.public_products IS
  'Public marketplace catalog. Omits kaspi_link, kaspi_phone, and other checkout-only fields.';

-- Trigram indexes for typo-tolerant search (Russian / Kazakh on original script,
-- unaccent for Latin diacritics).
CREATE INDEX IF NOT EXISTS products_title_trgm_idx
  ON public.products
  USING gin (public.immutable_unaccent(lower(title)) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS products_headline_trgm_idx
  ON public.products
  USING gin (public.immutable_unaccent(lower(coalesce(headline, ''))) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS profiles_display_name_trgm_idx
  ON public.profiles
  USING gin (public.immutable_unaccent(lower(coalesce(display_name, ''))) gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- 5. Search RPCs — SECURITY DEFINER, read only public_products
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_catalog(
  q text DEFAULT NULL,
  p_format text DEFAULT NULL,
  p_subject text DEFAULT NULL,
  p_min numeric DEFAULT NULL,
  p_max numeric DEFAULT NULL,
  p_sort text DEFAULT 'newest',
  p_limit int DEFAULT 24,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  slug text,
  title text,
  headline text,
  image_url text,
  price numeric,
  format text,
  subject text,
  has_schedule boolean,
  created_at timestamptz,
  seller_handle text,
  seller_display_name text,
  seller_avatar_url text,
  seller_type text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  q_norm text;
  fmt text;
  subj text;
  sort_key text;
  lim int;
  off int;
BEGIN
  q_norm := public.immutable_unaccent(lower(btrim(coalesce(q, ''))));
  fmt := CASE
    WHEN p_format IN ('recorded', 'individual', 'group') THEN p_format
    ELSE NULL
  END;
  subj := nullif(btrim(coalesce(p_subject, '')), '');
  sort_key := CASE lower(coalesce(p_sort, 'newest'))
    WHEN 'price_asc' THEN 'price_asc'
    WHEN 'price_ascending' THEN 'price_asc'
    WHEN 'price' THEN 'price_asc'
    WHEN 'price_desc' THEN 'price_desc'
    WHEN 'price_descending' THEN 'price_desc'
    WHEN 'newest' THEN 'newest'
    ELSE 'newest'
  END;
  lim := least(greatest(coalesce(p_limit, 24), 1), 48);
  off := least(greatest(coalesce(p_offset, 0), 0), 10000);

  RETURN QUERY
  SELECT
    pp.id,
    pp.slug,
    pp.title,
    pp.headline,
    pp.image_url,
    pp.price,
    pp.format,
    pp.subject,
    pp.has_schedule,
    pp.created_at,
    pp.seller_handle,
    pp.seller_display_name,
    pp.seller_avatar_url,
    pp.seller_type
  FROM public.public_products pp
  WHERE (fmt IS NULL OR pp.format = fmt)
    AND (subj IS NULL OR pp.subject = subj)
    AND (p_min IS NULL OR pp.price >= p_min)
    AND (p_max IS NULL OR pp.price <= p_max)
    AND (
      q_norm = ''
      OR public.immutable_unaccent(lower(pp.title)) ILIKE '%' || q_norm || '%'
      OR public.immutable_unaccent(lower(coalesce(pp.headline, ''))) ILIKE '%' || q_norm || '%'
      OR public.immutable_unaccent(lower(coalesce(pp.seller_display_name, ''))) ILIKE '%' || q_norm || '%'
      OR similarity(public.immutable_unaccent(lower(pp.title)), q_norm) >= 0.15
      OR similarity(public.immutable_unaccent(lower(coalesce(pp.headline, ''))), q_norm) >= 0.15
      OR similarity(public.immutable_unaccent(lower(coalesce(pp.seller_display_name, ''))), q_norm) >= 0.15
    )
  ORDER BY
    CASE WHEN sort_key = 'newest' THEN pp.created_at END DESC NULLS LAST,
    CASE WHEN sort_key = 'price_asc' THEN pp.price END ASC NULLS LAST,
    CASE WHEN sort_key = 'price_desc' THEN pp.price END DESC NULLS LAST,
    pp.id ASC
  LIMIT lim
  OFFSET off;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_seller_storefront(p_handle text)
RETURNS TABLE (
  handle text,
  display_name text,
  avatar_url text,
  type text,
  bio text,
  products jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  h text := lower(btrim(coalesce(p_handle, '')));
BEGIN
  IF h = '' OR public.is_reserved_handle(h) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    pr.handle,
    pr.display_name,
    pr.avatar_url,
    pr.type,
    pr.bio,
    coalesce((
      SELECT jsonb_agg(to_jsonb(pp) ORDER BY pp.created_at DESC, pp.id)
      FROM public.public_products pp
      WHERE pp.seller_handle = pr.handle
    ), '[]'::jsonb) AS products
  FROM public.profiles pr
  WHERE pr.handle = h
    AND pr.type IN ('creator', 'school');
END;
$$;

REVOKE ALL ON FUNCTION public.search_catalog(text, text, text, numeric, numeric, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_catalog(text, text, text, numeric, numeric, text, integer, integer)
  TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_seller_storefront(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_seller_storefront(text)
  TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Public avatars bucket — writes go through presigned-upload (service_role)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS avatars_public_read ON storage.objects;
CREATE POLICY avatars_public_read
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'avatars');
