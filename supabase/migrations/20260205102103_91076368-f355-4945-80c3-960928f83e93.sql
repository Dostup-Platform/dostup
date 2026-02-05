-- Add columns to control file access permissions per material
ALTER TABLE public.materials 
ADD COLUMN allow_view boolean NOT NULL DEFAULT true,
ADD COLUMN allow_download boolean NOT NULL DEFAULT true;

-- Add comment for clarity
COMMENT ON COLUMN public.materials.allow_view IS 'Whether students/teachers can view this file in browser';
COMMENT ON COLUMN public.materials.allow_download IS 'Whether students/teachers can download this file';