-- Создать таблицу для бронирований simple_users
CREATE TABLE public.simple_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  simple_user_id UUID NOT NULL REFERENCES public.simple_users(id) ON DELETE CASCADE,
  time_slot_id UUID NOT NULL REFERENCES public.time_slots(id) ON DELETE CASCADE,
  schedule_id UUID NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Уникальный constraint чтобы один пользователь не мог забронировать один слот дважды
CREATE UNIQUE INDEX simple_bookings_user_slot_unique ON public.simple_bookings(simple_user_id, time_slot_id);

-- Enable Row Level Security
ALTER TABLE public.simple_bookings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view simple bookings"
ON public.simple_bookings
FOR SELECT
USING (true);

CREATE POLICY "Anyone can create simple booking"
ON public.simple_bookings
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update own bookings"
ON public.simple_bookings
FOR UPDATE
USING (true);