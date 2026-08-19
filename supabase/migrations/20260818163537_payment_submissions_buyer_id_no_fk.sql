-- buyer_id stores the authenticated buyer identifier (simple_users.id or profiles.id).
-- Do not pin it to one identity table while purchases still support both columns.
ALTER TABLE public.payment_submissions
  DROP CONSTRAINT IF EXISTS payment_submissions_buyer_id_fkey;
