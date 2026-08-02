-- RLS fixes so reschedule approve/reject works from the frontend

-- Bookings: owner or teacher can update time_slot when approving a reschedule
CREATE POLICY "Owner or teacher updates bookings" ON public.bookings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.schedules s
      WHERE s.id = bookings.schedule_id
        AND public.owns_product(s.product_id, auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.schedules s
      WHERE s.id = bookings.schedule_id
        AND public.is_product_teacher(s.product_id, auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.schedules s
      WHERE s.id = bookings.schedule_id
        AND public.owns_product(s.product_id, auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.schedules s
      WHERE s.id = bookings.schedule_id
        AND public.is_product_teacher(s.product_id, auth.uid())
    )
  );

GRANT UPDATE ON public.bookings TO authenticated;

-- booking_reschedules: owner/teacher can insert history on behalf of students
CREATE POLICY "Owner inserts reschedules" ON public.booking_reschedules
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = booking_reschedules.product_id AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "Teacher inserts reschedules" ON public.booking_reschedules
  FOR INSERT TO authenticated
  WITH CHECK (public.is_product_teacher(product_id, auth.uid()));

-- reschedule_requests: teachers can view and respond
CREATE POLICY "Teacher sees requests" ON public.reschedule_requests
  FOR SELECT TO authenticated
  USING (public.is_product_teacher(product_id, auth.uid()));

CREATE POLICY "Teacher updates requests" ON public.reschedule_requests
  FOR UPDATE TO authenticated
  USING (public.is_product_teacher(product_id, auth.uid()));

-- Students can respond to teacher/creator-initiated requests
CREATE POLICY "Student responds to incoming requests" ON public.reschedule_requests
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND requested_by <> 'student')
  WITH CHECK (user_id = auth.uid());
