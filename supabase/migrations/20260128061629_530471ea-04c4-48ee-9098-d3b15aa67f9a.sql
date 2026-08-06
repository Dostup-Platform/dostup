-- Add cancellation reasons and comment columns to booking_cancellations
ALTER TABLE public.booking_cancellations
ADD COLUMN cancellation_reasons text[] DEFAULT '{}',
ADD COLUMN cancellation_comment text;