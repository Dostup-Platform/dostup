
-- Allow teachers to see schedules, slots and bookings for products they teach
CREATE POLICY "Teacher can view schedules" ON public.schedules
FOR SELECT USING (public.is_product_teacher(product_id, auth.uid()));

CREATE POLICY "Teacher can view time_slots" ON public.time_slots
FOR SELECT USING (EXISTS (
  SELECT 1 FROM public.schedules s
  WHERE s.id = time_slots.schedule_id
    AND public.is_product_teacher(s.product_id, auth.uid())
));

CREATE POLICY "Teacher can view bookings" ON public.bookings
FOR SELECT USING (EXISTS (
  SELECT 1 FROM public.schedules s
  WHERE s.id = bookings.schedule_id
    AND public.is_product_teacher(s.product_id, auth.uid())
));

-- Allow teachers to read minimal profile info of their students
CREATE POLICY "Teacher can view student profiles" ON public.profiles
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.schedules s ON s.id = b.schedule_id
    WHERE b.user_id = profiles.user_id
      AND public.is_product_teacher(s.product_id, auth.uid())
  )
);
