-- Enable realtime for simple_purchases table to allow instant updates when creator confirms purchase
ALTER TABLE public.simple_purchases REPLICA IDENTITY FULL;

-- Add table to realtime publication if not already added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'simple_purchases'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.simple_purchases;
  END IF;
END $$;