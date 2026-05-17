-- Pillar 13 — Integration scaffolding (schema only — runtime BLOCKED on
-- Google service-account / Resend domain / social OAuth tokens).

CREATE TABLE IF NOT EXISTS public.oauth_tokens (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider            text NOT NULL,
  subject             text NOT NULL,
  secret_ref          text NOT NULL,
  refresh_secret_ref  text,
  scopes              text[],
  issued_at           timestamptz,
  expires_at          timestamptz,
  last_refreshed_at   timestamptz,
  last_refresh_error  text,
  revoked             boolean NOT NULL DEFAULT false,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS oauth_tokens_provider_subject_idx
  ON public.oauth_tokens (provider, subject);
CREATE INDEX IF NOT EXISTS oauth_tokens_expiring_idx
  ON public.oauth_tokens (expires_at) WHERE revoked = false AND expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.integration_log (
  id                  bigserial PRIMARY KEY,
  provider            text NOT NULL,
  operation           text NOT NULL,
  status              text NOT NULL,         -- 'ok' | 'error' | 'rate_limited' | 'auth_failed'
  request_payload     jsonb,
  response_payload    jsonb,
  error_message       text,
  duration_ms         integer,
  actor_profile_id    uuid REFERENCES public.profiles(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS integration_log_provider_idx
  ON public.integration_log (provider, created_at DESC);
CREATE INDEX IF NOT EXISTS integration_log_errors_idx
  ON public.integration_log (provider, created_at DESC) WHERE status <> 'ok';

-- ── seed an integration_health view ──────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_integration_health AS
SELECT
  provider,
  count(*)                              AS calls_24h,
  count(*) FILTER (WHERE status = 'ok') AS successes_24h,
  count(*) FILTER (WHERE status <> 'ok') AS errors_24h,
  max(created_at)                        AS last_call_at,
  max(created_at) FILTER (WHERE status = 'ok')  AS last_success_at,
  max(created_at) FILTER (WHERE status <> 'ok') AS last_error_at
FROM public.integration_log
WHERE created_at > now() - interval '24 hours'
GROUP BY provider;

GRANT SELECT ON public.v_integration_health TO authenticated, service_role;

-- ── alert rule for OAuth tokens about to expire ──────────────────────────────

INSERT INTO public.alert_rules (key, name_ar, name_en, trigger_type, trigger_spec, recipient_strategy, escalation_chain, auto_action) VALUES
  ('oauth_token_expiring_7d',
   'توكن OAuth قارب على الانتهاء (7 أيام)', 'OAuth token expiring 7d',
   'schedule',
   jsonb_build_object('cron','0 9 * * *','query','SELECT id FROM oauth_tokens WHERE revoked = false AND expires_at IS NOT NULL AND expires_at BETWEEN now() AND now() + interval ''7 days'''),
   'admin',
   NULL, NULL)
ON CONFLICT (key) DO NOTHING;

-- ── audit + RLS (admin only — these tables hold secret refs) ─────────────────

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['oauth_tokens','integration_log'])
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
      || 'CREATE POLICY %I ON public.%I FOR ALL '
      || 'USING (public.is_admin_caller()) WITH CHECK (public.is_admin_caller());',
      t || '_admin_only', t, t || '_admin_only', t
    );
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS trg_oauth_tokens_touch_updated_at ON public.oauth_tokens;
CREATE TRIGGER trg_oauth_tokens_touch_updated_at
  BEFORE UPDATE ON public.oauth_tokens
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();
