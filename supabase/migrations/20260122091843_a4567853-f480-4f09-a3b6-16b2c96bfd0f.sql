-- Add lesson_link column to time_slots table
ALTER TABLE public.time_slots 
ADD COLUMN lesson_link TEXT DEFAULT NULL;