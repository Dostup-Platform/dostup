-- Demo rows belong in the public catalogue.
-- public_products / search_catalog include is_demo with no special handling.
-- Drops dev_products and p_include_demo. Keeps the is_demo column for seed:demo:clean.

DROP FUNCTION IF EXISTS public.search_catalog(
  text, text, text, text, text, numeric, numeric, text, integer, integer, boolean
);
DROP FUNCTION IF EXISTS public.search_catalog(
  text, text, text, text, text, numeric, numeric, text, integer, integer
);
DROP FUNCTION IF EXISTS public.get_seller_storefront(text, text, text, text, text, boolean);
DROP FUNCTION IF EXISTS public.get_seller_storefront(text, text, text, text, text);
DROP FUNCTION IF EXISTS public.get_catalog_taxonomy(boolean);
DROP FUNCTION IF EXISTS public.get_catalog_taxonomy();
DROP VIEW IF EXISTS public.dev_products;

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
  AND (
    c.slug <> 'events'
    OR (p.event_starts_at IS NOT NULL AND p.event_starts_at > now())
  );

REVOKE ALL ON public.public_products FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.public_products TO anon, authenticated;
GRANT ALL ON public.public_products TO service_role;

COMMENT ON VIEW public.public_products IS
  'Marketplace catalog. Includes is_demo rows. Omits kaspi fields and past events.';

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
  p_offset int DEFAULT 0
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
END;
$$;

REVOKE ALL ON FUNCTION public.search_catalog(
  text, text, text, text, text, numeric, numeric, text, integer, integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_catalog(
  text, text, text, text, text, numeric, numeric, text, integer, integer
) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_seller_storefront(
  p_handle text,
  p_category_slug text DEFAULT NULL,
  p_subcategory_slug text DEFAULT NULL,
  p_lesson_format text DEFAULT NULL,
  p_billing_period text DEFAULT NULL
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
    AND pr.type IN ('creator', 'school');
END;
$$;

REVOKE ALL ON FUNCTION public.get_seller_storefront(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_seller_storefront(text, text, text, text, text)
  TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_catalog_taxonomy()
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
    FROM public.public_products pp
    WHERE pp.category_id = c.id
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
      FROM public.public_products pp
      WHERE pp.subcategory_id = sc.id
    ) sub_counts ON true
    WHERE sc.category_id = c.id
  ) subcats ON true;
$$;

REVOKE ALL ON FUNCTION public.get_catalog_taxonomy() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_catalog_taxonomy()
  TO anon, authenticated, service_role;

UPDATE public.products
SET image_url = NULL
WHERE is_demo = true
  AND image_url LIKE '/demo/cover-%';

UPDATE public.products
SET event_starts_at = now() + interval '14 days'
WHERE slug = 'demo-olympiad-masterclass'
  AND is_demo = true;
