-- WhatsApp's @lid privacy rollout: the bot can never reply to a LID because
-- WhatsApp Web rejects it ("número não existe"). We need the user's real
-- phone number for outbound sends. Keep them in separate columns:
--
--   whatsapp_e164  → real +E.164 phone (used for OUTBOUND sendText)
--   whatsapp_lid   → opaque LID like '62290447601730' (used to IDENTIFY
--                     incoming messages and match the sender to a profile)
--
-- Either or both can be present. Bot identifies incoming by trying both
-- columns; replies always use whatsapp_e164.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS whatsapp_lid text;

CREATE INDEX IF NOT EXISTS profiles_whatsapp_lid_idx
  ON profiles (whatsapp_lid)
  WHERE whatsapp_lid IS NOT NULL;

-- Migrate existing rows: any whatsapp_e164 that's actually a LID gets moved
-- to whatsapp_lid, and the e164 column is cleared (we'll re-collect the
-- real phone via the user's settings page).
UPDATE profiles
SET whatsapp_lid = substring(whatsapp_e164 from 5),  -- strip 'lid:' prefix
    whatsapp_e164 = NULL
WHERE whatsapp_e164 LIKE 'lid:%';

COMMENT ON COLUMN profiles.whatsapp_lid IS
  'WhatsApp Linked ID used by the bot to identify incoming messages when WhatsApp hides the real phone behind privacy LIDs.';
