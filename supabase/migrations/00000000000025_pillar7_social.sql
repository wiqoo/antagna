-- Pillar 7 — Social Media Module: managed_accounts, content_posts (with
-- POST-NNNN seq), post_analytics_snapshots, sponsored_deals.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'social_platform') THEN
    CREATE TYPE social_platform AS ENUM ('instagram','tiktok','youtube','x','snapchat','linkedin','facebook');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'post_status') THEN
    CREATE TYPE post_status AS ENUM ('idea','drafting','in_review','scheduled','published','promoted','archived','cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'post_format') THEN
    CREATE TYPE post_format AS ENUM ('feed_image','feed_carousel','feed_video','reel','story','short','long_form_video','live','text');
  END IF;
END $$;

CREATE SEQUENCE IF NOT EXISTS post_code_seq START 1;
CREATE SEQUENCE IF NOT EXISTS sponsored_code_seq START 1;

CREATE OR REPLACE FUNCTION public.fn_next_post_code() RETURNS text LANGUAGE sql AS $$
  SELECT 'POST-' || LPAD(nextval('post_code_seq')::text, 4, '0');
$$;
CREATE OR REPLACE FUNCTION public.fn_next_sponsored_code() RETURNS text LANGUAGE sql AS $$
  SELECT 'SPNS-' || LPAD(nextval('sponsored_code_seq')::text, 4, '0');
$$;

CREATE TABLE IF NOT EXISTS public.managed_accounts (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                 text NOT NULL UNIQUE,
  owner_label          text NOT NULL,
  owner_profile_id     uuid REFERENCES public.profiles(id),
  owner_client_id      uuid REFERENCES public.clients(id),
  owner_talent_id      uuid REFERENCES public.talents(id),

  platform             social_platform NOT NULL,
  handle               text NOT NULL,
  external_account_id  text,

  access_type          text NOT NULL,
  oauth_token_ref      text,

  follower_count       integer,
  posts_count_lifetime integer,
  last_synced_at       timestamptz,

  active               boolean NOT NULL DEFAULT true,
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT managed_accounts_owner_at_least_one
    CHECK (owner_profile_id IS NOT NULL OR owner_client_id IS NOT NULL OR owner_talent_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS ma_platform_idx ON public.managed_accounts (platform);
CREATE INDEX IF NOT EXISTS ma_owner_profile_idx ON public.managed_accounts (owner_profile_id);
CREATE INDEX IF NOT EXISTS ma_owner_talent_idx  ON public.managed_accounts (owner_talent_id);

CREATE TABLE IF NOT EXISTS public.content_posts (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                 text NOT NULL UNIQUE DEFAULT public.fn_next_post_code(),
  account_id           uuid NOT NULL REFERENCES public.managed_accounts(id),

  title                text NOT NULL,
  caption              text,
  format               post_format NOT NULL,
  status               post_status NOT NULL DEFAULT 'idea',

  project_id           uuid REFERENCES public.projects(id),
  client_id            uuid REFERENCES public.clients(id),
  drive_folder_id      text,

  planned_publish_at   timestamptz,
  published_at         timestamptz,
  external_post_id     text,
  external_post_url    text,

  metrics_cached_at    timestamptz,
  views                bigint,
  likes                integer,
  comments             integer,
  shares               integer,
  saves                integer,
  reach_unique         integer,
  engagement_rate      numeric(5,4),

  created_by_id        uuid REFERENCES public.profiles(id),
  editor_id            uuid REFERENCES public.profiles(id),
  shooter_id           uuid REFERENCES public.profiles(id),

  hashtags             text[],
  mentions             text[],
  notes                text,

  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cp_account_idx          ON public.content_posts (account_id);
CREATE INDEX IF NOT EXISTS cp_status_idx           ON public.content_posts (status);
CREATE INDEX IF NOT EXISTS cp_planned_publish_idx  ON public.content_posts (planned_publish_at);
CREATE INDEX IF NOT EXISTS cp_published_idx        ON public.content_posts (published_at DESC);
CREATE INDEX IF NOT EXISTS cp_project_idx          ON public.content_posts (project_id);

CREATE TABLE IF NOT EXISTS public.post_analytics_snapshots (
  id            bigserial PRIMARY KEY,
  post_id       uuid NOT NULL REFERENCES public.content_posts(id) ON DELETE CASCADE,
  captured_at   timestamptz NOT NULL DEFAULT now(),
  views         bigint,
  likes         integer,
  comments      integer,
  shares        integer,
  saves         integer,
  reach_unique  integer,
  raw_payload   jsonb
);

CREATE INDEX IF NOT EXISTS snapshots_by_post_time
  ON public.post_analytics_snapshots (post_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS public.sponsored_deals (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                 text NOT NULL UNIQUE DEFAULT public.fn_next_sponsored_code(),
  account_id           uuid NOT NULL REFERENCES public.managed_accounts(id),
  sponsor_client_id    uuid REFERENCES public.clients(id),

  deal_type            text NOT NULL,
  contract_value_sar   numeric(12,2),
  deliverables_count   integer,
  usage_rights_text    text,

  status               text NOT NULL DEFAULT 'draft',
  starts_at            timestamptz,
  ends_at              timestamptz,

  project_id           uuid REFERENCES public.projects(id),
  invoice_id           uuid REFERENCES public.invoices(id),

  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- ── pg_notify on publish — Pillar 13 listens to schedule analytics captures ──

CREATE OR REPLACE FUNCTION public.fn_queue_analytics_captures()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'published' THEN
    PERFORM pg_notify('content_post_published', json_build_object('post_id', NEW.id)::text);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_queue_analytics ON public.content_posts;
CREATE TRIGGER tg_queue_analytics
  AFTER UPDATE OF status ON public.content_posts
  FOR EACH ROW EXECUTE FUNCTION public.fn_queue_analytics_captures();

-- ── audit + updated_at + RLS ─────────────────────────────────────────────────

DO $$
DECLARE
  t text;
  has_updated_at boolean;
BEGIN
  FOR t IN SELECT unnest(ARRAY['managed_accounts','content_posts','post_analytics_snapshots','sponsored_deals'])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%I_audit ON public.%I; ' ||
      'CREATE TRIGGER trg_%I_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I ' ||
      'FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row_change();',
      t, t, t, t
    );
    SELECT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name=t AND column_name='updated_at') INTO has_updated_at;
    IF has_updated_at THEN
      EXECUTE format(
        'DROP TRIGGER IF EXISTS trg_%I_touch_updated_at ON public.%I; ' ||
        'CREATE TRIGGER trg_%I_touch_updated_at BEFORE UPDATE ON public.%I ' ||
        'FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();',
        t, t, t, t
      );
    END IF;
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
