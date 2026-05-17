-- Pillar 2 §4 — Organizations domain.
-- clients (unified brand/dealer/agency), agency_brand_links, contacts,
-- contact_methods, locations (Pillar 16 §D.4).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'client_type') THEN
    CREATE TYPE client_type AS ENUM ('brand', 'dealer', 'agency', 'other');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contact_method_type') THEN
    CREATE TYPE contact_method_type AS ENUM (
      'email', 'phone', 'whatsapp', 'linkedin', 'instagram', 'other'
    );
  END IF;
END $$;

-- ── clients ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.clients (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                        text NOT NULL UNIQUE,
  name_ar                     text NOT NULL,
  name_en                     text,
  legal_name                  text,
  vat_number                  text,
  cr_number                   text,
  client_type                 client_type NOT NULL DEFAULT 'brand',
  is_agency                   boolean NOT NULL DEFAULT false,
  industry                    text,
  country                     text NOT NULL DEFAULT 'SA',
  city                        text,
  address_lines               text,
  website_url                 text,
  logo_url                    text,
  default_payment_terms_key   text,
  average_payment_days        integer,
  trust_score                 integer,
  archived_at                 timestamptz,
  notes                       text,
  custom_fields               jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by                  uuid REFERENCES public.profiles(id),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clients_is_agency_idx ON public.clients (is_agency);
CREATE INDEX IF NOT EXISTS clients_archived_idx  ON public.clients (archived_at) WHERE archived_at IS NOT NULL;

-- ── agency_brand_links (M:N within clients, with self-check) ──────────────────

CREATE TABLE IF NOT EXISTS public.agency_brand_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   uuid NOT NULL REFERENCES public.clients(id),
  brand_id    uuid NOT NULL REFERENCES public.clients(id),
  since_date  text,
  end_date    text,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agency_brand_unique UNIQUE (agency_id, brand_id),
  CONSTRAINT agency_brand_self CHECK (agency_id <> brand_id)
);

-- Reject inserts where the agency side isn't actually an agency, or the brand side IS.
CREATE OR REPLACE FUNCTION public.fn_enforce_agency_brand_roles()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_agency_is_agency boolean;
  v_brand_is_agency  boolean;
BEGIN
  SELECT is_agency INTO v_agency_is_agency FROM public.clients WHERE id = NEW.agency_id;
  SELECT is_agency INTO v_brand_is_agency  FROM public.clients WHERE id = NEW.brand_id;
  IF v_agency_is_agency IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'agency_id % must reference a client with is_agency=true', NEW.agency_id;
  END IF;
  IF v_brand_is_agency IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'brand_id % must reference a client with is_agency=false', NEW.brand_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_enforce_agency_brand_roles ON public.agency_brand_links;
CREATE TRIGGER tg_enforce_agency_brand_roles
  BEFORE INSERT OR UPDATE ON public.agency_brand_links
  FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_agency_brand_roles();

-- ── contacts ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.contacts (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id            uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  full_name            text NOT NULL,
  full_name_ar         text,
  job_title            text,
  job_title_ar         text,
  department           text,
  is_primary           boolean NOT NULL DEFAULT false,
  is_decision_maker    boolean NOT NULL DEFAULT false,
  preferred_language   text DEFAULT 'ar',
  notes                text,
  custom_fields        jsonb NOT NULL DEFAULT '{}'::jsonb,
  archived_at          timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contacts_client_idx ON public.contacts (client_id);

-- ── contact_methods ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.contact_methods (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id        uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  method_type       contact_method_type NOT NULL,
  value             text NOT NULL,
  normalized_value  text NOT NULL,
  is_primary        boolean NOT NULL DEFAULT false,
  verified_at       timestamptz,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contact_method_unique UNIQUE (method_type, normalized_value)
);

CREATE INDEX IF NOT EXISTS contact_methods_contact_idx ON public.contact_methods (contact_id);

-- Auto-normalize email + E.164 phones on insert/update.
CREATE OR REPLACE FUNCTION public.fn_contact_method_normalize()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.method_type = 'email' THEN
    NEW.normalized_value := lower(trim(NEW.value));
  ELSIF NEW.method_type IN ('phone', 'whatsapp') THEN
    -- Strip non-digits except leading + (caller is responsible for valid E.164).
    NEW.normalized_value := regexp_replace(NEW.value, '[^0-9+]', '', 'g');
  ELSE
    NEW.normalized_value := lower(trim(NEW.value));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_contact_method_normalize ON public.contact_methods;
CREATE TRIGGER tg_contact_method_normalize
  BEFORE INSERT OR UPDATE ON public.contact_methods
  FOR EACH ROW EXECUTE FUNCTION public.fn_contact_method_normalize();

-- Talent + freelancer FK to contacts (added now that contacts exists).
ALTER TABLE public.talents
  ADD CONSTRAINT talents_primary_contact_fk
    FOREIGN KEY (primary_contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;

ALTER TABLE public.freelancers
  ADD CONSTRAINT freelancers_primary_contact_fk
    FOREIGN KEY (primary_contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;

-- ── locations (Pillar 16 §D.4) ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.locations (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                     text NOT NULL UNIQUE,
  name_ar                  text NOT NULL,
  name_en                  text,
  client_id                uuid REFERENCES public.clients(id),
  city                     text,
  district                 text,
  address_lines            text,
  country_code             text NOT NULL DEFAULT 'SA',
  coordinates              text,
  geo_fence_id             uuid,  -- FK to geo_fences added in Pillar 9
  best_time_to_shoot       text,
  parking_info             text,
  permit_required          boolean NOT NULL DEFAULT false,
  permit_provider          text,
  known_challenges         text,
  contact_at_location      uuid REFERENCES public.contacts(id),
  inside_building          boolean,
  has_power                boolean,
  has_parking_for_crew     boolean,
  archived_at              timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS locations_client_idx ON public.locations (client_id);
CREATE INDEX IF NOT EXISTS locations_city_idx   ON public.locations (city);
