-- Automatic payment receipt verification.
-- Receipts stay in a private storage bucket and are only read via service_role.

-- ---------------------------------------------------------------------------
-- 1. payment_submissions
-- ---------------------------------------------------------------------------
CREATE TABLE public.payment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.simple_purchases(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL,
  receipt_path text NOT NULL,
  receipt_mime_type text NOT NULL,
  receipt_sha256 text NOT NULL,
  detected_amount numeric(12,2),
  detected_currency text,
  transaction_id text,
  receipt_type text NOT NULL DEFAULT 'unknown',
  parsed_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  verification_status text NOT NULL DEFAULT 'pending',
  rejection_reason text,
  fingerprint text NOT NULL,
  decided_at timestamptz,
  decided_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_submissions_status_check CHECK (
    verification_status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'rejected'::text, 'manual_review'::text])
  ),
  CONSTRAINT payment_submissions_receipt_type_check CHECK (
    receipt_type = ANY (ARRAY[
      'kaspi_transfer'::text,
      'kaspi_payment'::text,
      'fiscal'::text,
      'pdf'::text,
      'image'::text,
      'unknown'::text
    ])
  ),
  CONSTRAINT payment_submissions_currency_check CHECK (
    detected_currency IS NULL OR detected_currency = ANY (ARRAY['KZT'::text, 'USD'::text, 'EUR'::text, 'RUB'::text])
  )
);

CREATE UNIQUE INDEX payment_submissions_fingerprint_key
  ON public.payment_submissions (fingerprint);

CREATE INDEX payment_submissions_purchase_id_idx
  ON public.payment_submissions (purchase_id);

CREATE INDEX payment_submissions_buyer_id_idx
  ON public.payment_submissions (buyer_id);

CREATE INDEX payment_submissions_purchase_created_idx
  ON public.payment_submissions (purchase_id, created_at DESC);

CREATE INDEX payment_submissions_manual_review_idx
  ON public.payment_submissions (purchase_id)
  WHERE verification_status = 'manual_review';

CREATE INDEX payment_submissions_transaction_id_idx
  ON public.payment_submissions (transaction_id)
  WHERE transaction_id IS NOT NULL;

COMMENT ON TABLE public.payment_submissions IS
  'Buyer payment receipts. Files live in the private payment-receipts bucket; never serve via public URLs.';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_submissions_buyer_id_fkey'
  ) THEN
    NULL;
  ELSIF to_regclass('public.profiles') IS NOT NULL THEN
    ALTER TABLE public.payment_submissions
      ADD CONSTRAINT payment_submissions_buyer_id_fkey
      FOREIGN KEY (buyer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  ELSIF to_regclass('public.simple_users') IS NOT NULL THEN
    ALTER TABLE public.payment_submissions
      ADD CONSTRAINT payment_submissions_buyer_id_fkey
      FOREIGN KEY (buyer_id) REFERENCES public.simple_users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Audit trail
-- ---------------------------------------------------------------------------
CREATE TABLE public.payment_verification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.payment_submissions(id) ON DELETE CASCADE,
  purchase_id uuid NOT NULL REFERENCES public.simple_purchases(id) ON DELETE CASCADE,
  actor text NOT NULL,
  decision text NOT NULL,
  checks jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_verification_events_decision_check CHECK (
    decision = ANY (ARRAY['pending'::text, 'confirmed'::text, 'rejected'::text, 'manual_review'::text])
  )
);

CREATE INDEX payment_verification_events_submission_id_idx
  ON public.payment_verification_events (submission_id);

CREATE INDEX payment_verification_events_purchase_id_idx
  ON public.payment_verification_events (purchase_id);

COMMENT ON TABLE public.payment_verification_events IS
  'Immutable audit log of receipt verification decisions (system or creator).';

CREATE TRIGGER payment_submissions_updated_at
  BEFORE UPDATE ON public.payment_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 3. Lock down like other app tables: service_role only
-- ---------------------------------------------------------------------------
ALTER TABLE public.payment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_verification_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.payment_submissions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.payment_verification_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.payment_submissions TO service_role;
GRANT ALL ON public.payment_verification_events TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Private storage bucket — no public URLs, no client policies
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-receipts',
  'payment-receipts',
  false,
  4194304,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
