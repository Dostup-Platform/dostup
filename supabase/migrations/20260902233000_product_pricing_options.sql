-- Migration: add pricing_options jsonb to products and update views
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS pricing_options jsonb DEFAULT '[]'::jsonb;

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
  trial_days,
  pricing_options
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
  p.trial_days,
  p.pricing_options
FROM ((((products p
  JOIN categories c ON ((c.id = p.category_id)))
  JOIN subcategories sc ON ((sc.id = p.subcategory_id)))
  JOIN creator_accounts ca ON ((ca.id = p.creator_account_id)))
  JOIN profiles pr ON ((pr.id = ca.profile_id)))
WHERE ((p.is_active = true) AND (p.is_paused = false) AND (COALESCE(ca.is_blocked, false) = false) AND ((c.slug <> 'events'::text) OR ((p.event_starts_at IS NOT NULL) AND (p.event_starts_at > now()))));
