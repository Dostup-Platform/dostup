-- The 20260718102222 migration dropped the legacy public.simple_bookings and
-- public.simple_purchases tables (CASCADE), which silently removed the
-- trigger_notify_booking_insert/delete and trigger_notify_purchase_insert/update
-- triggers along with them. The trigger functions (notify_booking_change,
-- notify_purchase_change) were kept and still work, but nothing calls them on
-- the current public.bookings / public.purchases tables, so creators/students
-- never get notified about new bookings or purchase requests.
--
-- Re-attach the same triggers to the tables that replaced simple_bookings/simple_purchases.
CREATE TRIGGER trigger_notify_booking_insert
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_booking_change();

CREATE TRIGGER trigger_notify_booking_delete
  AFTER DELETE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_booking_change();

CREATE TRIGGER trigger_notify_purchase_insert
  AFTER INSERT ON public.purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_purchase_change();

CREATE TRIGGER trigger_notify_purchase_update
  AFTER UPDATE ON public.purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_purchase_change();
