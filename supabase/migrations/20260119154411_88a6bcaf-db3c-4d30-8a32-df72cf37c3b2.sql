-- Drop the old constraint and add a new one that includes 'revoked'
ALTER TABLE public.simple_purchases DROP CONSTRAINT IF EXISTS simple_purchases_status_check;

ALTER TABLE public.simple_purchases 
ADD CONSTRAINT simple_purchases_status_check 
CHECK (status IN ('pending', 'completed', 'revoked'));