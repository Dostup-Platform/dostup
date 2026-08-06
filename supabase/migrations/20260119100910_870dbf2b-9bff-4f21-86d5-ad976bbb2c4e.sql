-- Create table for product teachers (linking teachers to products)
CREATE TABLE public.product_teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  teacher_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique index to prevent duplicate teacher assignments
CREATE UNIQUE INDEX idx_product_teachers_unique ON public.product_teachers(product_id, teacher_name);

-- Enable RLS
ALTER TABLE public.product_teachers ENABLE ROW LEVEL SECURITY;

-- RLS policy: anyone can view teachers for products
CREATE POLICY "Anyone can view product teachers" ON public.product_teachers
  FOR SELECT USING (true);

-- RLS policy: anyone can manage teachers (creator auth is handled in app layer)
CREATE POLICY "Anyone can manage product teachers" ON public.product_teachers
  FOR ALL USING (true) WITH CHECK (true);

-- Add teacher_id to schedules (nullable - null means author's schedule)
ALTER TABLE public.schedules ADD COLUMN teacher_id UUID REFERENCES public.simple_users(id) ON DELETE SET NULL;

-- Add teacher_id to simple_purchases to track which teacher a student is assigned to
-- NULL = author's schedule, specific UUID = teacher's schedule, special value for "student choice"
ALTER TABLE public.simple_purchases ADD COLUMN assigned_teacher_id UUID REFERENCES public.simple_users(id) ON DELETE SET NULL;

-- Add flag for "student can choose teacher"
ALTER TABLE public.simple_purchases ADD COLUMN can_choose_teacher BOOLEAN DEFAULT false;

-- Enable realtime for product_teachers
ALTER PUBLICATION supabase_realtime ADD TABLE public.product_teachers;