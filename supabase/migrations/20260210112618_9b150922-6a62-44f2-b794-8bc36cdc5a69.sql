
-- Add user_id column to push_tokens
ALTER TABLE public.push_tokens ADD COLUMN IF NOT EXISTS user_id UUID;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON public.push_tokens(user_id);

-- Backfill existing records by matching user_phone to simple_users.phone
UPDATE public.push_tokens pt
SET user_id = su.id
FROM public.simple_users su
WHERE pt.user_phone = su.phone
  AND pt.user_id IS NULL;

-- Fix the student with empty phone
UPDATE public.simple_users
SET phone = 'user_' || extract(epoch from created_at)::bigint || '_fixed'
WHERE id = '69fd4f32-129d-4d7d-92bd-f3a8d8fd39c6' AND (phone = '' OR phone IS NULL);
