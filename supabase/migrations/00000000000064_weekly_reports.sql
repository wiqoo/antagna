-- 064 — Weekly Performance Reports (JD accountability layer)
--
-- One row per person per ISO-week. The AI drafts a performance report from the
-- person's actual system activity graded against their job-description
-- (config/job-descriptions.yaml); the person reviews/edits → approves → it's
-- routed to their manager (reports_to). Mirrors the daily_briefs caching shape.

CREATE TABLE IF NOT EXISTS public.weekly_reports (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id         uuid NOT NULL REFERENCES public.profiles(id),
  week_start         text NOT NULL,                 -- ISO Monday 'YYYY-MM-DD' (Riyadh)
  position_key       text,                          -- role this report graded
  content            text NOT NULL,                 -- headline / plain-text fallback
  highlights         jsonb,                         -- {summary, kpis, wins, concerns, focus}
  edited_highlights  jsonb,                         -- person edits before approval
  status             text NOT NULL DEFAULT 'draft', -- draft | approved | sent
  model_used         text,
  cost_usd           numeric(10,6) NOT NULL DEFAULT 0,
  generated_at       timestamptz NOT NULL DEFAULT now(),
  approved_by_id     uuid REFERENCES public.profiles(id),
  approved_at        timestamptz,
  sent_to_manager_id uuid REFERENCES public.profiles(id),
  sent_at            timestamptz,
  CONSTRAINT weekly_report_unique UNIQUE (profile_id, week_start)
);

CREATE INDEX IF NOT EXISTS weekly_reports_profile_idx
  ON public.weekly_reports (profile_id, week_start DESC);

CREATE INDEX IF NOT EXISTS weekly_reports_manager_idx
  ON public.weekly_reports (sent_to_manager_id)
  WHERE sent_to_manager_id IS NOT NULL;
