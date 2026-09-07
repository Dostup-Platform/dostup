-- Миграция: создание таблицы тем продуктов и добавление поля topic в products

CREATE TABLE IF NOT EXISTS public.topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  subcategory_id uuid REFERENCES public.subcategories(id) ON DELETE CASCADE,
  name text NOT NULL,
  normalized_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by text
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_topics_category_normalized ON public.topics(category_id, normalized_name);

ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'topics' AND policyname = 'Anyone can read topics'
  ) THEN
    CREATE POLICY "Anyone can read topics" ON public.topics FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'topics' AND policyname = 'Anyone can insert topics'
  ) THEN
    CREATE POLICY "Anyone can insert topics" ON public.topics FOR INSERT WITH CHECK (true);
  END IF;
END $$;

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS topic text;
