-- Product reviews: buyers who completed a purchase can rate 1-5 stars + leave
-- a comment. Adds avg_rating/review_count to public_products and
-- search_catalog, plus a p_only_new filter and a "rating" sort used by the
-- homepage "Новые продукты" / "Высокий рейтинг" rails.

CREATE TABLE IF NOT EXISTS public.product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  buyer_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, buyer_profile_id)
);

CREATE INDEX IF NOT EXISTS product_reviews_product_idx
  ON public.product_reviews (product_id);

-- Locked down like other base tables: writes only via the manage-reviews
-- edge function (service_role), which verifies purchase ownership first.
REVOKE ALL ON TABLE public.product_reviews FROM anon, authenticated, PUBLIC;
GRANT ALL ON TABLE public.product_reviews TO service_role;

-- Public read: reviewer identity limited to display name/avatar (same
-- exposure level as seller identity elsewhere in the public catalog).
DROP VIEW IF EXISTS public.product_reviews_public;
CREATE VIEW public.product_reviews_public
WITH (security_invoker = false, security_barrier = true) AS
SELECT
  rv.id,
  rv.product_id,
  rv.rating,
  rv.comment,
  rv.created_at,
  pr.display_name AS buyer_display_name,
  pr.avatar_url AS buyer_avatar_url
FROM public.product_reviews rv
JOIN public.profiles pr ON pr.id = rv.buyer_profile_id;

REVOKE ALL ON public.product_reviews_public FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.product_reviews_public TO anon, authenticated;
GRANT ALL ON public.product_reviews_public TO service_role;

-- ---------------------------------------------------------------------------
-- public_products: add rating aggregates
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
  pr.type AS seller_type,
  coalesce(rat.avg_rating, 0)::numeric(3,2) AS avg_rating,
  coalesce(rat.review_count, 0)::int AS review_count
FROM public.products p
JOIN public.categories c ON c.id = p.category_id
JOIN public.subcategories sc ON sc.id = p.subcategory_id
JOIN public.creator_accounts ca ON ca.id = p.creator_account_id
JOIN public.profiles pr ON pr.id = ca.profile_id
LEFT JOIN LATERAL (
  SELECT avg(rv.rating)::numeric AS avg_rating, count(*)::int AS review_count
  FROM public.product_reviews rv
  WHERE rv.product_id = p.id
) rat ON true
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
  'Marketplace catalog. Includes is_demo rows and rating aggregates. Omits kaspi fields and past events.';

-- ---------------------------------------------------------------------------
-- search_catalog: add p_only_new filter, "rating" sort, and rating columns
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
  p_only_new boolean DEFAULT false
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
  seller_type text,
  avg_rating numeric,
  review_count int
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
  only_new boolean;
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
    WHEN 'rating' THEN 'rating'
    WHEN 'newest' THEN 'newest'
    ELSE 'newest'
  END;
  lim := least(greatest(coalesce(p_limit, 24), 1), 48);
  off := least(greatest(coalesce(p_offset, 0), 0), 10000);
  only_new := coalesce(p_only_new, false);

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
    pp.seller_type,
    pp.avg_rating,
    pp.review_count
  FROM public.public_products pp
  WHERE (cat_slug IS NULL OR pp.category_slug = cat_slug)
    AND (sub_slug IS NULL OR pp.subcategory_slug = sub_slug)
    AND (lesson_fmt IS NULL OR pp.lesson_format = lesson_fmt)
    AND (billing IS NULL OR pp.billing_period = billing)
    AND (p_min IS NULL OR pp.price >= p_min)
    AND (p_max IS NULL OR pp.price <= p_max)
    AND (NOT only_new OR pp.created_at >= now() - interval '30 days')
    AND (sort_key <> 'rating' OR (pp.avg_rating >= 4.5 AND pp.review_count >= 3))
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
    CASE WHEN sort_key = 'rating' THEN pp.avg_rating END DESC NULLS LAST,
    CASE WHEN sort_key = 'rating' THEN pp.review_count END DESC NULLS LAST,
    pp.id ASC
  LIMIT lim
  OFFSET off;
END;
$$;

REVOKE ALL ON FUNCTION public.search_catalog(
  text, text, text, text, text, numeric, numeric, text, integer, integer, boolean
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_catalog(
  text, text, text, text, text, numeric, numeric, text, integer, integer, boolean
) TO anon, authenticated, service_role;

-- get_seller_storefront aggregates rows with to_jsonb(pp) from public_products,
-- so it picks up avg_rating/review_count automatically — no change needed.
