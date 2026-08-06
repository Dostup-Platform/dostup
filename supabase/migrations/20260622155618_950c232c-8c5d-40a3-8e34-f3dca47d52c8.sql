ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS original_parent_id UUID;