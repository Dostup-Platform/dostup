-- Ослабление строгих ограничений на event_starts_at и billing_period в validate_product_taxonomy
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

  -- Автоматически заполняем lesson_format для онлайн-уроков, если не указано
  IF cat_slug = 'online-lessons' AND NEW.lesson_format IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.subcategories sc 
      WHERE sc.id = NEW.subcategory_id AND sc.slug = 'group'
    ) THEN
      NEW.lesson_format := 'group';
    ELSE
      NEW.lesson_format := 'individual';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
