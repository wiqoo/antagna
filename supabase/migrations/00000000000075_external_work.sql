-- External post-production work module (post.antagna.me — name TBD).
-- Volt outsources post-prod to partner companies/freelancers. Self-contained:
-- partners + jobs + payments + revisions. Reuses external_links (material URLs)
-- and attachments (the uploaded final). Money is tracked DIRECTLY here (not
-- Dafterah). Phase 1 is gated by the normal app login; partner accounts come
-- in phase 2.

-- ── partners (a post-prod vendor: company or individual) ─────────────────────
CREATE TABLE IF NOT EXISTS partners (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text UNIQUE,
  name          text NOT NULL,
  name_ar       text,
  kind          text NOT NULL DEFAULT 'company',   -- company | individual
  specialties   text[] NOT NULL DEFAULT '{}',       -- edit | color | sound | motion | vfx
  contact_name  text,
  contact_email text,
  contact_phone text,
  notes         text,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ── external_jobs (one outsourced post-prod job) ─────────────────────────────
CREATE SEQUENCE IF NOT EXISTS external_jobs_code_seq START 1;

CREATE TABLE IF NOT EXISTS external_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE
                    DEFAULT ('EXT-' || lpad(nextval('external_jobs_code_seq')::text, 4, '0')),
  title           text NOT NULL,
  title_ar        text,
  partner_id      uuid REFERENCES partners(id) ON DELETE SET NULL,
  project_id      uuid REFERENCES projects(id) ON DELETE SET NULL,   -- optional Antagna link
  scope           text,
  brief           text,
  status          text NOT NULL DEFAULT 'draft',  -- draft|in_progress|review|revisions|delivered|cancelled
  brief_sent_at       timestamptz,
  first_draft_due_at  timestamptz,
  final_due_at        timestamptz,
  delivered_at        timestamptz,
  final_attachment_id uuid REFERENCES attachments(id) ON DELETE SET NULL,
  agreed_amount_sar   numeric(12,2),
  notes           text,
  created_by      uuid REFERENCES profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS external_jobs_partner_idx ON external_jobs(partner_id);
CREATE INDEX IF NOT EXISTS external_jobs_status_idx  ON external_jobs(status);

-- ── external_payments (direct money log; remaining = agreed - sum(payments)) ──
CREATE TABLE IF NOT EXISTS external_payments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      uuid NOT NULL REFERENCES external_jobs(id) ON DELETE CASCADE,
  amount_sar  numeric(12,2) NOT NULL,
  paid_at     date NOT NULL DEFAULT current_date,
  method      text NOT NULL DEFAULT 'transfer',  -- transfer | cash | other
  note        text,
  created_by  uuid REFERENCES profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS external_payments_job_idx ON external_payments(job_id);

-- ── external_job_revisions (feedback rounds: Volt note → partner version) ────
CREATE TABLE IF NOT EXISTS external_job_revisions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id                uuid NOT NULL REFERENCES external_jobs(id) ON DELETE CASCADE,
  round_number          integer NOT NULL,
  change_request        text,                 -- Volt's notes
  requested_by          uuid REFERENCES profiles(id),
  requested_at          timestamptz NOT NULL DEFAULT now(),
  version_url           text,                 -- partner's submitted version link
  version_attachment_id uuid REFERENCES attachments(id) ON DELETE SET NULL,
  status                text NOT NULL DEFAULT 'open',  -- open | submitted | approved
  resolved_at           timestamptz,
  UNIQUE (job_id, round_number)
);
CREATE INDEX IF NOT EXISTS external_job_revisions_job_idx ON external_job_revisions(job_id);
