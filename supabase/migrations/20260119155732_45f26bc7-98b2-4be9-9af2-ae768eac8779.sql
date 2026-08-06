-- Drop the old constraint and add a new one that includes 'teacher'
ALTER TABLE public.simple_users DROP CONSTRAINT IF EXISTS simple_users_role_check;

ALTER TABLE public.simple_users 
ADD CONSTRAINT simple_users_role_check 
CHECK (role IN ('student', 'creator', 'teacher'));