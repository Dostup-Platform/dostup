CREATE TABLE public.material_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  user_type text NOT NULL CHECK (user_type IN ('creator', 'teacher', 'student')),
  user_ref text NOT NULL,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (material_id, user_type, user_ref)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_bookmarks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_bookmarks TO authenticated;
GRANT ALL ON public.material_bookmarks TO service_role;

ALTER TABLE public.material_bookmarks ENABLE ROW LEVEL SECURITY;

-- Mirrors the permissive pattern used by `materials` / `simple_*` tables in this project.
-- App-level isolation is enforced on the client via creator_token / SimpleAuth.
CREATE POLICY "material_bookmarks_select_all"
  ON public.material_bookmarks FOR SELECT
  USING (true);

CREATE POLICY "material_bookmarks_insert_all"
  ON public.material_bookmarks FOR INSERT
  WITH CHECK (true);

CREATE POLICY "material_bookmarks_update_all"
  ON public.material_bookmarks FOR UPDATE
  USING (true) WITH CHECK (true);

CREATE POLICY "material_bookmarks_delete_all"
  ON public.material_bookmarks FOR DELETE
  USING (true);

CREATE INDEX idx_material_bookmarks_material ON public.material_bookmarks(material_id);
CREATE INDEX idx_material_bookmarks_user ON public.material_bookmarks(user_type, user_ref);
CREATE INDEX idx_material_bookmarks_public ON public.material_bookmarks(material_id) WHERE is_public = true;