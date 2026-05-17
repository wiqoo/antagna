-- Pillar 6 — Equipment workflow: compatibility, kit suggestions, repairs,
-- 1-day reservation lead rule, location auto-sync, battery alerts view.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'compatibility_verdict') THEN
    CREATE TYPE compatibility_verdict AS ENUM ('compatible','incompatible','unverified');
  END IF;
END $$;

-- ── tables ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.compatibility_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_a_id       uuid REFERENCES public.equipment(id),
  item_b_id       uuid REFERENCES public.equipment(id),
  group_a_id      uuid REFERENCES public.equipment_groups(id),
  group_b_id      uuid REFERENCES public.equipment_groups(id),
  tag_a           text,
  tag_b           text,
  verdict         compatibility_verdict NOT NULL,
  reason_ar       text,
  reason_en       text,
  source          text NOT NULL,
  verified_count  integer NOT NULL DEFAULT 1,
  created_by      uuid REFERENCES public.profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS comp_rules_items_idx  ON public.compatibility_rules (item_a_id, item_b_id);
CREATE INDEX IF NOT EXISTS comp_rules_groups_idx ON public.compatibility_rules (group_a_id, group_b_id);

CREATE TABLE IF NOT EXISTS public.compatibility_feedback (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id   uuid REFERENCES public.equipment_reservations(id),
  item_a_id        uuid NOT NULL REFERENCES public.equipment(id),
  item_b_id        uuid NOT NULL REFERENCES public.equipment(id),
  verdict          text NOT NULL,           -- 'worked' | 'issue'
  notes            text,
  reported_by_id   uuid REFERENCES public.profiles(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT feedback_ordered CHECK (item_a_id < item_b_id)
);

CREATE INDEX IF NOT EXISTS comp_feedback_pair_idx ON public.compatibility_feedback (item_a_id, item_b_id);

CREATE TABLE IF NOT EXISTS public.kit_suggestions (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_equipment_group_id  uuid NOT NULL REFERENCES public.equipment_groups(id),
  suggested_item_group_id     uuid REFERENCES public.equipment_groups(id),
  suggested_item_id           uuid REFERENCES public.equipment(id),
  quantity                    integer NOT NULL DEFAULT 1,
  importance                  text NOT NULL,    -- 'mandatory' | 'recommended' | 'optional'
  reason_ar                   text,
  notes                       text,
  position                    integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS kit_suggest_primary_idx ON public.kit_suggestions (primary_equipment_group_id);

CREATE TABLE IF NOT EXISTS public.equipment_repairs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id        uuid NOT NULL REFERENCES public.equipment(id),
  reported_by_id      uuid REFERENCES public.profiles(id),
  reported_at         timestamptz NOT NULL DEFAULT now(),
  issue_description   text NOT NULL,
  severity            text NOT NULL,           -- 'minor' | 'major' | 'unusable'
  vendor              text,
  cost_sar            numeric(10,2),
  sent_at             timestamptz,
  returned_at         timestamptz,
  status              text NOT NULL DEFAULT 'reported',
  notes               text
);

CREATE INDEX IF NOT EXISTS er_equipment_idx ON public.equipment_repairs (equipment_id);
CREATE INDEX IF NOT EXISTS er_status_idx    ON public.equipment_repairs (status);

-- ── battery-alerts view ──────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_battery_alerts AS
SELECT
  id, code, model, last_charged_at,
  CASE
    WHEN last_charged_at IS NULL                           THEN 'never_charged'
    WHEN last_charged_at < now() - interval '30 days'      THEN 'stale_charge'
    ELSE                                                        'fresh'
  END AS alert_level
FROM public.equipment
WHERE requires_charging = true AND status = 'available';

GRANT SELECT ON public.v_battery_alerts TO anon, authenticated, service_role;

-- ── §3 + permission for the 1-day-rule override ──────────────────────────────

INSERT INTO public.permissions (key, category, description_ar, description_en, risk_level) VALUES
  ('equipment.reserve_urgent', 'equipment', 'حجز عاجل (تخطي قاعدة اليوم الواحد)', 'Reserve urgently (bypass 1-day rule)', 'normal')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_default_permissions (role, permission_key) VALUES
  ('system_admin',      'equipment.reserve_urgent'),
  ('general_manager',   'equipment.reserve_urgent'),
  ('project_manager',   'equipment.reserve_urgent')
ON CONFLICT DO NOTHING;

-- ── §4.1 the 1-day rule ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_check_reservation_lead_time()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.starts_at < now() + interval '1 day'
     AND NOT public.current_user_has_permission('equipment.reserve_urgent') THEN
    RAISE EXCEPTION 'Reservations require at least 1 day notice. Override permission: equipment.reserve_urgent';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_check_reservation_lead ON public.equipment_reservations;
CREATE TRIGGER tg_check_reservation_lead
  BEFORE INSERT ON public.equipment_reservations
  FOR EACH ROW EXECUTE FUNCTION public.fn_check_reservation_lead_time();

-- ── §4.3 location auto-sync ──────────────────────────────────────────────────
-- Precedence: repair > lost > in_use > warehouse.

CREATE OR REPLACE FUNCTION public.fn_sync_equipment_location(p_eq_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_active boolean;
BEGIN
  SELECT status INTO v_status FROM public.equipment WHERE id = p_eq_id;

  SELECT EXISTS (
    SELECT 1 FROM public.equipment_reservations
    WHERE equipment_id = p_eq_id
      AND status IN ('reserved','checked_out')
      AND now() BETWEEN starts_at AND ends_at
  ) INTO v_active;

  UPDATE public.equipment
  SET current_location = CASE
    WHEN v_status = 'repair' THEN 'repair'
    WHEN v_status = 'lost'   THEN 'lost'
    WHEN v_active            THEN 'in_use'
    ELSE                          'warehouse'
  END
  WHERE id = p_eq_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_sync_location_from_reservation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') AND OLD.equipment_id IS NOT NULL THEN
    PERFORM public.fn_sync_equipment_location(OLD.equipment_id);
  END IF;
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.equipment_id IS NOT NULL THEN
    PERFORM public.fn_sync_equipment_location(NEW.equipment_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS tg_sync_location_from_reservation ON public.equipment_reservations;
CREATE TRIGGER tg_sync_location_from_reservation
  AFTER INSERT OR UPDATE OR DELETE ON public.equipment_reservations
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_location_from_reservation();

CREATE OR REPLACE FUNCTION public.fn_sync_location_from_equipment_status()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.fn_sync_equipment_location(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_sync_location_from_status ON public.equipment;
CREATE TRIGGER tg_sync_location_from_status
  AFTER UPDATE OF status ON public.equipment
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_location_from_equipment_status();

-- ── §4.2 checkout/return helpers ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_checkout_equipment(p_reservation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_has_permission('equipment.checkout') THEN
    RAISE EXCEPTION 'permission denied: equipment.checkout';
  END IF;

  UPDATE public.equipment_reservations
  SET status = 'checked_out'
  WHERE id = p_reservation_id;

  -- Equipment status doesn't change here; location auto-sync runs via the
  -- reservation trigger and flips current_location → 'in_use'.
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_return_equipment(
  p_reservation_id uuid,
  p_condition_notes text DEFAULT NULL,
  p_damaged boolean DEFAULT false
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_eq_id uuid;
BEGIN
  IF NOT public.current_user_has_permission('equipment.return') THEN
    RAISE EXCEPTION 'permission denied: equipment.return';
  END IF;

  SELECT equipment_id INTO v_eq_id
    FROM public.equipment_reservations
    WHERE id = p_reservation_id;

  UPDATE public.equipment_reservations
  SET status = 'returned',
      notes  = COALESCE(notes, '') || COALESCE(E'\n' || p_condition_notes, '')
  WHERE id = p_reservation_id;

  IF p_damaged AND v_eq_id IS NOT NULL THEN
    INSERT INTO public.equipment_repairs (equipment_id, issue_description, severity, reported_by_id, status)
    VALUES (v_eq_id, COALESCE(p_condition_notes, 'damage reported on return'), 'major', public.current_profile_id(), 'reported');

    UPDATE public.equipment SET status = 'repair' WHERE id = v_eq_id;
  END IF;
END;
$$;

-- ── §5 kit-suggestion RPC ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_suggest_kit_for_equipment(p_equipment_id uuid)
RETURNS TABLE(
  suggestion_id      uuid,
  suggested_item_id  uuid,
  suggested_group_id uuid,
  quantity           int,
  importance         text,
  reason_ar          text
) LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ks.id, ks.suggested_item_id, ks.suggested_item_group_id, ks.quantity, ks.importance, ks.reason_ar
  FROM public.kit_suggestions ks
  JOIN public.equipment e ON e.id = p_equipment_id
  WHERE ks.primary_equipment_group_id = e.group_id
  ORDER BY
    CASE ks.importance WHEN 'mandatory' THEN 1 WHEN 'recommended' THEN 2 ELSE 3 END,
    ks.position;
$$;

-- ── §6 repair workflow: auto-flip equipment.status on severity='unusable' ────

CREATE OR REPLACE FUNCTION public.fn_repair_status_sync()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.severity = 'unusable' THEN
    UPDATE public.equipment SET status = 'repair' WHERE id = NEW.equipment_id;
  ELSIF TG_OP = 'UPDATE'
    AND OLD.returned_at IS NULL
    AND NEW.returned_at IS NOT NULL THEN
    UPDATE public.equipment SET status = 'available' WHERE id = NEW.equipment_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_repair_status_sync ON public.equipment_repairs;
CREATE TRIGGER tg_repair_status_sync
  AFTER INSERT OR UPDATE OF returned_at ON public.equipment_repairs
  FOR EACH ROW EXECUTE FUNCTION public.fn_repair_status_sync();

-- ── audit + RLS on new tables ────────────────────────────────────────────────

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'compatibility_rules','compatibility_feedback','kit_suggestions','equipment_repairs'
  ])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%I_audit ON public.%I; ' ||
      'CREATE TRIGGER trg_%I_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I ' ||
      'FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row_change();',
      t, t, t, t
    );
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I; '
      || 'CREATE POLICY %I ON public.%I FOR SELECT '
      || 'USING (auth.role() = ''authenticated'' OR public.is_admin_caller());',
      t || '_read', t, t || '_read', t
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I; '
      || 'CREATE POLICY %I ON public.%I FOR ALL '
      || 'USING (public.current_user_has_capability(''equipment_manager'') '
      || '  OR public.current_user_has_permission(''equipment.update'')) '
      || 'WITH CHECK (public.current_user_has_capability(''equipment_manager'') '
      || '  OR public.current_user_has_permission(''equipment.update''));',
      t || '_write', t, t || '_write', t
    );
  END LOOP;
END $$;
