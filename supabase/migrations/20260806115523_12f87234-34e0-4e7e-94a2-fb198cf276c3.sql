ALTER TABLE public.product_teachers ADD COLUMN IF NOT EXISTS teacher_name text;
ALTER TABLE public.product_teachers ALTER COLUMN teacher_user_id DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_teachers_product_name
  ON public.product_teachers (product_id, teacher_name) WHERE teacher_name IS NOT NULL;

ALTER TABLE public.material_bookmarks ADD COLUMN IF NOT EXISTS user_type text;
ALTER TABLE public.material_bookmarks ADD COLUMN IF NOT EXISTS user_ref text;
ALTER TABLE public.material_bookmarks ALTER COLUMN user_id DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_material_bookmarks_unique_ref
  ON public.material_bookmarks (material_id, user_type, user_ref) WHERE user_ref IS NOT NULL;