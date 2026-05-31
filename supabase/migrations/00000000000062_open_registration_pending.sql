-- Open registration + admin approval (supersedes D-040 invite-only).
-- New self-signups now arrive as status='invited' (pending admin approval)
-- instead of 'active'. An admin activates them at /admin/signups → 'active'.
-- The app gates non-'active' accounts to an "awaiting approval" screen.
CREATE OR REPLACE FUNCTION public.fn_on_auth_user_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
  v_display text;
BEGIN
  v_email := NEW.email;
  v_display := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'name',
    split_part(v_email, '@', 1)
  );

  INSERT INTO public.profiles (auth_user_id, email, display_name, role, status)
  VALUES (NEW.id, v_email, v_display, 'user', 'invited'::person_status)
  ON CONFLICT (email) DO UPDATE
    SET auth_user_id = EXCLUDED.auth_user_id
    WHERE public.profiles.auth_user_id IS NULL;

  RETURN NEW;
END;
$function$;
