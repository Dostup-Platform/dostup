-- Enable realtime for time_slots table
ALTER TABLE public.time_slots REPLICA IDENTITY FULL;

-- Add table to realtime publication if not already added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'time_slots'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.time_slots;
  END IF;
END $$;