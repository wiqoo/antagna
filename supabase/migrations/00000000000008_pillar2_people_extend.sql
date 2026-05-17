-- Pillar 2 §3 — extend profiles + add people-domain tables.
--
-- Pillar 1 created a minimal profiles table (id, auth_user_id, email, full_name,
-- full_name_ar, role, active, created_at, updated_at). Pillar 2 expands it with
-- display_name / display_name_en / legal_name, status enum, acting_for_id,
-- workspace fields, preferences.
--
-- Old columns (full_name, full_name_ar, active) are kept for backwards
-- compatibility through this migration and dropped in §6 when no readers remain.

-- ── enums ──────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'person_status') THEN
    CREATE TYPE person_status AS ENUM ('active', 'inactive', 'on_leave', 'terminated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'talent_contract_type') THEN
    CREATE TYPE talent_contract_type AS ENUM (
      'exclusive', 'non_exclusive', 'project_based', 'ad_hoc', 'unsigned_potential'
    );
  END IF;
END $$;

-- ── profiles: add new columns + backfill from full_name / full_name_ar / active ─

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name        text,
  ADD COLUMN IF NOT EXISTS display_name_en     text,
  ADD COLUMN IF NOT EXISTS legal_name          text,
  ADD COLUMN IF NOT EXISTS status              person_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS acting_for_id       uuid,
  ADD COLUMN IF NOT EXISTS phone_e164          text,
  ADD COLUMN IF NOT EXISTS whatsapp_e164       text,
  ADD COLUMN IF NOT EXISTS avatar_url          text,
  ADD COLUMN IF NOT EXISTS department_id       uuid,
  ADD COLUMN IF NOT EXISTS reports_to_id       uuid,
  ADD COLUMN IF NOT EXISTS ui_language         text NOT NULL DEFAULT 'ar',
  ADD COLUMN IF NOT EXISTS timezone            text NOT NULL DEFAULT 'Asia/Riyadh',
  ADD COLUMN IF NOT EXISTS notification_prefs  jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS archived_at         timestamptz;

-- Backfill display_name from existing data (full_name_ar preferred, fallback to full_name).
UPDATE public.profiles
SET display_name = COALESCE(NULLIF(full_name_ar, ''), full_name)
WHERE display_name IS NULL;

UPDATE public.profiles
SET display_name_en = full_name
WHERE display_name_en IS NULL AND full_name IS NOT NULL;

-- status from old `active` boolean (only if active column still exists).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='profiles' AND column_name='active') THEN
    UPDATE public.profiles
    SET status = CASE WHEN active THEN 'active'::person_status ELSE 'inactive'::person_status END;
  END IF;
END $$;

-- Now require display_name.
ALTER TABLE public.profiles ALTER COLUMN display_name SET NOT NULL;

-- Drop the legacy columns (full_name, full_name_ar, active) — no readers left after
-- this migration applies.
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS full_name,
  DROP COLUMN IF EXISTS full_name_ar,
  DROP COLUMN IF EXISTS active;

