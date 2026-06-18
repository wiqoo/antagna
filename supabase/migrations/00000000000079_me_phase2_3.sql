-- Personal system phases 2-4: the rest of the second-brain tables.

-- recurring idempotency + link on tasks
ALTER TABLE me_tasks ADD COLUMN IF NOT EXISTS source_key text;
ALTER TABLE me_tasks ADD COLUMN IF NOT EXISTS recurring_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS me_tasks_source_key_uniq
  ON me_tasks(owner_id, source_key) WHERE source_key IS NOT NULL;

-- ── waiting-on ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS me_waiting (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id    uuid REFERENCES me_projects(id) ON DELETE SET NULL,
  what          text NOT NULL,
  who           text,
  since         date NOT NULL DEFAULT current_date,
  follow_up_date date,
  resolved      boolean NOT NULL DEFAULT false,
  resolved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS me_waiting_owner_idx ON me_waiting(owner_id, resolved);

-- ── recurring ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS me_recurring (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id  uuid REFERENCES me_projects(id) ON DELETE SET NULL,
  title       text NOT NULL,
  cadence     text NOT NULL DEFAULT 'daily',   -- daily | weekdays | weekly
  weekday     integer,                          -- 0-6 for weekly (0=Sun)
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS me_recurring_owner_idx ON me_recurring(owner_id, active);

-- ── checklists (per-project, per-stage) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS me_checklist (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES me_projects(id) ON DELETE CASCADE,
  stage      text NOT NULL,
  item       text NOT NULL,
  is_done    boolean NOT NULL DEFAULT false,
  position   integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS me_checklist_project_idx ON me_checklist(project_id, stage);

-- ── deliverables ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS me_deliverables (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES me_projects(id) ON DELETE CASCADE,
  title      text NOT NULL,
  link       text,
  version    integer NOT NULL DEFAULT 1,
  status     text NOT NULL DEFAULT 'pending',  -- pending | approved | revisions
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS me_deliverables_project_idx ON me_deliverables(project_id);

-- ── notes / reference ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS me_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id uuid REFERENCES me_projects(id) ON DELETE SET NULL,
  title      text,
  body       text NOT NULL,
  tags       text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS me_notes_owner_idx ON me_notes(owner_id);

-- ── goals ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS me_goals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title       text NOT NULL,
  type        text NOT NULL DEFAULT 'personal', -- career | personal
  target_date date,
  status      text NOT NULL DEFAULT 'active',    -- active | done
  progress    integer NOT NULL DEFAULT 0,         -- 0-100
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS me_goals_owner_idx ON me_goals(owner_id);

-- ── habits + logs (streaks) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS me_habits (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title      text NOT NULL,
  cadence    text NOT NULL DEFAULT 'daily',
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS me_habit_logs (
  habit_id  uuid NOT NULL REFERENCES me_habits(id) ON DELETE CASCADE,
  owner_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  log_date  date NOT NULL,
  PRIMARY KEY (habit_id, log_date)
);

-- ── time logs ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS me_time_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id uuid REFERENCES me_projects(id) ON DELETE SET NULL,
  task_id    uuid REFERENCES me_tasks(id) ON DELETE SET NULL,
  minutes    integer NOT NULL,
  log_date   date NOT NULL DEFAULT current_date,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS me_time_logs_owner_idx ON me_time_logs(owner_id, log_date);

-- ── reviews (daily/weekly) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS me_reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        text NOT NULL,                    -- daily | weekly
  review_date date NOT NULL,
  content     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, type, review_date)
);
