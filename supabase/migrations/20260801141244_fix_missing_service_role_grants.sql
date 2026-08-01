-- Several tables never received an explicit GRANT ... TO service_role.
-- On the original Lovable-managed project this was masked by a platform-level
-- default privilege; on a self-managed Supabase project it is not, so edge
-- functions using the service-role client got "permission denied for table X"
-- (Postgres error 42501) even though service_role has BYPASSRLS.
--
-- products/materials/schedules/time_slots: never granted to service_role at all
-- (created in the very first migration, before any explicit GRANT was added).
-- notification_preferences/push_tokens: the 20260718102222 auth migration
-- revoked anon access and granted authenticated, but forgot service_role.
GRANT ALL ON TABLE public.products TO service_role;
GRANT ALL ON TABLE public.materials TO service_role;
GRANT ALL ON TABLE public.schedules TO service_role;
GRANT ALL ON TABLE public.time_slots TO service_role;
GRANT ALL ON TABLE public.notification_preferences TO service_role;
GRANT ALL ON TABLE public.push_tokens TO service_role;
