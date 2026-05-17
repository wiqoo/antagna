-- Pillar 2 §9 — Cross-cutting tables (polymorphic).
-- attachments, tags + tag_assignments, custom_field_definitions + values,
-- external_links, notifications + event_types + subscriptions, activity_events.
-- Plus audit_log.acted_as_id (Pillar 1 audit_log gets this column for the
-- "Mohammed acts for Abu Luka" pattern).

-- ── enums ──────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'custom_field_type') THEN
    CREATE TYPE custom_field_type AS ENUM (
      'text','long_text','number','currency','date','datetime','boolean',
      'select','multi_select','url','user_ref','client_ref','project_ref'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'external_link_provider') THEN
    CREATE TYPE external_link_provider AS ENUM (
      'gdrive','gcal','gmail','whatsapp','youtube','vimeo','frameio',
      'instagram','tiktok','x','other'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_channel') THEN
    CREATE TYPE notification_channel AS ENUM ('in_app','email','whatsapp','push');
  END IF;
END $$;

-- ── audit_log extension (acted_as_id for acting-on-behalf) ────────────────────

ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS acted_as_id uuid REFERENCES public.profiles(id);

-- ── attachments (polymorphic) ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.attachments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type       text NOT NULL,
  entity_id         uuid NOT NULL,
  filename          text NOT NULL,
  mime_type         text NOT NULL,
  size_bytes        bigint NOT NULL,
  storage_provider  text NOT NULL,    -- 'supabase' | 'gdrive' | 'external_url'
  storage_path      text,
  external_url      text,
  thumbnail_url     text,
  uploaded_by_id    uuid REFERENCES public.profiles(id),
  description       text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS attachments_entity_idx ON public.attachments (entity_type, entity_id);

-- ── tags + tag_assignments ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tags (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key               text NOT NULL UNIQUE,
  name_ar           text NOT NULL,
  name_en           text,
  color             text,
  category          text,
  scope_entity_type text,
  active            boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.tag_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id          uuid NOT NULL REFERENCES public.tags(id),
  entity_type     text NOT NULL,
  entity_id       uuid NOT NULL,
  assigned_by_id  uuid REFERENCES public.profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tag_assignment_unique UNIQUE (tag_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS tag_assignments_entity_idx ON public.tag_assignments (entity_type, entity_id);

-- ── custom fields ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.custom_field_definitions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  text NOT NULL,
  key          text NOT NULL,
  label_ar     text NOT NULL,
  label_en     text,
  field_type   custom_field_type NOT NULL,
  options      jsonb DEFAULT '{}'::jsonb,
  required     boolean NOT NULL DEFAULT false,
  position     integer NOT NULL DEFAULT 0,
  active       boolean NOT NULL DEFAULT true,
  CONSTRAINT cf_def_unique UNIQUE (entity_type, key)
);

CREATE TABLE IF NOT EXISTS public.custom_field_values (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id  uuid NOT NULL REFERENCES public.custom_field_definitions(id),
  entity_type    text NOT NULL,
  entity_id      uuid NOT NULL,
  value_text     text,
  value_number   numeric(18,4),
  value_date     text,
  value_boolean  boolean,
  value_json     jsonb,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cf_value_unique UNIQUE (definition_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS cf_values_entity_idx ON public.custom_field_values (entity_type, entity_id);

-- ── external_links (polymorphic) ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.external_links (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  text NOT NULL,
  entity_id    uuid NOT NULL,
  provider     external_link_provider NOT NULL,
  external_id  text,
  url          text NOT NULL,
  label        text,
  metadata     jsonb DEFAULT '{}'::jsonb,
  is_primary   boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT external_link_unique UNIQUE (provider, external_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS external_links_entity_idx ON public.external_links (entity_type, entity_id);

-- ── notifications ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notification_event_types (
  key              text PRIMARY KEY,
  name_ar          text NOT NULL,
  name_en          text,
  category         text,
  default_on       boolean NOT NULL DEFAULT true,
  default_channels text[] NOT NULL DEFAULT ARRAY['in_app']::text[]
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id                  bigserial PRIMARY KEY,
  recipient_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type_key      text REFERENCES public.notification_event_types(key),
  entity_type         text,
  entity_id           uuid,
  title               text NOT NULL,
  body                text,
  link_url            text,
  metadata            jsonb DEFAULT '{}'::jsonb,
  channels_requested  text[] NOT NULL,
  channels_delivered  text[] NOT NULL DEFAULT ARRAY[]::text[],
  read_at             timestamptz,
  snoozed_until       timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_recipient_idx
  ON public.notifications (recipient_id, read_at NULLS FIRST, created_at DESC);

CREATE TABLE IF NOT EXISTS public.notification_subscriptions (
  profile_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type_key    text NOT NULL REFERENCES public.notification_event_types(key),
  channels          text[] NOT NULL,
  muted             boolean NOT NULL DEFAULT false,
  quiet_hours_start text,
  quiet_hours_end   text,
  PRIMARY KEY (profile_id, event_type_key)
);

-- ── activity_events ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.activity_events (
  id           bigserial PRIMARY KEY,
  actor_id     uuid REFERENCES public.profiles(id),
  acted_as_id  uuid REFERENCES public.profiles(id),
  entity_type  text NOT NULL,
  entity_id    uuid,
  project_id   uuid REFERENCES public.projects(id),
  action       text NOT NULL,
  summary_ar   text NOT NULL,
  summary_en   text,
  metadata     jsonb DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_by_project ON public.activity_events (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_by_actor   ON public.activity_events (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_by_entity  ON public.activity_events (entity_type, entity_id);

-- ── audit + updated_at triggers ──────────────────────────────────────────────

DO $$
DECLARE
  t text;
  has_updated_at boolean;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'attachments','tags','tag_assignments',
    'custom_field_definitions','custom_field_values',
    'external_links','notification_event_types',
    'notifications','notification_subscriptions','activity_events'
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
    'attachments','tags','tag_assignments',
    'custom_field_definitions','custom_field_values',
    'external_links','notification_event_types',
    'notification_subscriptions','activity_events'
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

-- ── notifications: read self only, no public read; writes via service-role ───

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_self_read ON public.notifications;
CREATE POLICY notifications_self_read ON public.notifications
  FOR SELECT USING (recipient_id = public.current_profile_id() OR public.is_admin_caller());

DROP POLICY IF EXISTS notifications_self_update ON public.notifications;
CREATE POLICY notifications_self_update ON public.notifications
  FOR UPDATE USING (recipient_id = public.current_profile_id())
  WITH CHECK (recipient_id = public.current_profile_id());

-- notification_subscriptions: self read + self write
DROP POLICY IF EXISTS notification_subscriptions_self ON public.notification_subscriptions;
CREATE POLICY notification_subscriptions_self ON public.notification_subscriptions
  FOR ALL USING (profile_id = public.current_profile_id() OR public.is_admin_caller())
  WITH CHECK (profile_id = public.current_profile_id() OR public.is_admin_caller());

-- tag_assignments: write = any authenticated (cheap labelling)
DROP POLICY IF EXISTS tag_assignments_write ON public.tag_assignments;
CREATE POLICY tag_assignments_write ON public.tag_assignments
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
