-- Pillar 2 §7-§8: Money (schema-only per D-022) + Equipment + Pillar 16 §D.5.

-- ── enums ──────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quote_status') THEN
    CREATE TYPE quote_status AS ENUM ('draft','sent','accepted','rejected','expired','superseded');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
    CREATE TYPE invoice_status AS ENUM ('draft','issued','partially_paid','paid','overdue','cancelled','written_off');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'equipment_tracking_mode') THEN
    CREATE TYPE equipment_tracking_mode AS ENUM ('unit','bulk');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'equipment_status') THEN
    CREATE TYPE equipment_status AS ENUM ('available','checked_out','repair','lost','retired');
  END IF;
END $$;

-- ── sequences + code generators ───────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS quote_code_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS invoice_code_seq START WITH 1;

CREATE OR REPLACE FUNCTION public.fn_next_quote_code()
RETURNS text LANGUAGE sql AS $$
  SELECT 'QUO-' || LPAD(nextval('quote_code_seq')::text, 4, '0');
$$;

CREATE OR REPLACE FUNCTION public.fn_next_invoice_code()
RETURNS text LANGUAGE sql AS $$
  SELECT 'INV-' || LPAD(nextval('invoice_code_seq')::text, 5, '0');
$$;

-- ── quotes + quote_line_items ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.quotes (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code               text NOT NULL UNIQUE DEFAULT public.fn_next_quote_code(),
  project_id         uuid REFERENCES public.projects(id),
  client_id          uuid NOT NULL REFERENCES public.clients(id),
  status             quote_status NOT NULL DEFAULT 'draft',
  version            integer NOT NULL DEFAULT 1,
  parent_quote_id    uuid,
  subtotal_sar       numeric(12,2) NOT NULL DEFAULT 0,
  discount_sar       numeric(12,2) NOT NULL DEFAULT 0,
  vat_rate           numeric(5,4)  NOT NULL DEFAULT 0.15,
  vat_sar            numeric(12,2) NOT NULL DEFAULT 0,
  total_sar          numeric(12,2) NOT NULL DEFAULT 0,
  issued_at          timestamptz,
  valid_until_at     timestamptz,
  sent_at            timestamptz,
  accepted_at        timestamptz,
  payment_terms_text text,
  pdf_url            text,
  notes              text,
  created_by         uuid REFERENCES public.profiles(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quotes
  ADD CONSTRAINT quotes_parent_quote_fk
    FOREIGN KEY (parent_quote_id) REFERENCES public.quotes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS quotes_client_idx  ON public.quotes (client_id);
CREATE INDEX IF NOT EXISTS quotes_project_idx ON public.quotes (project_id);
CREATE INDEX IF NOT EXISTS quotes_status_idx  ON public.quotes (status);

CREATE TABLE IF NOT EXISTS public.quote_line_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id        uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  position        integer NOT NULL DEFAULT 0,
  description     text NOT NULL,
  quantity        numeric(10,2) NOT NULL DEFAULT 1,
  unit_price_sar  numeric(12,2) NOT NULL DEFAULT 0,
  total_sar       numeric(12,2) NOT NULL DEFAULT 0,
  category        text
);

CREATE INDEX IF NOT EXISTS qli_quote_idx ON public.quote_line_items (quote_id);

-- ── invoices + invoice_line_items + payments ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.invoices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL UNIQUE DEFAULT public.fn_next_invoice_code(),
  project_id    uuid REFERENCES public.projects(id),
  client_id     uuid NOT NULL REFERENCES public.clients(id),
  quote_id      uuid REFERENCES public.quotes(id),
  status        invoice_status NOT NULL DEFAULT 'draft',
  issued_at     timestamptz,
  due_at        timestamptz,
  paid_at       timestamptz,
  subtotal_sar  numeric(12,2) NOT NULL DEFAULT 0,
  vat_sar       numeric(12,2) NOT NULL DEFAULT 0,
  total_sar     numeric(12,2) NOT NULL DEFAULT 0,
  paid_sar      numeric(12,2) NOT NULL DEFAULT 0,
  zatca_uuid    text,
  zatca_hash    text,
  zatca_qr_url  text,
  pdf_url       text,
  notes         text,
  created_by    uuid REFERENCES public.profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoices_client_idx  ON public.invoices (client_id);
CREATE INDEX IF NOT EXISTS invoices_project_idx ON public.invoices (project_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx  ON public.invoices (status);
CREATE INDEX IF NOT EXISTS invoices_due_idx     ON public.invoices (due_at);

CREATE TABLE IF NOT EXISTS public.invoice_line_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  position        integer NOT NULL DEFAULT 0,
  description     text NOT NULL,
  quantity        numeric(10,2) NOT NULL DEFAULT 1,
  unit_price_sar  numeric(12,2) NOT NULL DEFAULT 0,
  total_sar       numeric(12,2) NOT NULL DEFAULT 0,
  category        text
);

CREATE TABLE IF NOT EXISTS public.payments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id       uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount_sar       numeric(12,2) NOT NULL,
  received_at      timestamptz NOT NULL,
  method           text,
  reference_number text,
  received_by_id   uuid REFERENCES public.profiles(id),
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payments_invoice_idx ON public.payments (invoice_id);

-- ── invoice payment-rollup trigger ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_invoice_recompute_payments()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_invoice_id uuid;
  v_total numeric(12,2);
  v_paid  numeric(12,2);
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  SELECT total_sar INTO v_total FROM public.invoices WHERE id = v_invoice_id;
  SELECT COALESCE(SUM(amount_sar), 0) INTO v_paid FROM public.payments WHERE invoice_id = v_invoice_id;

  UPDATE public.invoices
  SET paid_sar = v_paid,
      paid_at  = CASE WHEN v_paid >= v_total THEN COALESCE(paid_at, now()) ELSE NULL END,
      status   = CASE
                   WHEN v_paid >= v_total THEN 'paid'::invoice_status
                   WHEN v_paid > 0        THEN 'partially_paid'::invoice_status
                   ELSE status
                 END
  WHERE id = v_invoice_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS tg_invoice_recompute_payments ON public.payments;
CREATE TRIGGER tg_invoice_recompute_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.fn_invoice_recompute_payments();

-- ── quote totals-from-lines trigger ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_quote_recompute_totals()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_quote_id uuid;
  v_subtotal numeric(12,2);
  v_discount numeric(12,2);
  v_vat_rate numeric(5,4);
BEGIN
  v_quote_id := COALESCE(NEW.quote_id, OLD.quote_id);
  SELECT COALESCE(SUM(total_sar), 0) INTO v_subtotal
    FROM public.quote_line_items WHERE quote_id = v_quote_id;
  SELECT discount_sar, vat_rate INTO v_discount, v_vat_rate
    FROM public.quotes WHERE id = v_quote_id;

  UPDATE public.quotes
  SET subtotal_sar = v_subtotal,
      vat_sar      = (v_subtotal - v_discount) * v_vat_rate,
      total_sar    = (v_subtotal - v_discount) * (1 + v_vat_rate)
  WHERE id = v_quote_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS tg_quote_recompute_totals ON public.quote_line_items;
CREATE TRIGGER tg_quote_recompute_totals
  AFTER INSERT OR UPDATE OR DELETE ON public.quote_line_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_quote_recompute_totals();

-- ══════════════════════════════════════════════════════════════════════════════
-- EQUIPMENT
-- ══════════════════════════════════════════════════════════════════════════════

-- ── equipment_groups ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.equipment_groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,
  name_ar     text NOT NULL,
  name_en     text,
  category    text,
  description text
);

