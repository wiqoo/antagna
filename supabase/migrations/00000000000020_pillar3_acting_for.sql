-- Pillar 3 §9 — Acting-for pattern.
--
-- When Mohammed acts on Abu Luka's behalf, every audit + activity row should
-- record: actor_id = Mohammed, acted_as_id = Abu Luka.
--
-- Mechanism: each server-side write transaction sets
--   SET LOCAL app.acting_as = '<target_profile_id>'
-- before doing work. The audit + activity triggers read that GUC and stamp
-- the acted_as_id.

-- ── helper: read the current acting_as principal ──────────────────────────────

CREATE OR REPLACE FUNCTION public.current_acting_as_id()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v text;
BEGIN
  -- current_setting with missing_ok=true returns '' (empty) if unset.
  v := current_setting('app.acting_as', true);
  IF v IS NULL OR v = '' THEN RETURN NULL; END IF;
  RETURN v::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

-- ── extend fn_audit_row_change to write acted_as_id ──────────────────────────

CREATE OR REPLACE FUNCTION public.fn_audit_row_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id    uuid;
  v_actor_email text;
  v_acted_as_id uuid;
  v_row_json    jsonb;
  v_entity_id   text;
BEGIN
  v_actor_id    := public.current_profile_id();
  v_acted_as_id := public.current_acting_as_id();
  SELECT email INTO v_actor_email FROM public.profiles WHERE id = v_actor_id;

  v_row_json := CASE TG_OP
    WHEN 'DELETE' THEN to_jsonb(OLD)
    ELSE              to_jsonb(NEW)
  END;

  v_entity_id := COALESCE(
    v_row_json ->> 'id',
    v_row_json ->> 'key'
  );

  INSERT INTO public.audit_log
    (actor_id, actor_email, acted_as_id, action, entity_type, entity_id, before_data, after_data)
  VALUES (
    v_actor_id,
    v_actor_email,
    v_acted_as_id,
    TG_OP,
    TG_TABLE_NAME,
    v_entity_id,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ── helper to bulk-write activity_events with both actor_id + acted_as_id ─────
-- Most feature code will call this from a transaction that has SET LOCAL
-- app.acting_as set.

CREATE OR REPLACE FUNCTION public.write_activity(
  p_entity_type text,
  p_entity_id   uuid,
  p_action      text,
  p_summary_ar  text,
  p_summary_en  text DEFAULT NULL,
  p_project_id  uuid DEFAULT NULL,
  p_metadata    jsonb DEFAULT '{}'::jsonb
) RETURNS bigint LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.activity_events
    (actor_id, acted_as_id, entity_type, entity_id, action, summary_ar, summary_en, project_id, metadata)
  VALUES
    (public.current_profile_id(), public.current_acting_as_id(),
     p_entity_type, p_entity_id, p_action, p_summary_ar, p_summary_en, p_project_id, p_metadata)
  RETURNING id;
$$;
