
-- 1. Group link label on products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS group_link_label TEXT;

-- 2. Announcements table
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  creator_id TEXT NOT NULL,
  content_html TEXT NOT NULL DEFAULT '',
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS announcements_product_id_idx ON public.announcements(product_id);
CREATE INDEX IF NOT EXISTS announcements_creator_id_idx ON public.announcements(creator_id);

GRANT SELECT ON public.announcements TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read announcements"
  ON public.announcements FOR SELECT
  USING (true);

CREATE POLICY "Anyone can manage announcements"
  ON public.announcements FOR ALL
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Migrate existing link/text materials into announcements
INSERT INTO public.announcements (product_id, creator_id, content_html, order_index, created_at)
SELECT
  m.product_id,
  COALESCE(p.creator_id, ''),
  CASE
    WHEN m.type = 'link' THEN
      '<h3>' || COALESCE(m.title, '') || '</h3><p><a href="' || COALESCE(m.file_url, m.content, '') ||
      '" target="_blank" rel="noopener noreferrer">' ||
      COALESCE(NULLIF(m.title, ''), COALESCE(m.file_url, m.content, '')) || '</a></p>'
    WHEN m.type = 'text' THEN
      '<h3>' || COALESCE(m.title, '') || '</h3>' ||
      '<p>' || REPLACE(COALESCE(m.content, ''), E'\n', '<br>') || '</p>'
    ELSE ''
  END,
  COALESCE(m.order_index, 0),
  COALESCE(m.created_at, now())
FROM public.materials m
JOIN public.products p ON p.id = m.product_id
WHERE m.type IN ('link', 'text');

DELETE FROM public.materials WHERE type IN ('link', 'text');
