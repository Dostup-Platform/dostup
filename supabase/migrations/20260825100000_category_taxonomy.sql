-- Two-level product taxonomy: categories + subcategories.
-- Replaces products.format / products.subject with category_id, subcategory_id,
-- lesson_format (online-lessons only), event_starts_at/capacity (events),
-- billing_period (subscriptions).
-- Idempotent.

-- ---------------------------------------------------------------------------
-- 1. Reference tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name_ru text NOT NULL,
  name_kk text NOT NULL,
  emoji text NOT NULL,
  sort_order smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT categories_slug_key UNIQUE (slug),
  CONSTRAINT categories_sort_order_key UNIQUE (sort_order)
);

CREATE TABLE IF NOT EXISTS public.subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.categories (id) ON DELETE CASCADE,
  slug text NOT NULL,
  name_ru text NOT NULL,
  name_kk text NOT NULL,
  sort_order smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subcategories_category_slug_key UNIQUE (category_id, slug),
  CONSTRAINT subcategories_category_sort_order_key UNIQUE (category_id, sort_order)
);

CREATE INDEX IF NOT EXISTS subcategories_category_id_idx
  ON public.subcategories (category_id);

-- ---------------------------------------------------------------------------
-- 2. Seed taxonomy (idempotent)
-- ---------------------------------------------------------------------------
INSERT INTO public.categories (slug, name_ru, name_kk, emoji, sort_order)
VALUES
  ('courses', 'Курсы', 'Курстар', '🎓', 1),
  ('online-lessons', 'Онлайн-уроки', 'Онлайн сабақтар', '👨‍🏫', 2),
  ('subscriptions', 'Подписки', 'Жазылымдар', '📅', 3),
  ('materials', 'Материалы', 'Материалдар', '📂', 4),
  ('events', 'Мероприятия', 'Іс-шаралар', '🎟️', 5)
ON CONFLICT (slug) DO UPDATE SET
  name_ru = EXCLUDED.name_ru,
  name_kk = EXCLUDED.name_kk,
  emoji = EXCLUDED.emoji,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.subcategories (category_id, slug, name_ru, name_kk, sort_order)
SELECT c.id, v.slug, v.name_ru, v.name_kk, v.sort_order
FROM public.categories c
CROSS JOIN (
  VALUES
    ('courses', 'video-courses', 'видеокурсы', 'Бейне курстар', 1),
    ('courses', 'mini-courses', 'мини-курсы', 'Мини-курстар', 2),
    ('courses', 'professions', 'профессии', 'Мамандықтар', 3),
    ('courses', 'education-programs', 'образовательные программы', 'Білім беру бағдарламалары', 4),
    ('courses', 'practicums', 'практикумы', 'Практикумдар', 5),
    ('courses', 'recorded-intensives', 'интенсивы в записи', 'Жазылған интенсивтер', 6),
    ('online-lessons', 'tutoring', 'репетиторство', 'Репетиторлық', 1),
    ('online-lessons', 'consultations', 'консультации', 'Кеңестер', 2),
    ('online-lessons', 'coaching', 'коучинг', 'Коучинг', 3),
    ('online-lessons', 'mentoring', 'наставничество', 'Жетекшілік', 4),
    ('online-lessons', 'conversation-clubs', 'разговорные клубы', 'Сөйлесу клубтары', 5),
    ('online-lessons', 'exam-prep', 'подготовка к экзаменам', 'Емтиханға дайындық', 6),
    ('subscriptions', 'telegram-channels', 'Telegram-каналы', 'Telegram-арналар', 1),
    ('subscriptions', 'private-communities', 'закрытые сообщества', 'Жабық қауымдастықтар', 2),
    ('subscriptions', 'subscription-clubs', 'клубы по подписке', 'Жазылым клубтары', 3),
    ('subscriptions', 'ai-services', 'AI-сервисы', 'AI-қызметтер', 4),
    ('subscriptions', 'regular-content-access', 'регулярный доступ к контенту', 'Контентке тұрақты қол жеткізу', 5),
    ('subscriptions', 'paid-newsletters', 'платные рассылки', 'Ақылы таратулар', 6),
    ('materials', 'ebooks', 'электронные книги', 'Электрондық кітаптар', 1),
    ('materials', 'pdf-files', 'PDF-файлы', 'PDF-файлдар', 2),
    ('materials', 'templates', 'шаблоны', 'Үлгілер', 3),
    ('materials', 'checklists', 'чек-листы', 'Тексеру тізімдері', 4),
    ('materials', 'presentations', 'презентации', 'Презентациялар', 5),
    ('materials', 'guides', 'гайды', 'Гайдтар', 6),
    ('materials', 'webinar-recordings', 'записи вебинаров', 'Вебинар жазбалары', 7),
    ('materials', 'notes', 'конспекты', 'Конспектілер', 8),
    ('materials', 'spreadsheets-and-documents', 'таблицы и документы', 'Кестелер мен құжаттар', 9),
    ('events', 'webinars', 'вебинары', 'Вебинарлар', 1),
    ('events', 'masterclasses', 'мастер-классы', 'Шеберлік сабақтары', 2),
    ('events', 'intensives', 'интенсивы', 'Интенсивтер', 3),
    ('events', 'marathons', 'марафоны', 'Марафондар', 4),
    ('events', 'workshops', 'воркшопы', 'Воркшоптар', 5),
    ('events', 'online-conferences', 'онлайн-конференции', 'Онлайн конференциялар', 6),
    ('events', 'online-seminars', 'онлайн-семинары', 'Онлайн семинарлар', 7),
    ('events', 'challenges', 'челленджи', 'Челлендждер', 8)
) AS v(cat_slug, slug, name_ru, name_kk, sort_order)
WHERE c.slug = v.cat_slug
ON CONFLICT (category_id, slug) DO UPDATE SET
  name_ru = EXCLUDED.name_ru,
  name_kk = EXCLUDED.name_kk,
  sort_order = EXCLUDED.sort_order;

