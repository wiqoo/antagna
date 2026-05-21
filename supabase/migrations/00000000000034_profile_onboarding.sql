-- Pillar 16 §H.4 — per-user onboarding flow.
-- A JSONB blob keeps it flexible: status + steps completed + timestamps.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_state jsonb NOT NULL
    DEFAULT '{"status":"pending","steps_done":[]}'::jsonb;

COMMENT ON COLUMN profiles.onboarding_state IS
  'Per-user onboarding state. Shape: { status: "pending"|"in_progress"|"completed"|"skipped", steps_done: [string], completed_at?: ts, skipped_at?: ts }';

-- Existing users who signed in before this migration shouldn't be hassled
-- with the welcome flow — mark them completed.
UPDATE profiles
SET onboarding_state = '{"status":"completed","steps_done":[],"backfilled":true}'::jsonb
WHERE onboarding_state ->> 'status' = 'pending'
  AND auth_user_id IS NOT NULL;
