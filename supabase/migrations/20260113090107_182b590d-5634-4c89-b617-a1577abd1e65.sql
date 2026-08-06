-- Enable realtime for simple_bookings table
ALTER TABLE public.simple_bookings REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.simple_bookings;