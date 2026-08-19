-- Drop unused Supabase-Auth leftovers. Verified empty and unreferenced
-- (no FKs into these tables; client hooks usePurchases/useProfile are dead).

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role) CASCADE;
DROP FUNCTION IF EXISTS public.owns_product(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_product_teacher(uuid, uuid) CASCADE;

DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.bookings CASCADE;
DROP TABLE IF EXISTS public.purchases CASCADE;
