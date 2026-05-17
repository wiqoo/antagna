-- Pillar 1 — auto-create profile on first sign-in.
--
-- Pattern: zero pre-seeding. Profiles materialize only when a Supabase auth
-- user signs in for the first time (Google SSO from voltsaudi.com).
-- Admin (Mohammed) sets role/capabilities/Arabic names afterwards, OR they
-- get filled in from the Volt OS data merge at the end of Pillar 15.
--
-- config/roles.yaml stays as a REFERENCE document (canonical roster, Arabic
-- names, capabilities) — not consumed by this trigger.

CREATE OR REPLACE FUNCTION public.fn_on_auth_user_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_full_name text;
BEGIN
  v_email := NEW.email;

  -- Best-effort name from Google identity metadata; fall back to email local-part.
  v_full_name := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'name',
    split_part(v_email, '@', 1)
  );

  INSERT INTO public.profiles (auth_user_id, email, full_name, role, active)
  VALUES (NEW.id, v_email, v_full_name, 'user', true)
  ON CONFLICT (email) DO UPDATE
    SET auth_user_id = EXCLUDED.auth_user_id
    WHERE public.profiles.auth_user_id IS NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.fn_on_auth_user_created();
