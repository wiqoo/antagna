-- Pillar 10 — AI loop outputs + Pillar 16 §E learning tables.

-- ── extend ai_memory_chunks per Pillar 16 §E.3 ───────────────────────────────

ALTER TABLE public.ai_memory_chunks
  ADD COLUMN IF NOT EXISTS relevance_score    numeric(3,2),
  ADD COLUMN IF NOT EXISTS retrieval_count    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_retrieved_at  timestamptz,
  ADD COLUMN IF NOT EXISTS useful             boolean;

-- ── daily_briefs ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.daily_briefs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   uuid NOT NULL REFERENCES public.profiles(id),
  brief_date   text NOT NULL,
  content      text NOT NULL,
  highlights   jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  read_at      timestamptz,
  CONSTRAINT daily_brief_unique UNIQUE (profile_id, brief_date)
);

CREATE INDEX IF NOT EXISTS db_profile_date_idx ON public.daily_briefs (profile_id, brief_date DESC);

-- ── project_insights ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.project_insights (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  insight_type       text NOT NULL,
  severity           text NOT NULL,                -- 'low' | 'medium' | 'high'
  title_ar           text NOT NULL,
  body_ar            text,
  suggested_actions  jsonb,
  dismissed_at       timestamptz,
  dismissed_by_id    uuid REFERENCES public.profiles(id),
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pi_project_idx     ON public.project_insights (project_id);
CREATE INDEX IF NOT EXISTS pi_active_idx      ON public.project_insights (severity) WHERE dismissed_at IS NULL;

-- ── ai_action_log (acceptance / rejection signal for prompt tuning) ──────────

CREATE TABLE IF NOT EXISTS public.ai_action_log (
  id          bigserial PRIMARY KEY,
  ai_usage_id bigint,
  feature     text NOT NULL,
  outcome     text NOT NULL,                       -- 'accepted' | 'rejected' | 'edited' | 'ignored'
  user_id     uuid REFERENCES public.profiles(id),
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS aal_feature_idx ON public.ai_action_log (feature, created_at DESC);

-- ── project_learnings (Pillar 16 §E.1) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.project_learnings (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope                           text NOT NULL,
  scope_id                        uuid,
  learning_type                   text NOT NULL,
  insight_ar                      text NOT NULL,
  insight_en                      text,
  confidence                      numeric(3,2) NOT NULL,
  sample_size                     integer NOT NULL,
  derived_from_project_ids        uuid[],
  derived_from_activity_event_ids bigint[],
  validated_by_id                 uuid REFERENCES public.profiles(id),
  validated_at                    timestamptz,
  rejected_at                     timestamptz,
  rejected_reason                 text,
  active                          boolean NOT NULL DEFAULT true,
  expires_at                      timestamptz,
  superseded_by_learning_id       uuid,
  created_at                      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_learnings
  ADD CONSTRAINT project_learnings_superseded_fk
    FOREIGN KEY (superseded_by_learning_id) REFERENCES public.project_learnings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS pl_scope_idx  ON public.project_learnings (scope, scope_id);
CREATE INDEX IF NOT EXISTS pl_active_idx ON public.project_learnings (active) WHERE active = true;

-- ── decision_outcomes (Pillar 16 §E.2) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.decision_outcomes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_type         text NOT NULL,
  decision_made_at      timestamptz NOT NULL,
  decision_by           text NOT NULL,            -- 'ai' | 'human:<profile_id>'
  ai_usage_id           bigint,
  decision_input        jsonb,
  decision_output       jsonb,
  outcome_measured_at   timestamptz,
  outcome_label         text,
  outcome_detail        jsonb,
  outcome_followup_by   timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS do_type_idx       ON public.decision_outcomes (decision_type);
CREATE INDEX IF NOT EXISTS do_pending_idx    ON public.decision_outcomes (outcome_followup_by) WHERE outcome_measured_at IS NULL;

-- ── template_edit_patterns (Pillar 16 §E.4) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.template_edit_patterns (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key        text NOT NULL REFERENCES public.email_templates(key),
  email_draft_id      uuid REFERENCES public.email_drafts(id),
  editor_profile_id   uuid REFERENCES public.profiles(id),
  field_edited        text,
  original_text       text,
  edited_text         text,
  edit_diff           jsonb,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tep_template_idx ON public.template_edit_patterns (template_key);

-- ── state_transition_overrides (Pillar 16 §E.5) ──────────────────────────────

CREATE TABLE IF NOT EXISTS public.state_transition_overrides (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type         text NOT NULL,
  entity_id           uuid NOT NULL,
  from_state          text,
  to_state            text NOT NULL,
  by_profile_id       uuid REFERENCES public.profiles(id),
  reason              text,
  illegal_transition  boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sto_entity_idx ON public.state_transition_overrides (entity_type, entity_id);

-- ── audit + RLS ──────────────────────────────────────────────────────────────

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'daily_briefs','project_insights','ai_action_log',
    'project_learnings','decision_outcomes',
    'template_edit_patterns','state_transition_overrides'
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
  END LOOP;
END $$;

-- daily_briefs: recipient sees own.
DROP POLICY IF EXISTS daily_briefs_self_read ON public.daily_briefs;
CREATE POLICY daily_briefs_self_read ON public.daily_briefs
  FOR SELECT USING (profile_id = public.current_profile_id() OR public.is_admin_caller());
