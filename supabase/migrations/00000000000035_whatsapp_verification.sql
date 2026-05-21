-- WhatsApp profile linking — self-service verification flow.
-- Each profile generates a 2-digit code in Antagna, sends it from their
-- WhatsApp to the Volt line, and the bot links the LID to their profile.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS whatsapp_verification_code         text,
  ADD COLUMN IF NOT EXISTS whatsapp_verification_expires_at   timestamptz;

CREATE INDEX IF NOT EXISTS profiles_whatsapp_verification_idx
  ON profiles (whatsapp_verification_code)
  WHERE whatsapp_verification_code IS NOT NULL
    AND whatsapp_e164 IS NULL;

COMMENT ON COLUMN profiles.whatsapp_verification_code IS
  'Self-service WhatsApp linking — 2-digit code the user sends to the Volt line. Cleared once whatsapp_e164 is set.';
COMMENT ON COLUMN profiles.whatsapp_verification_expires_at IS
  'When the code stops being valid. Typically 10 min after generation.';
