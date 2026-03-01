
ALTER TABLE public.reschedule_requests 
ADD COLUMN requested_by TEXT NOT NULL DEFAULT 'student';

ALTER TABLE public.reschedule_requests 
ADD COLUMN teacher_id UUID DEFAULT NULL;
