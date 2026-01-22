-- Add max_participants column to time_slots for per-slot capacity override
ALTER TABLE public.time_slots 
ADD COLUMN max_participants integer DEFAULT NULL;

-- When NULL, the slot uses the schedule's max_participants
-- When set, it overrides the schedule's default for this specific slot

COMMENT ON COLUMN public.time_slots.max_participants IS 'Override max participants for this specific slot. NULL means use schedule default.';