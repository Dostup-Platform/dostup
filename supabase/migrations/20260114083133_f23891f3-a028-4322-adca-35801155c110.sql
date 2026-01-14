-- Create table to store booking cancellations for notifications
CREATE TABLE public.booking_cancellations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  user_phone TEXT,
  product_title TEXT NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  schedule_title TEXT,
  slot_date DATE NOT NULL,
  slot_time TIME NOT NULL,
  cancelled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  cancelled_by TEXT NOT NULL DEFAULT 'student' -- 'student' or 'creator'
);

-- Enable RLS
ALTER TABLE public.booking_cancellations ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (since we're using simple auth, not Supabase Auth)
CREATE POLICY "Allow all operations on booking_cancellations" 
ON public.booking_cancellations 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Enable realtime for booking_cancellations table
ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_cancellations;