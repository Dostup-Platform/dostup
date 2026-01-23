-- Remove the duplicate notification trigger
DROP TRIGGER IF EXISTS on_new_purchase_notify_creator ON public.simple_purchases;
DROP FUNCTION IF EXISTS public.notify_creator_on_purchase();