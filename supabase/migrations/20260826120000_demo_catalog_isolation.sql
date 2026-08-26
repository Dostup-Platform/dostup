-- Development-only demo catalogue isolation.
-- is_demo rows are excluded from public_products / production search unconditionally.
-- dev_products + p_include_demo on RPCs for local Vite dev (import.meta.env.DEV).
-- Idempotent.

-- ---------------------------------------------------------------------------
-- 1. is_demo flag on profiles and products
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS profiles_is_demo_idx
  ON public.profiles (is_demo)
  WHERE is_demo = true;

CREATE INDEX IF NOT EXISTS products_is_demo_idx
  ON public.products (is_demo)
  WHERE is_demo = true;

-- ---------------------------------------------------------------------------
-- 2. Public catalog view — never includes demo rows
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
  p.has_schedule,
  p.created_at,
  p.category_id,
  c.slug AS category_slug,
  c.name_ru AS category_name_ru,
  c.name_kk AS category_name_kk,
  c.emoji AS category_emoji,
  p.subcategory_id,
  sc.slug AS subcategory_slug,
  sc.name_ru AS subcategory_name_ru,
  sc.name_kk AS subcategory_name_kk,
  p.lesson_format,
  p.event_starts_at,
  p.capacity,
  p.billing_period,
  pr.handle AS seller_handle,
  pr.display_name AS seller_display_name,
  pr.avatar_url AS seller_avatar_url,
  pr.type AS seller_type
FROM public.products p
JOIN public.categories c ON c.id = p.category_id
JOIN public.subcategories sc ON sc.id = p.subcategory_id
JOIN public.creator_accounts ca ON ca.id = p.creator_account_id
JOIN public.profiles pr ON pr.id = ca.profile_id
WHERE p.is_active = true
  AND p.is_paused = false
  AND COALESCE(ca.is_blocked, false) = false
  AND p.is_demo = false
  AND pr.is_demo = false
  AND (
    c.slug <> 'events'
    OR (p.event_starts_at IS NOT NULL AND p.event_starts_at > now())
  );

REVOKE ALL ON public.public_products FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.public_products TO anon, authenticated;
GRANT ALL ON public.public_products TO service_role;

COMMENT ON VIEW public.public_products IS
  'Production marketplace catalog. Omits demo rows, kaspi fields, and past events.';

-- ---------------------------------------------------------------------------
-- 3. Dev catalog view — includes demo rows and past events
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.dev_products;

CREATE VIEW public.dev_products
WITH (security_invoker = false, security_barrier = true) AS
SELECT
  p.id,
  p.slug,
  p.title,
  p.headline,
  p.image_url,
  p.price,
  p.has_schedule,
  p.created_at,
  p.category_id,
  c.slug AS category_slug,
  c.name_ru AS category_name_ru,
  c.name_kk AS category_name_kk,
  c.emoji AS category_emoji,
  p.subcategory_id,
  sc.slug AS subcategory_slug,
  sc.name_ru AS subcategory_name_ru,
  sc.name_kk AS subcategory_name_kk,
  p.lesson_format,
  p.event_starts_at,
  p.capacity,
  p.billing_period,
  pr.handle AS seller_handle,
  pr.display_name AS seller_display_name,
  pr.avatar_url AS seller_avatar_url,
  pr.type AS seller_type
FROM public.products p
JOIN public.categories c ON c.id = p.category_id
JOIN public.subcategories sc ON sc.id = p.subcategory_id
JOIN public.creator_accounts ca ON ca.id = p.creator_account_id
JOIN public.profiles pr ON pr.id = ca.profile_id
WHERE p.is_active = true
  AND p.is_paused = false
  AND COALESCE(ca.is_blocked, false) = false;

REVOKE ALL ON public.dev_products FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.dev_products TO anon, authenticated;
GRANT ALL ON public.dev_products TO service_role;

COMMENT ON VIEW public.dev_products IS
  'Local-dev catalog view. Includes demo rows and past events. Not for production UI.';

-- ---------------------------------------------------------------------------
-- 4. search_catalog — p_include_demo selects dev_products source
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.search_catalog(
  text, text, text, text, text, numeric, numeric, text, integer, integer
);

