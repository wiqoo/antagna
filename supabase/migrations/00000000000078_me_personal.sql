-- Mohammed's personal "second brain" system (me.antagna.me / route /me).
-- Single-user, standalone surface on the shared DB. Tables are owner-scoped
-- (owner_id → profiles) and prefixed me_ so they're clearly separate from the
-- Antagna domain tables. Phase 1 (MVP): capture/inbox + projects + tasks.

-- ── projects ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS me_projects (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title      text NOT NULL,
  type       text NOT NULL DEFAULT 'work',     -- work | personal
  stage      text,                              -- work pipeline: planning|shooting|editing|delivery (free)
  status     text NOT NULL DEFAULT 'active',    -- active | done | archived
  deadline   date,
  notes      text,
  position   integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS me_projects_owner_idx ON me_projects(owner_id);

-- ── tasks (personal; project optional) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS me_tasks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id   uuid REFERENCES me_projects(id) ON DELETE SET NULL,
  title        text NOT NULL,
  notes        text,
  priority     text NOT NULL DEFAULT 'normal',  -- low | normal | high
  status       text NOT NULL DEFAULT 'todo',    -- todo | doing | done
  context      text,                             -- @office / @phone / @location …
  is_today     boolean NOT NULL DEFAULT false,
  due_date     date,
  completed_at timestamptz,
  position     integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS me_tasks_owner_idx ON me_tasks(owner_id);
CREATE INDEX IF NOT EXISTS me_tasks_today_idx ON me_tasks(owner_id, is_today) WHERE status <> 'done';
CREATE INDEX IF NOT EXISTS me_tasks_project_idx ON me_tasks(project_id);

-- ── inbox (frictionless capture; organise later) ─────────────────────────────
CREATE TABLE IF NOT EXISTS me_inbox (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content       text NOT NULL,
  source        text NOT NULL DEFAULT 'text',   -- text | voice | share | whatsapp
  ai_suggestion jsonb,                            -- {type,title,projectId} from triage
  processed     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS me_inbox_owner_idx ON me_inbox(owner_id, processed);
