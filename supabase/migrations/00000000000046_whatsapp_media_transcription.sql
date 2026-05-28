-- C4: WhatsApp media storage + voice transcription.
-- media_storage_path: relative path inside the `whatsapp-media` private bucket.
-- transcription:     Whisper text for audio messages (ar/en mix is fine).
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS media_storage_path text,
  ADD COLUMN IF NOT EXISTS transcription      text;

-- Speed up the scanner's "needs work" queries.
CREATE INDEX IF NOT EXISTS wam_pending_media
  ON public.whatsapp_messages (id)
  WHERE media_url IS NOT NULL AND media_storage_path IS NULL;

CREATE INDEX IF NOT EXISTS wam_pending_voice
  ON public.whatsapp_messages (id)
  WHERE message_type IN ('audio','voice') AND transcription IS NULL;