CREATE INDEX IF NOT EXISTS equipment_groups_category_idx ON public.equipment_groups (category);

-- ── equipment ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.equipment (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                     text NOT NULL UNIQUE,
  group_id                 uuid REFERENCES public.equipment_groups(id),

  category                 text NOT NULL,
  manufacturer             text,
  model                    text NOT NULL,
  model_name_ar            text,
  serial_number            text,

  tracking_mode            equipment_tracking_mode NOT NULL DEFAULT 'unit',
  quantity_total           integer NOT NULL DEFAULT 1,

  status                   equipment_status NOT NULL DEFAULT 'available',
  current_location         text NOT NULL DEFAULT 'warehouse',

  purchase_date            text,
  purchase_price_sar       numeric(12,2),
  insurance_value_sar      numeric(12,2),
  warranty_until           text,

  depreciation_method      text,
  useful_life_months       integer,
  current_book_value_sar   numeric(12,2),

  requires_charging        boolean NOT NULL DEFAULT false,
  last_charged_at          timestamptz,

  photo_url                text,
  manual_url               text,
  specs                    jsonb NOT NULL DEFAULT '{}'::jsonb,

  is_kit_item              boolean NOT NULL DEFAULT false,
  parent_kit_id            uuid,

  notes                    text,
  archived_at              timestamptz,

  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS equipment_group_idx   ON public.equipment (group_id);
CREATE INDEX IF NOT EXISTS equipment_status_idx  ON public.equipment (status);
CREATE INDEX IF NOT EXISTS equipment_category_idx ON public.equipment (category);

-- Code-generator (per-prefix) helper.
CREATE OR REPLACE FUNCTION public.fn_next_equipment_code(prefix_in text)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE max_n int;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM '\d+$') AS int)), 0)
    INTO max_n
    FROM public.equipment WHERE code LIKE prefix_in || '-%';
  RETURN prefix_in || '-' || LPAD((max_n + 1)::text, 3, '0');
END;
$$;

