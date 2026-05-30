-- WhatsApp @lid privacy: when a contact's number is hidden behind a @lid,
-- we can't show a real phone — but the WPPConnect payload still carries the
-- contact's WhatsApp display name (pushname / notifyName). Persist it so the
-- UI can show a NAME instead of the ugly raw `lid:NNN` / hidden-number label.
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS sender_name text;

-- Backfill from the raw payloads we already stored.
UPDATE whatsapp_messages
SET sender_name = COALESCE(raw_payload->>'pushname', raw_payload->>'notifyName')
WHERE sender_name IS NULL
  AND raw_payload IS NOT NULL
  AND COALESCE(raw_payload->>'pushname', raw_payload->>'notifyName') IS NOT NULL;