-- ---------------------------------------------------------------------------
-- 3. Product columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category_id uuid;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS subcategory_id uuid;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS lesson_format text;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS event_starts_at timestamptz;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS capacity int;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS billing_period text;

-- Backfill from legacy format/subject (fidelity not required in production).
UPDATE public.products p
SET
  category_id = c.id,
  subcategory_id = sc.id,
  lesson_format = CASE
    WHEN p.format IN ('individual', 'group') THEN p.format
    ELSE NULL
  END
FROM public.categories c
JOIN public.subcategories sc ON sc.category_id = c.id
WHERE p.category_id IS NULL
  AND (
    (p.format IN ('individual', 'group') AND c.slug = 'online-lessons' AND sc.slug = 'tutoring')
    OR (COALESCE(p.format, 'recorded') = 'recorded' AND c.slug = 'courses' AND sc.slug = 'video-courses')
  );

UPDATE public.products p
SET
  category_id = (SELECT id FROM public.categories WHERE slug = 'courses'),
  subcategory_id = (
    SELECT sc.id
    FROM public.subcategories sc
    JOIN public.categories c ON c.id = sc.category_id
    WHERE c.slug = 'courses' AND sc.slug = 'video-courses'
  )
WHERE p.category_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_category_id_fkey'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_category_id_fkey
      FOREIGN KEY (category_id) REFERENCES public.categories (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_subcategory_id_fkey'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_subcategory_id_fkey
      FOREIGN KEY (subcategory_id) REFERENCES public.subcategories (id);
  END IF;
END $$;

ALTER TABLE public.products
  ALTER COLUMN category_id SET NOT NULL;

ALTER TABLE public.products
  ALTER COLUMN subcategory_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_lesson_format_check'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_lesson_format_check
      CHECK (lesson_format IS NULL OR lesson_format IN ('individual', 'group'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_billing_period_check'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_billing_period_check
      CHECK (billing_period IS NULL OR billing_period IN ('month', 'quarter', 'year'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_capacity_check'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_capacity_check
      CHECK (capacity IS NULL OR capacity > 0);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.validate_product_taxonomy()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  cat_slug text;
BEGIN
  IF NEW.category_id IS NULL OR NEW.subcategory_id IS NULL THEN
    RAISE EXCEPTION 'category_id and subcategory_id are required';
  END IF;

  SELECT c.slug
  INTO cat_slug
  FROM public.categories c
  WHERE c.id = NEW.category_id;

  IF cat_slug IS NULL THEN
    RAISE EXCEPTION 'invalid category_id';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.subcategories sc
    WHERE sc.id = NEW.subcategory_id
      AND sc.category_id = NEW.category_id
  ) THEN
    RAISE EXCEPTION 'subcategory does not belong to category';
  END IF;

  IF cat_slug = 'online-lessons' THEN
    IF NEW.lesson_format IS NULL OR NEW.lesson_format NOT IN ('individual', 'group') THEN
      RAISE EXCEPTION 'lesson_format is required for online-lessons products';
    END IF;
  ELSIF NEW.lesson_format IS NOT NULL THEN
    RAISE EXCEPTION 'lesson_format applies only to online-lessons products';
  END IF;

  IF cat_slug = 'events' THEN
    IF NEW.event_starts_at IS NULL THEN
      RAISE EXCEPTION 'event_starts_at is required for events products';
    END IF;
  ELSIF NEW.event_starts_at IS NOT NULL OR NEW.capacity IS NOT NULL THEN
    RAISE EXCEPTION 'event_starts_at and capacity apply only to events products';
  END IF;

  IF cat_slug = 'subscriptions' THEN
    IF NEW.billing_period IS NULL OR NEW.billing_period NOT IN ('month', 'quarter', 'year') THEN
      RAISE EXCEPTION 'billing_period is required for subscriptions products';
    END IF;
  ELSIF NEW.billing_period IS NOT NULL THEN
    RAISE EXCEPTION 'billing_period applies only to subscriptions products';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_validate_taxonomy ON public.products;
CREATE TRIGGER products_validate_taxonomy
  BEFORE INSERT OR UPDATE OF category_id, subcategory_id, lesson_format, event_starts_at, capacity, billing_period
  ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_product_taxonomy();

DROP INDEX IF EXISTS public.products_format_idx;
DROP INDEX IF EXISTS public.products_subject_idx;
DROP INDEX IF EXISTS public.products_public_browse_idx;

CREATE INDEX IF NOT EXISTS products_category_id_idx
  ON public.products (category_id);

CREATE INDEX IF NOT EXISTS products_subcategory_id_idx
  ON public.products (subcategory_id);

CREATE INDEX IF NOT EXISTS products_public_browse_idx
  ON public.products (category_id, subcategory_id, price)
  WHERE is_active = true AND is_paused = false;

CREATE INDEX IF NOT EXISTS products_event_starts_at_idx
  ON public.products (event_starts_at)
  WHERE event_starts_at IS NOT NULL;

-- Drop dependent views before removing legacy columns.
DROP VIEW IF EXISTS public.public_products;
DROP VIEW IF EXISTS public.products_catalog;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_format_check;

ALTER TABLE public.products
  DROP COLUMN IF EXISTS format;

ALTER TABLE public.products
  DROP COLUMN IF EXISTS subject;

-- ---------------------------------------------------------------------------
-- 4. RLS on reference tables
-- ---------------------------------------------------------------------------
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS categories_public_read ON public.categories;
CREATE POLICY categories_public_read
  ON public.categories
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS subcategories_public_read ON public.subcategories;
CREATE POLICY subcategories_public_read
  ON public.subcategories
  FOR SELECT
  TO anon, authenticated
  USING (true);

REVOKE ALL ON TABLE public.categories FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.categories TO anon, authenticated;
GRANT ALL ON TABLE public.categories TO service_role;

REVOKE ALL ON TABLE public.subcategories FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.subcategories TO anon, authenticated;
GRANT ALL ON TABLE public.subcategories TO service_role;

-- ---------------------------------------------------------------------------
-- 5. Creator catalog view
-- ---------------------------------------------------------------------------
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
  category_id,
  subcategory_id,
  lesson_format,
  event_starts_at,
  capacity,
  billing_period
FROM public.products
WHERE is_active = true
  AND is_paused = false;

REVOKE ALL ON public.products_catalog FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.products_catalog TO anon, authenticated;
GRANT ALL ON public.products_catalog TO service_role;

-- ---------------------------------------------------------------------------
-- 6. Public catalog view
-- ---------------------------------------------------------------------------
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
  'Public marketplace catalog with taxonomy. Omits kaspi fields. Past events excluded.';

-- ---------------------------------------------------------------------------
-- 7. Search RPC
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.search_catalog(text, text, text, numeric, numeric, text, integer, integer);

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

REVOKE ALL ON FUNCTION public.search_catalog(text, text, text, text, text, numeric, numeric, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_catalog(text, text, text, text, text, numeric, numeric, text, integer, integer)
  TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 8. Seller storefront RPC
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_seller_storefront(text);

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

-- ---------------------------------------------------------------------------
-- 9. Taxonomy with live product counts (hides empty branches in UI)
-- ---------------------------------------------------------------------------
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

REVOKE ALL ON FUNCTION public.validate_product_taxonomy() FROM PUBLIC, anon, authenticated;