-- ── kits + kit_items ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.kits (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                 text NOT NULL UNIQUE,
  name_ar              text NOT NULL,
  name_en              text,
  description          text,
  primary_equipment_id uuid REFERENCES public.equipment(id),
  active               boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.kit_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id              uuid NOT NULL REFERENCES public.kits(id) ON DELETE CASCADE,
  equipment_id        uuid REFERENCES public.equipment(id),
  equipment_group_id  uuid REFERENCES public.equipment_groups(id),
  quantity            integer NOT NULL DEFAULT 1,
  is_mandatory        boolean NOT NULL DEFAULT false,
  position            integer NOT NULL DEFAULT 0,
  notes               text
);

-- equipment.parent_kit_id FK now that kits exists.
ALTER TABLE public.equipment
  ADD CONSTRAINT equipment_parent_kit_fk
    FOREIGN KEY (parent_kit_id) REFERENCES public.kits(id) ON DELETE SET NULL;

-- ── equipment_reservations + exclusion constraint ─────────────────────────────

CREATE TABLE IF NOT EXISTS public.equipment_reservations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id    uuid REFERENCES public.equipment(id),
  group_id        uuid REFERENCES public.equipment_groups(id),
  project_id      uuid REFERENCES public.projects(id),
  starts_at       timestamptz NOT NULL,
  ends_at         timestamptz NOT NULL,
  reserved_by_id  uuid REFERENCES public.profiles(id),
  status          text NOT NULL DEFAULT 'reserved',
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reservation_target CHECK (equipment_id IS NOT NULL OR group_id IS NOT NULL),
  CONSTRAINT reservation_time   CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS reservations_equipment_idx ON public.equipment_reservations (equipment_id);
CREATE INDEX IF NOT EXISTS reservations_group_idx     ON public.equipment_reservations (group_id);
CREATE INDEX IF NOT EXISTS reservations_project_idx   ON public.equipment_reservations (project_id);
CREATE INDEX IF NOT EXISTS reservations_time_idx      ON public.equipment_reservations (starts_at, ends_at);

-- Exclusion constraint: no overlap for the same unit while reserved/checked_out.
ALTER TABLE public.equipment_reservations
  DROP CONSTRAINT IF EXISTS no_overlap_per_unit;

ALTER TABLE public.equipment_reservations
  ADD CONSTRAINT no_overlap_per_unit
  EXCLUDE USING gist (
    equipment_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (equipment_id IS NOT NULL AND status IN ('reserved', 'checked_out'));

-- ── equipment_activity_log ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.equipment_activity_log (
  id            bigserial PRIMARY KEY,
  equipment_id  uuid NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  event_type    text NOT NULL,
  summary       text,
  metadata      jsonb DEFAULT '{}'::jsonb,
  actor_id      uuid REFERENCES public.profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS eq_activity_equipment_idx
  ON public.equipment_activity_log (equipment_id, created_at DESC);

-- ── equipment_profiles (Pillar 16 §D.5) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.equipment_profiles (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id             uuid NOT NULL REFERENCES public.equipment(id),
  context_type             text NOT NULL,
  context_id               uuid,
  context_label            text,
  recommended_settings     jsonb,
  known_issues             text,
  notes                    text,
  derived_from_project_ids uuid[],
  active                   boolean NOT NULL DEFAULT true,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS eq_profiles_equipment_idx ON public.equipment_profiles (equipment_id);
CREATE INDEX IF NOT EXISTS eq_profiles_context_idx   ON public.equipment_profiles (context_type, context_id);

-- ── audit + updated_at on all stage-3 tables ──────────────────────────────────

DO $$
DECLARE
  t text;
  has_updated_at boolean;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'quotes','quote_line_items','invoices','invoice_line_items','payments',
    'equipment_groups','equipment','kits','kit_items',
    'equipment_reservations','equipment_activity_log','equipment_profiles'
  ])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%I_audit ON public.%I; ' ||
      'CREATE TRIGGER trg_%I_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I ' ||
      'FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row_change();',
      t, t, t, t
    );

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'updated_at'
    ) INTO has_updated_at;

    IF has_updated_at THEN
      EXECUTE format(
        'DROP TRIGGER IF EXISTS trg_%I_touch_updated_at ON public.%I; ' ||
        'CREATE TRIGGER trg_%I_touch_updated_at BEFORE UPDATE ON public.%I ' ||
        'FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();',
        t, t, t, t
      );
    END IF;
  END LOOP;
END $$;

-- ── RLS ──────────────────────────────────────────────────────────────────────

DO $$ DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'quotes','quote_line_items','invoices','invoice_line_items','payments',
    'equipment_groups','equipment','kits','kit_items',
    'equipment_reservations','equipment_activity_log','equipment_profiles'
  ])
  LOOP
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
      || 'USING (public.is_admin_caller()) WITH CHECK (public.is_admin_caller());',
      t || '_admin_write', t, t || '_admin_write', t
    );
  END LOOP;
END $$;
