-- Life OS v2 — the personal system grows from a second-brain into a
-- chief-of-staff: life areas, a conversational AI assistant, an AI day-planner
-- with a real calendar, a simple-but-deep money layer, and a learning spine
-- (an evolving profile + feedback loop + pattern-stats on his OWN data).
-- All owner-scoped, all prefixed me_, on the shared DB.

-- ── life areas (PARA-style areas of responsibility) ──────────────────────────
CREATE TABLE IF NOT EXISTS me_areas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  key        text NOT NULL,                      -- stable slug: work|money|health|growth|relationships|hobbies
  name       text NOT NULL,
  icon       text NOT NULL DEFAULT '◆',
  color      text NOT NULL DEFAULT '#FF6B1A',
  position   integer NOT NULL DEFAULT 0,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, key)
);
CREATE INDEX IF NOT EXISTS me_areas_owner_idx ON me_areas(owner_id, active);

ALTER TABLE me_projects ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES me_areas(id) ON DELETE SET NULL;
ALTER TABLE me_tasks    ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES me_areas(id) ON DELETE SET NULL;
ALTER TABLE me_goals    ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES me_areas(id) ON DELETE SET NULL;

-- ── learning spine: an evolving profile of HIM ───────────────────────────────
-- traits is a free JSONB the AI maintains: energy windows, vocabulary, people,
-- spending baselines, working style, recurring commitments, learned facts.
CREATE TABLE IF NOT EXISTS me_profile (
  owner_id   uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  traits     jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary    text,                               -- one-paragraph "who he is" the AI keeps current
  learned_at timestamptz,                         -- last time the learn-loop ran
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── feedback loop: corrections that teach preferences ────────────────────────
CREATE TABLE IF NOT EXISTS me_feedback (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  scope      text NOT NULL,                       -- assistant | plan | insight | money | general
  ref_id     text,                                -- optional id of the thing being rated
  signal     text NOT NULL,                       -- up | down | edit | dismiss
  note       text,                                -- free-text correction ("don't schedule before 10am")
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS me_feedback_owner_idx ON me_feedback(owner_id, created_at DESC);

-- ── assistant conversation log (the chief-of-staff memory) ───────────────────
CREATE TABLE IF NOT EXISTS me_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role       text NOT NULL,                       -- user | assistant
  content    text NOT NULL,
  actions    jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{tool,summary,...}] taken on this turn
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS me_messages_owner_idx ON me_messages(owner_id, created_at);

-- ── calendar events (manual + pulled from Antagna) ───────────────────────────
CREATE TABLE IF NOT EXISTS me_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id  uuid REFERENCES me_projects(id) ON DELETE SET NULL,
  area_id     uuid REFERENCES me_areas(id) ON DELETE SET NULL,
  title       text NOT NULL,
  kind        text NOT NULL DEFAULT 'event',      -- shoot|meeting|deep|admin|personal|event|block
  start_at    timestamptz NOT NULL,
  end_at      timestamptz,
  all_day     boolean NOT NULL DEFAULT false,
  location    text,
  notes       text,
  source      text NOT NULL DEFAULT 'manual',     -- manual | antagna
  source_ref  text,                                -- e.g. project_tasks.id for dedupe
  status      text NOT NULL DEFAULT 'confirmed',   -- confirmed | tentative | done | cancelled
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS me_events_owner_idx ON me_events(owner_id, start_at);
CREATE UNIQUE INDEX IF NOT EXISTS me_events_source_uniq
  ON me_events(owner_id, source_ref) WHERE source_ref IS NOT NULL;

-- ── AI day plans (time-blocked) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS me_day_plans (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_date    date NOT NULL,
  theme        text,                               -- "Focus Day" / "Admin Day" …
  blocks       jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{start,end,kind,title,why,taskId,eventId}]
  note         text,                                -- AI's one-line framing of the day
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, plan_date)
);

-- ── money: settings, transactions, subscriptions, savings ────────────────────
CREATE TABLE IF NOT EXISTS me_finance (
  owner_id         uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  currency         text NOT NULL DEFAULT 'SAR',
  monthly_income   numeric(12,2) NOT NULL DEFAULT 0,   -- baseline/expected
  liquid_balance   numeric(12,2) NOT NULL DEFAULT 0,   -- current cash+bank (for runway)
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS me_transactions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  area_id    uuid REFERENCES me_areas(id) ON DELETE SET NULL,
  kind       text NOT NULL DEFAULT 'expense',      -- income | expense
  amount     numeric(12,2) NOT NULL,
  category   text,                                  -- food | transport | gear | bills | fun …
  label      text,
  txn_date   date NOT NULL DEFAULT current_date,
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS me_transactions_owner_idx ON me_transactions(owner_id, txn_date DESC);

CREATE TABLE IF NOT EXISTS me_subscriptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name          text NOT NULL,
  amount        numeric(12,2) NOT NULL,
  cadence       text NOT NULL DEFAULT 'monthly',    -- monthly | yearly
  category      text,
  next_charge   date,
  last_used     date,                                -- for the "unused" insight
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS me_subscriptions_owner_idx ON me_subscriptions(owner_id, active);

CREATE TABLE IF NOT EXISTS me_savings_goals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title         text NOT NULL,
  target_amount numeric(12,2) NOT NULL,
  saved_amount  numeric(12,2) NOT NULL DEFAULT 0,
  target_date   date,
  status        text NOT NULL DEFAULT 'active',      -- active | done
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS me_savings_owner_idx ON me_savings_goals(owner_id, status);

-- ── insights (rules + AI) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS me_insights (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  area_id    uuid REFERENCES me_areas(id) ON DELETE SET NULL,
  kind       text NOT NULL DEFAULT 'pattern',      -- pattern | money | balance | nudge | win
  title      text NOT NULL,
  body       text,
  severity   text NOT NULL DEFAULT 'info',         -- info | good | warn
  data       jsonb NOT NULL DEFAULT '{}'::jsonb,
  dismissed  boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS me_insights_owner_idx ON me_insights(owner_id, dismissed, created_at DESC);

-- ── wheel-of-life scores (self + activity blend, per period) ──────────────────
CREATE TABLE IF NOT EXISTS me_area_scores (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  area_id    uuid NOT NULL REFERENCES me_areas(id) ON DELETE CASCADE,
  period     text NOT NULL,                         -- YYYY-MM
  score      integer NOT NULL DEFAULT 5,            -- 0-10
  source     text NOT NULL DEFAULT 'self',          -- self | activity
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, area_id, period, source)
);
