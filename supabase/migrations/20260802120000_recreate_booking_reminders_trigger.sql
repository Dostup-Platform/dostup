-- Триггер напоминаний жил на simple_bookings и был удалён вместе с таблицей
-- (DROP TABLE ... CASCADE в 20260718102222). Пересоздаём его на bookings.
DROP TRIGGER IF EXISTS create_reminders_on_booking ON public.bookings;
CREATE TRIGGER create_reminders_on_booking
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.create_booking_reminders();
