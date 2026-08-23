-- Auto-generate readable product slugs from Cyrillic titles (transliterate → a-z0-9-).

CREATE OR REPLACE FUNCTION public.allocate_product_slug(p_title text, p_id uuid)
RETURNS text
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  base text;
  candidate text;
  n int := 0;
  suffix text;
BEGIN
  base := public.slugify_handle_source(p_title);
  IF length(base) < 1 THEN
    base := 'product';
  END IF;
  base := left(base, 50);
  candidate := base;

  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.products pr
      WHERE pr.slug = candidate
        AND pr.id IS DISTINCT FROM p_id
    ) THEN
      RETURN candidate;
    END IF;
    n := n + 1;
    suffix := substr(md5(p_id::text || '-' || n::text), 1, 4);
    candidate := left(base, greatest(1, 50 - 5)) || '-' || suffix;
    IF n > 10000 THEN
      RETURN left(base, 45) || '-' || substr(replace(p_id::text, '-', ''), 1, 4);
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_product_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.slug IS NULL OR btrim(NEW.slug) = '' THEN
      NEW.slug := public.allocate_product_slug(NEW.title, NEW.id);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.title IS DISTINCT FROM OLD.title THEN
      NEW.slug := public.allocate_product_slug(NEW.title, NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_sync_slug ON public.products;
CREATE TRIGGER products_sync_slug
  BEFORE INSERT OR UPDATE OF title ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_product_slug();

-- Backfill existing rows.
UPDATE public.products
SET slug = public.allocate_product_slug(title, id)
WHERE slug IS NULL OR btrim(slug) = '';

REVOKE ALL ON FUNCTION public.allocate_product_slug(text, uuid) FROM PUBLIC, anon, authenticated;
