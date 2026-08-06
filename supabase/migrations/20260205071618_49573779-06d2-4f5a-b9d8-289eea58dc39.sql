-- Add parent_id to support folders in materials
ALTER TABLE public.materials 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.materials(id) ON DELETE CASCADE;

-- Add 'folder' to material_type enum
ALTER TYPE public.material_type ADD VALUE IF NOT EXISTS 'folder';

-- Create index for faster folder queries
CREATE INDEX IF NOT EXISTS idx_materials_parent_id ON public.materials(parent_id);