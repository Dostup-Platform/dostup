ALTER TABLE public.product_teachers ADD COLUMN IF NOT EXISTS teacher_name text;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='product_teachers' AND column_name='teacher_user_id') THEN
    ALTER TABLE public.product_teachers ALTER COLUMN teacher_user_id DROP NOT NULL;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_teachers_product_name
  ON public.product_teachers (product_id, teacher_name) WHERE teacher_name IS NOT NULL;

ALTER TABLE public.material_bookmarks ADD COLUMN IF NOT EXISTS user_type text;
ALTER TABLE public.material_bookmarks ADD COLUMN IF NOT EXISTS user_ref text;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='material_bookmarks' AND column_name='user_id') THEN
    ALTER TABLE public.material_bookmarks ALTER COLUMN user_id DROP NOT NULL;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS idx_material_bookmarks_unique_ref
  ON public.material_bookmarks (material_id, user_type, user_ref) WHERE user_ref IS NOT NULL;
