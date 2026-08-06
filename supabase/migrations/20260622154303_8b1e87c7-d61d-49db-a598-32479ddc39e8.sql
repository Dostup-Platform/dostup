ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS materials_deleted_at_idx ON public.materials(deleted_at) WHERE deleted_at IS NOT NULL;