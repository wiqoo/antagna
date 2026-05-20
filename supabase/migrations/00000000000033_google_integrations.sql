-- Pillar 13: persisted Google OAuth tokens.
-- Single-account model: one Google identity (e.g. info@voltsaudi.com) authorizes
-- once; we hold its refresh_token forever and mint access_tokens on demand.
-- This sidesteps the org policy that blocks service-account JSON keys.

CREATE TABLE IF NOT EXISTS google_integrations (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The mailbox / identity that authorized us. Unique because we only need one.
  email              text NOT NULL UNIQUE,
  -- The currently valid access_token. Expires after ~1h.
  access_token       text NOT NULL,
  -- The long-lived refresh_token. Never expires unless revoked.
  refresh_token      text NOT NULL,
  -- Space-separated scopes Google granted (may differ from what we asked for).
  scope              text NOT NULL,
  token_type         text NOT NULL DEFAULT 'Bearer',
  -- When access_token dies.
  expires_at         timestamptz NOT NULL,
  -- First authorization.
  connected_at       timestamptz NOT NULL DEFAULT now(),
  -- Last successful refresh.
  last_refreshed_at  timestamptz NOT NULL DEFAULT now(),
  -- Last error message from a refresh attempt, if any.
  last_error         text,
  -- Disconnect timestamp. Soft-delete so we can keep audit history.
  disconnected_at    timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS google_integrations_email_idx
  ON google_integrations (email)
  WHERE disconnected_at IS NULL;

-- RLS — only the service role touches this table.
ALTER TABLE google_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS google_integrations_service_only ON google_integrations;
CREATE POLICY google_integrations_service_only
  ON google_integrations
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE google_integrations IS
  'Pillar 13: stores Google OAuth refresh_tokens for system mailboxes (e.g. info@voltsaudi.com). One row per identity.';
