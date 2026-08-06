-- Добавить политику для удаления бронирований
CREATE POLICY "Anyone can delete simple booking"
ON public.simple_bookings
FOR DELETE
USING (true);