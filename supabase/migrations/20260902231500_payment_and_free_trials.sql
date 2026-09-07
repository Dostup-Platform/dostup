-- Migration: add payment_type, recurring_interval, has_free_trial, trial_days and product_trials table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS payment_type text DEFAULT 'one_time',
ADD COLUMN IF NOT EXISTS recurring_interval text,
ADD COLUMN IF NOT EXISTS has_free_trial boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS trial_days integer;

ALTER TABLE simple_purchases
ADD COLUMN IF NOT EXISTS is_trial boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

CREATE TABLE IF NOT EXISTS product_trials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  buyer_profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  trial_days integer NOT NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_trials_unique UNIQUE (product_id, buyer_profile_id)
);

ALTER TABLE product_trials ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'product_trials' AND policyname = 'Allow service role full access to product_trials'
  ) THEN
    CREATE POLICY "Allow service role full access to product_trials"
    ON product_trials FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'product_trials' AND policyname = 'Buyers can view their own product_trials'
  ) THEN
    CREATE POLICY "Buyers can view their own product_trials"
    ON product_trials FOR SELECT TO public
    USING (true);
  END IF;
END $$;

DROP VIEW IF EXISTS products_catalog CASCADE;
CREATE VIEW products_catalog AS
SELECT id,
  created_at,
  updated_at,
  creator_id,
  creator_account_id,
  title,
  headline,
  description,
  price,
  image_url,
  video_url,
  has_schedule,
  is_active,
  is_paused,
  paused_message,
  slug,
  telegram_link,
  group_link_label,
  faq,
  access_duration_days,
  category_id,
  subcategory_id,
  lesson_format,
  event_starts_at,
  capacity,
  billing_period,
  payment_type,
  recurring_interval,
  has_free_trial,
  trial_days
FROM products
WHERE ((is_active = true) AND (is_paused = false));

DROP VIEW IF EXISTS public_products CASCADE;
CREATE VIEW public_products AS
SELECT p.id,
  p.slug,
  p.title,
  p.headline,
  p.image_url,
  p.price,
  p.has_schedule,
  p.created_at,
  p.category_id,
  c.slug AS category_slug,
  c.name_ru AS category_name_ru,
  c.name_kk AS category_name_kk,
  c.emoji AS category_emoji,
  p.subcategory_id,
  sc.slug AS subcategory_slug,
  sc.name_ru AS subcategory_name_ru,
  sc.name_kk AS subcategory_name_kk,
  p.lesson_format,
  p.event_starts_at,
  p.capacity,
  p.billing_period,
  pr.handle AS seller_handle,
  pr.display_name AS seller_display_name,
  pr.avatar_url AS seller_avatar_url,
  pr.type AS seller_type,
  p.payment_type,
  p.recurring_interval,
  p.has_free_trial,
  p.trial_days
FROM ((((products p
  JOIN categories c ON ((c.id = p.category_id)))
  JOIN subcategories sc ON ((sc.id = p.subcategory_id)))
  JOIN creator_accounts ca ON ((ca.id = p.creator_account_id)))
  JOIN profiles pr ON ((pr.id = ca.profile_id)))
WHERE ((p.is_active = true) AND (p.is_paused = false) AND (COALESCE(ca.is_blocked, false) = false) AND ((c.slug <> 'events'::text) OR ((p.event_starts_at IS NOT NULL) AND (p.event_starts_at > now()))));