CREATE OR REPLACE FUNCTION public.search_catalog(
  q text DEFAULT NULL,
  p_category_slug text DEFAULT NULL,
  p_subcategory_slug text DEFAULT NULL,
  p_lesson_format text DEFAULT NULL,
  p_billing_period text DEFAULT NULL,
  p_min numeric DEFAULT NULL,
  p_max numeric DEFAULT NULL,
  p_sort text DEFAULT 'newest',
  p_limit int DEFAULT 24,
  p_offset int DEFAULT 0,
  p_include_demo boolean DEFAULT false
)
RETURNS TABLE (
  id uuid,
  slug text,
  title text,
  headline text,
  image_url text,
  price numeric,
  has_schedule boolean,
  created_at timestamptz,
  category_id uuid,
  category_slug text,
  category_name_ru text,
  category_name_kk text,
  category_emoji text,
  subcategory_id uuid,
  subcategory_slug text,
  subcategory_name_ru text,
  subcategory_name_kk text,
  lesson_format text,
  event_starts_at timestamptz,
  capacity int,
  billing_period text,
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
  cat_slug text;
  sub_slug text;
  lesson_fmt text;
  billing text;
  sort_key text;
  lim int;
  off int;
BEGIN
  q_norm := public.immutable_unaccent(lower(btrim(coalesce(q, ''))));
  cat_slug := nullif(btrim(coalesce(p_category_slug, '')), '');
  sub_slug := nullif(btrim(coalesce(p_subcategory_slug, '')), '');
  lesson_fmt := CASE
    WHEN p_lesson_format IN ('individual', 'group') THEN p_lesson_format
    ELSE NULL
  END;
  billing := CASE
    WHEN p_billing_period IN ('month', 'quarter', 'year') THEN p_billing_period
    ELSE NULL
  END;
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

  IF coalesce(p_include_demo, false) THEN
    RETURN QUERY
    SELECT
      dp.id,
      dp.slug,
      dp.title,
      dp.headline,
      dp.image_url,
      dp.price,
      dp.has_schedule,
      dp.created_at,
      dp.category_id,
      dp.category_slug,
      dp.category_name_ru,
      dp.category_name_kk,
      dp.category_emoji,
      dp.subcategory_id,
      dp.subcategory_slug,
      dp.subcategory_name_ru,
      dp.subcategory_name_kk,
      dp.lesson_format,
      dp.event_starts_at,
      dp.capacity,
      dp.billing_period,
      dp.seller_handle,
      dp.seller_display_name,
      dp.seller_avatar_url,
      dp.seller_type
    FROM public.dev_products dp
    WHERE (cat_slug IS NULL OR dp.category_slug = cat_slug)
      AND (sub_slug IS NULL OR dp.subcategory_slug = sub_slug)
      AND (lesson_fmt IS NULL OR dp.lesson_format = lesson_fmt)
      AND (billing IS NULL OR dp.billing_period = billing)
      AND (p_min IS NULL OR dp.price >= p_min)
      AND (p_max IS NULL OR dp.price <= p_max)
      AND (
        q_norm = ''
        OR public.immutable_unaccent(lower(dp.title)) ILIKE '%' || q_norm || '%'
        OR public.immutable_unaccent(lower(coalesce(dp.headline, ''))) ILIKE '%' || q_norm || '%'
        OR public.immutable_unaccent(lower(coalesce(dp.seller_display_name, ''))) ILIKE '%' || q_norm || '%'
        OR similarity(public.immutable_unaccent(lower(dp.title)), q_norm) >= 0.15
        OR similarity(public.immutable_unaccent(lower(coalesce(dp.headline, ''))), q_norm) >= 0.15
        OR similarity(public.immutable_unaccent(lower(coalesce(dp.seller_display_name, ''))), q_norm) >= 0.15
      )
    ORDER BY
      CASE WHEN sort_key = 'newest' THEN dp.created_at END DESC NULLS LAST,
      CASE WHEN sort_key = 'price_asc' THEN dp.price END ASC NULLS LAST,
      CASE WHEN sort_key = 'price_desc' THEN dp.price END DESC NULLS LAST,
      dp.id ASC
    LIMIT lim
    OFFSET off;
  ELSE
    RETURN QUERY
    SELECT
      pp.id,
      pp.slug,
      pp.title,
      pp.headline,
      pp.image_url,
      pp.price,
      pp.has_schedule,
      pp.created_at,
      pp.category_id,
      pp.category_slug,
      pp.category_name_ru,
      pp.category_name_kk,
      pp.category_emoji,
      pp.subcategory_id,
      pp.subcategory_slug,
      pp.subcategory_name_ru,
      pp.subcategory_name_kk,
      pp.lesson_format,
      pp.event_starts_at,
      pp.capacity,
      pp.billing_period,
      pp.seller_handle,
      pp.seller_display_name,
      pp.seller_avatar_url,
      pp.seller_type
    FROM public.public_products pp
    WHERE (cat_slug IS NULL OR pp.category_slug = cat_slug)
      AND (sub_slug IS NULL OR pp.subcategory_slug = sub_slug)
      AND (lesson_fmt IS NULL OR pp.lesson_format = lesson_fmt)
      AND (billing IS NULL OR pp.billing_period = billing)
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
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.search_catalog(
  text, text, text, text, text, numeric, numeric, text, integer, integer, boolean
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_catalog(
  text, text, text, text, text, numeric, numeric, text, integer, integer, boolean
) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. get_seller_storefront — p_include_demo
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_seller_storefront(text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.get_seller_storefront(
  p_handle text,
  p_category_slug text DEFAULT NULL,
  p_subcategory_slug text DEFAULT NULL,
  p_lesson_format text DEFAULT NULL,
  p_billing_period text DEFAULT NULL,
  p_include_demo boolean DEFAULT false
)
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
  cat_slug text := nullif(btrim(coalesce(p_category_slug, '')), '');
  sub_slug text := nullif(btrim(coalesce(p_subcategory_slug, '')), '');
  lesson_fmt text := CASE
    WHEN p_lesson_format IN ('individual', 'group') THEN p_lesson_format
    ELSE NULL
  END;
  billing text := CASE
    WHEN p_billing_period IN ('month', 'quarter', 'year') THEN p_billing_period
    ELSE NULL
  END;
BEGIN
  IF h = '' OR public.is_reserved_handle(h) THEN
    RETURN;
  END IF;

  IF coalesce(p_include_demo, false) THEN
    RETURN QUERY
    SELECT
      pr.handle,
      pr.display_name,
      pr.avatar_url,
      pr.type,
      pr.bio,
      coalesce((
        SELECT jsonb_agg(to_jsonb(dp) ORDER BY dp.created_at DESC, dp.id)
        FROM public.dev_products dp
        WHERE dp.seller_handle = pr.handle
          AND (cat_slug IS NULL OR dp.category_slug = cat_slug)
          AND (sub_slug IS NULL OR dp.subcategory_slug = sub_slug)
          AND (lesson_fmt IS NULL OR dp.lesson_format = lesson_fmt)
          AND (billing IS NULL OR dp.billing_period = billing)
      ), '[]'::jsonb) AS products
    FROM public.profiles pr
    WHERE pr.handle = h
      AND pr.type IN ('creator', 'school');
  ELSE
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
          AND (cat_slug IS NULL OR pp.category_slug = cat_slug)
          AND (sub_slug IS NULL OR pp.subcategory_slug = sub_slug)
          AND (lesson_fmt IS NULL OR pp.lesson_format = lesson_fmt)
          AND (billing IS NULL OR pp.billing_period = billing)
      ), '[]'::jsonb) AS products
    FROM public.profiles pr
    WHERE pr.handle = h
      AND pr.type IN ('creator', 'school')
      AND pr.is_demo = false;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.get_seller_storefront(
  text, text, text, text, text, boolean
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_seller_storefront(
  text, text, text, text, text, boolean
) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. get_catalog_taxonomy — p_include_demo
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_catalog_taxonomy();

CREATE OR REPLACE FUNCTION public.get_catalog_taxonomy(p_include_demo boolean DEFAULT false)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'slug', c.slug,
        'name_ru', c.name_ru,
        'name_kk', c.name_kk,
        'emoji', c.emoji,
        'sort_order', c.sort_order,
        'product_count', coalesce(cat_counts.product_count, 0),
        'subcategories', coalesce(subcats.items, '[]'::jsonb)
      )
      ORDER BY c.sort_order, c.slug
    ),
    '[]'::jsonb
  )
  FROM public.categories c
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS product_count
    FROM (
      SELECT dp.category_id
      FROM public.dev_products dp
      WHERE coalesce(p_include_demo, false)
        AND dp.category_id = c.id
      UNION ALL
      SELECT pp.category_id
      FROM public.public_products pp
      WHERE NOT coalesce(p_include_demo, false)
        AND pp.category_id = c.id
    ) rows
  ) cat_counts ON true
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', sc.id,
        'slug', sc.slug,
        'name_ru', sc.name_ru,
        'name_kk', sc.name_kk,
        'sort_order', sc.sort_order,
        'product_count', coalesce(sub_counts.product_count, 0)
      )
      ORDER BY sc.sort_order, sc.slug
    ) AS items
    FROM public.subcategories sc
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS product_count
      FROM (
        SELECT dp.subcategory_id
        FROM public.dev_products dp
        WHERE coalesce(p_include_demo, false)
          AND dp.subcategory_id = sc.id
        UNION ALL
        SELECT pp.subcategory_id
        FROM public.public_products pp
        WHERE NOT coalesce(p_include_demo, false)
          AND pp.subcategory_id = sc.id
      ) rows
    ) sub_counts ON true
    WHERE sc.category_id = c.id
  ) subcats ON true;
$$;

REVOKE ALL ON FUNCTION public.get_catalog_taxonomy(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_catalog_taxonomy(boolean)
  TO anon, authenticated, service_role;
