-- Sprint 0 Phase C — effective-profile GUC for the masking layer (D-037/D-039)
--
-- The app connects as the service-role (RLS-bypassing) DB role, so a masking
-- VIEW has no per-user Postgres identity to key its CASE WHEN masks off. This
-- adds the principal the Phase-D v_*_safe views read:
--
--   current_effective_profile_id() = the EFFECTIVE (view-as aware) profile id,
--   carried in a transaction-local GUC `app.current_profile_id` set by the
--   app's withProfileScope() helper, falling back to the authenticated
--   profile (current_profile_id()) when the GUC is unset — fail-safe to the
--   REAL user, never to a lower-privilege identity.
--
-- Distinct from app.acting_as (audit "acted-as" subject, set only on writes):
-- overloading that would corrupt audit semantics on reads. Separate GUC.

CREATE OR REPLACE FUNCTION public.current_effective_profile_id()
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v text;
BEGIN
  v := current_setting('app.current_profile_id', true); -- missing_ok → '' if unset
  IF v IS NULL OR v = '' THEN
    RETURN public.current_profile_id();
  END IF;
  RETURN v::uuid;
EXCEPTION WHEN others THEN
  RETURN public.current_profile_id();
END;
$function$;
