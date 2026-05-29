-- Audit fix (CRITICAL) — current_user_has_permission resolved the actor via
-- current_profile_id() → auth.uid(), which is NULL on the pooled service-role
-- connection the app uses. Result: fn_checkout_equipment / fn_return_equipment /
-- fn_check_reservation_lead_time (and any other current_user_has_permission
-- caller) DENIED for every user → 100% of equipment checkouts failed.
--
-- Fix: resolve the actor from the request-scoped GUCs the app sets in its write
-- transaction (app.acting_as via current_acting_as_id, else the masking GUC
-- app.current_profile_id via current_effective_profile_id), falling back to the
-- authenticated profile for direct/psql callers. Callers MUST set the GUC and
-- call the function in the SAME transaction (the withActor() helper does this).

CREATE OR REPLACE FUNCTION public.current_user_has_permission(p_key text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT public.has_permission(
    COALESCE(
      public.current_acting_as_id(),         -- app.acting_as (write actions)
      public.current_effective_profile_id(), -- app.current_profile_id (masked reads)
      public.current_profile_id()            -- auth.uid() fallback (direct callers)
    ),
    p_key
  );
$function$;
