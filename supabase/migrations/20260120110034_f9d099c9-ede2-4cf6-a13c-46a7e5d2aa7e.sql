-- Добавить schedule_id в booking_cancellations для правильной фильтрации
ALTER TABLE public.booking_cancellations 
ADD COLUMN schedule_id uuid REFERENCES public.schedules(id) ON DELETE SET NULL;

-- Добавить индекс для быстрого поиска
CREATE INDEX idx_booking_cancellations_schedule_id ON public.booking_cancellations(schedule_id);