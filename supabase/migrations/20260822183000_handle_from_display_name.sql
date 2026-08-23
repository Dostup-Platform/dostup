-- Allow seller handles to be chosen later when display_name cannot be slugified.
-- Regenerate existing handles from real display names (Cyrillic transliterated).
-- Email-local display names are treated as empty for handle allocation.

CREATE OR REPLACE FUNCTION public.display_name_usable_for_handle(p_display_name text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT
    length(public.slugify_handle_source(p_display_name)) >= 3
    AND coalesce(p_display_name, '') !~ '@'
    AND coalesce(p_display_name, '') !~ '^[A-Za-z0-9._%+-]*\.[A-Za-z0-9._%+-]+$'
$$;

CREATE OR REPLACE FUNCTION public.profiles_assign_handle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.handle IS NOT NULL AND btrim(NEW.handle) <> '' THEN
    NEW.handle := lower(btrim(NEW.handle));
    RETURN NEW;
  END IF;

  NEW.handle := NULL;
  IF public.display_name_usable_for_handle(NEW.display_name) THEN
    NEW.handle := public.allocate_profile_handle(NEW.display_name, NEW.id);
  ELSIF NEW.type = 'buyer' THEN
    NEW.handle := public.allocate_profile_handle(NULL, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_assign_handle ON public.profiles;
CREATE TRIGGER profiles_assign_handle
  BEFORE INSERT OR UPDATE OF handle, display_name, type
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_assign_handle();

ALTER TABLE public.profiles
  ALTER COLUMN handle DROP NOT NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_handle_format_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_handle_format_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_handle_format_check
      CHECK (
        handle IS NULL
        OR (
          handle ~ '^[a-z0-9-]{3,30}$'
          AND handle NOT IN ('admin', 'api', 'auth', 'login', 'dashboard', 'creator', 'school', 's', 'p')
        )
      );
  END IF;
END $$;

DROP INDEX IF EXISTS public.profiles_handle_key;
CREATE UNIQUE INDEX profiles_handle_key
  ON public.profiles (handle)
  WHERE handle IS NOT NULL;

-- Re-allocate from usable display names, then clear garbage seller handles.
UPDATE public.profiles p
SET handle = public.allocate_profile_handle(p.display_name, p.id)
WHERE public.display_name_usable_for_handle(p.display_name);

UPDATE public.profiles p
SET handle = NULL
WHERE p.type IN ('creator', 'school')
  AND NOT public.display_name_usable_for_handle(p.display_name);

UPDATE public.profiles p
SET handle = public.allocate_profile_handle(NULL, p.id)
WHERE p.type = 'buyer'
  AND NOT public.display_name_usable_for_handle(p.display_name);

CREATE OR REPLACE FUNCTION public.handle_is_available(p_handle text, p_except_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  h text := lower(btrim(coalesce(p_handle, '')));
BEGIN
  IF h !~ '^[a-z0-9-]{3,30}$' OR public.is_reserved_handle(h) THEN
    RETURN false;
  END IF;
  RETURN NOT EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.handle = h
      AND pr.id IS DISTINCT FROM p_except_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.display_name_usable_for_handle(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_is_available(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_is_available(text, uuid) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.profiles_assign_handle() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.profiles_assign_handle() TO service_role;
