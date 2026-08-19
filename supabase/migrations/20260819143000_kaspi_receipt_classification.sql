-- Kaspi receipt classification: QR/invoice vs completed payment evidence.
-- Confirmed fingerprints/transaction ids stay unique; rejected/QR retries may repeat a file hash.

ALTER TABLE public.payment_submissions
  DROP CONSTRAINT IF EXISTS payment_submissions_status_check;

ALTER TABLE public.payment_submissions
  ADD CONSTRAINT payment_submissions_status_check CHECK (
    verification_status = ANY (ARRAY[
      'pending'::text,
      'confirmed'::text,
      'rejected'::text,
      'manual_review'::text,
      'payment_qr_or_invoice'::text,
      'unreadable'::text
    ])
  );

ALTER TABLE public.payment_submissions
  DROP CONSTRAINT IF EXISTS payment_submissions_receipt_type_check;

ALTER TABLE public.payment_submissions
  ADD CONSTRAINT payment_submissions_receipt_type_check CHECK (
    receipt_type = ANY (ARRAY[
      'kaspi_transfer'::text,
      'kaspi_payment'::text,
      'kaspi_pay_qr'::text,
      'fiscal'::text,
      'unrelated'::text,
      'unreadable'::text,
      'pdf'::text,
      'image'::text,
      'unknown'::text
    ])
  );

ALTER TABLE public.payment_verification_events
  DROP CONSTRAINT IF EXISTS payment_verification_events_decision_check;

ALTER TABLE public.payment_verification_events
  ADD CONSTRAINT payment_verification_events_decision_check CHECK (
    decision = ANY (ARRAY[
      'pending'::text,
      'confirmed'::text,
      'rejected'::text,
      'manual_review'::text,
      'payment_qr_or_invoice'::text,
      'unreadable'::text
    ])
  );

DROP INDEX IF EXISTS public.payment_submissions_fingerprint_key;

CREATE UNIQUE INDEX IF NOT EXISTS payment_submissions_confirmed_fingerprint_key
  ON public.payment_submissions (fingerprint)
  WHERE verification_status = 'confirmed';

CREATE UNIQUE INDEX IF NOT EXISTS payment_submissions_confirmed_txn_key
  ON public.payment_submissions (lower(transaction_id))
  WHERE transaction_id IS NOT NULL AND verification_status = 'confirmed';
