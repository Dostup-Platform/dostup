-- Recurring subscription invoices (manual renewal now; tokenised charges later).

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  buyer_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  billing_period text NOT NULL CHECK (billing_period IN ('month', 'quarter', 'year')),
  price numeric NOT NULL CHECK (price >= 0),
  current_period_start timestamptz NOT NULL,
  current_period_end timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'cancelled')),
  auto_renew boolean NOT NULL DEFAULT false,
  payment_token_id text,
  renewal_reminder_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_product_buyer_unique UNIQUE (product_id, buyer_profile_id)
);

CREATE INDEX IF NOT EXISTS subscriptions_buyer_profile_id_idx
  ON public.subscriptions (buyer_profile_id);

CREATE INDEX IF NOT EXISTS subscriptions_product_id_idx
  ON public.subscriptions (product_id);

CREATE INDEX IF NOT EXISTS subscriptions_period_status_idx
  ON public.subscriptions (current_period_end, status);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.subscriptions FROM anon, authenticated;
GRANT ALL ON TABLE public.subscriptions TO service_role;

-- Daily job: renewal reminders and expiry handling.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-subscriptions') THEN
    PERFORM cron.unschedule('process-subscriptions');
  END IF;
END $$;

SELECT cron.schedule(
  'process-subscriptions',
  '0 6 * * *',
  $$SELECT public.call_edge_function('process-subscriptions', '{}'::jsonb)$$
);
