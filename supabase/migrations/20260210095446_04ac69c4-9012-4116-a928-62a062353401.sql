-- Create trigger to notify on purchase changes (INSERT and UPDATE)
CREATE TRIGGER on_simple_purchase_change
AFTER INSERT OR UPDATE ON public.simple_purchases
FOR EACH ROW
EXECUTE FUNCTION public.notify_purchase_change();