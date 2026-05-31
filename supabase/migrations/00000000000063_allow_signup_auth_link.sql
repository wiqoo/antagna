-- Open registration: the signup trigger (fn_on_auth_user_created) links a new
-- auth user to an existing UNLINKED profile via
--   ON CONFLICT (email) DO UPDATE SET auth_user_id = EXCLUDED.auth_user_id
--                                WHERE profiles.auth_user_id IS NULL
-- That legitimate NULL→value link was rejected by the self-escalation guard
-- ("Cannot change auth_user_id on self", 42501) → Supabase surfaced it as
-- "Database error saving new user" on /signup. Allow SETTING auth_user_id when
-- it was NULL; keep blocking CHANGING an already-linked auth_user_id (hijack).
CREATE OR REPLACE FUNCTION public.fn_block_self_role_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_role text;
BEGIN
  -- Service-role / admin callers bypass.
  IF public.is_admin_caller() THEN
    RETURN NEW;
  END IF;

  v_caller_role := public.current_role();

  -- Role is immutable for non-admins.
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Cannot change role on self (current=%, attempted=%)', OLD.role, NEW.role
      USING ERRCODE = '42501';
  END IF;

  -- auth_user_id: allow the initial link (NULL → value); block re-pointing an
  -- already-linked profile to a different auth user.
  IF NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id AND OLD.auth_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot change auth_user_id on self'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;
