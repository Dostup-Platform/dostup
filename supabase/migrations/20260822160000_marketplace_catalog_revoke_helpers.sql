-- Revoke helper function execute from anon/authenticated.
-- Search RPCs stay granted to anon by design.

REVOKE ALL ON FUNCTION public.slugify_handle_source(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_reserved_handle(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.allocate_profile_handle(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.profiles_assign_handle() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.immutable_unaccent(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.immutable_unaccent(text) TO postgres, service_role;
