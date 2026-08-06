ALTER TABLE public.support_threads ADD COLUMN IF NOT EXISTS user_type text;
ALTER TABLE public.support_threads ADD COLUMN IF NOT EXISTS user_ref text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_support_threads_user_ref
  ON public.support_threads (user_type, user_ref) WHERE user_ref IS NOT NULL;