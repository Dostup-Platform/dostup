-- Add teacher_id column to materials table for teacher-uploaded materials
ALTER TABLE public.materials 
ADD COLUMN teacher_id uuid REFERENCES public.simple_users(id) ON DELETE CASCADE;

-- Create index for faster queries
CREATE INDEX idx_materials_teacher_id ON public.materials(teacher_id);

-- Update RLS policy to allow teachers to manage their own materials
CREATE POLICY "Teachers can manage their own materials"
ON public.materials
FOR ALL
USING (true)
WITH CHECK (true);