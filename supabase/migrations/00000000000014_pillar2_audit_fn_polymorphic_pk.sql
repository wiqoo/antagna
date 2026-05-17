-- Pillar 2 fix — make fn_audit_row_change polymorphic across primary-key shapes.
--
-- The Pillar 1 version assumed every table has an `id` column. capabilities
-- uses `key`, notification_event_types uses `key`, etc. Result: every insert
-- into one of those tables raised `record "new" has no field "id"`.
--
-- New version reads the entity id from the JSON representation of the row,
-- preferring 'id', falling back to 'key', then to NULL.

CREATE OR REPLACE FUNCTION public.fn_audit_row_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id    uuid;
  v_actor_email text;
  v_row_json    jsonb;
  v_entity_id   text;
BEGIN
  v_actor_id := public.current_profile_id();
  SELECT email INTO v_actor_email FROM public.profiles WHERE id = v_actor_id;

  v_row_json := CASE TG_OP
    WHEN 'DELETE' THEN to_jsonb(OLD)
    ELSE              to_jsonb(NEW)
  END;

  v_entity_id := COALESCE(
    v_row_json ->> 'id',
    v_row_json ->> 'key'
  );

  INSERT INTO public.audit_log (actor_id, actor_email, action, entity_type, entity_id, before_data, after_data)
  VALUES (
    v_actor_id,
    v_actor_email,
    TG_OP,
    TG_TABLE_NAME,
    v_entity_id,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;