-- Self-FK for reports_to + acting_for + department_id (department FK added after
-- departments table exists below).
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_reports_to_fk
    FOREIGN KEY (reports_to_id) REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD CONSTRAINT profiles_acting_for_fk
    FOREIGN KEY (acting_for_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ── employees (1:1 with profiles, HR fields) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.employees (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id              uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  national_id             text,
  national_id_type        text,                       -- 'saudi' | 'iqama' | 'visitor'
  nationality             text,
  job_title               text,
  hire_date               text,
  end_date                text,
  employment_type         text,
  monthly_salary          integer,
  monthly_salary_currency text DEFAULT 'SAR',
  is_freelancer           boolean NOT NULL DEFAULT false,
  can_be_shooter          boolean NOT NULL DEFAULT false,
  can_be_editor           boolean NOT NULL DEFAULT false,
  can_be_pilot            boolean NOT NULL DEFAULT false,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- ── capabilities (catalog) + user_capabilities (M:N) ───────────────────────────

CREATE TABLE IF NOT EXISTS public.capabilities (
  key         text PRIMARY KEY,
  name_ar     text NOT NULL,
  name_en     text NOT NULL,
  category    text,                                  -- 'production' | 'post' | 'business' | 'admin'
  description text,
  icon_key    text,
  active      boolean NOT NULL DEFAULT true,
  position    integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.user_capabilities (
  profile_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  capability_key  text NOT NULL REFERENCES public.capabilities(key),
  is_primary      boolean NOT NULL DEFAULT false,
  proficiency     integer NOT NULL DEFAULT 2,
  notes           text,
  added_by        uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, capability_key)
);

-- ── skills + user_skills ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.skills (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key             text NOT NULL UNIQUE,
  name_ar         text NOT NULL,
  name_en         text NOT NULL,
  category        text,
  parent_skill_id uuid REFERENCES public.skills(id),
  active          boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.user_skills (
  profile_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_id         uuid NOT NULL REFERENCES public.skills(id),
  level            integer NOT NULL DEFAULT 1,
  years_experience integer,
  certified_at     timestamptz,
  notes            text,
  PRIMARY KEY (profile_id, skill_id)
);

-- ── departments + work_calendar_defaults ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.departments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,
  name_ar         text NOT NULL,
  name_en         text NOT NULL,
  head_profile_id uuid REFERENCES public.profiles(id),
  position        integer NOT NULL DEFAULT 0
);

-- profiles.department_id FK now that departments exists
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_department_fk
    FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.work_calendar_defaults (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  working_days   text[] NOT NULL DEFAULT ARRAY['sun','mon','tue','wed','thu']::text[],
  day_start_time text NOT NULL DEFAULT '09:00',
  day_end_time   text NOT NULL DEFAULT '18:00',
  timezone       text NOT NULL DEFAULT 'Asia/Riyadh'
);

-- ── squads + squad_members (project_squad_assignments comes with projects) ─────

CREATE TABLE IF NOT EXISTS public.squads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,
  name_ar     text NOT NULL,
  name_en     text,
  purpose     text,
  active      boolean NOT NULL DEFAULT true,
  created_by  uuid REFERENCES public.profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.squad_members (
  squad_id     uuid NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  profile_id   uuid NOT NULL REFERENCES public.profiles(id),
  default_role text,
  is_core      boolean NOT NULL DEFAULT true,
  notes        text,
  PRIMARY KEY (squad_id, profile_id)
);

-- ── talents (Pillar 16 §D.2) ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.talents (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  text NOT NULL UNIQUE,
  display_name          text NOT NULL,
  display_name_en       text,
  legal_name            text,
  national_id_last4     text,
  contract_type         talent_contract_type NOT NULL DEFAULT 'project_based',
  commission_pct        numeric(5,2),
  signed_contract_at    text,
  primary_contact_id    uuid,
  phone_e164            text,
  whatsapp_e164         text,
  category              text,
  niches                text[],
  languages             text[],
  city_base             text,
  preferences           jsonb,
  payout_method_ref     text,
  active                boolean NOT NULL DEFAULT true,
  archived_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- ── freelancers (Pillar 16 §D.3) ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.freelancers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                text NOT NULL UNIQUE,
  full_name           text NOT NULL,
  full_name_ar        text,
  primary_contact_id  uuid,
  phone_e164          text,
  email_primary       text,
  specialties         text[],
  city_base           text,
  default_rate_sar    numeric(10,2),
  default_rate_unit   text,
  payout_method_ref   text,
  tax_id              text,
  projects_completed  integer NOT NULL DEFAULT 0,
  average_rating      numeric(3,2),
  last_worked_at      timestamptz,
  preferred           boolean NOT NULL DEFAULT false,
  notes               text,
  active              boolean NOT NULL DEFAULT true,
  archived_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ── update the auth-user → profile trigger from Pillar 1 to the new column shape

CREATE OR REPLACE FUNCTION public.fn_on_auth_user_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_display text;
BEGIN
  v_email := NEW.email;
  v_display := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'name',
    split_part(v_email, '@', 1)
  );

  INSERT INTO public.profiles (auth_user_id, email, display_name, role, status)
  VALUES (NEW.id, v_email, v_display, 'user', 'active'::person_status)
  ON CONFLICT (email) DO UPDATE
    SET auth_user_id = EXCLUDED.auth_user_id
    WHERE public.profiles.auth_user_id IS NULL;

  RETURN NEW;
END;
$$;
