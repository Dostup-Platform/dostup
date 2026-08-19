-- Make products_catalog a security_invoker view and allow public SELECT
-- of non-Kaspi columns on products so the one public RLS policy is actually used.

GRANT SELECT (
  id,
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
  access_duration_days
) ON public.products TO anon, authenticated;

CREATE OR REPLACE VIEW public.products_catalog
WITH (security_invoker = true) AS
SELECT
  id,
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
  access_duration_days
FROM public.products
WHERE is_active = true
  AND is_paused = false;

GRANT SELECT ON public.products_catalog TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.products_catalog FROM anon, authenticated, PUBLIC;
