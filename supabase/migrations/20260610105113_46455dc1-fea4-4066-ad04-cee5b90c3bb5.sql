ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS kaspi_phone TEXT,
  ADD COLUMN IF NOT EXISTS access_duration_days INTEGER;