-- B2 — first-class dynamic content: store the heuristic primary language of
-- each inbound message so the EN-mode "show original" toggle + in-locale AI
-- generation don't have to re-detect on every view. Cheap, nullable, backfilled
-- lazily at next ingest (no AI cost — detection is a codepoint ratio).

ALTER TABLE email_messages    ADD COLUMN IF NOT EXISTS detected_language text;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS detected_language text;

-- Backfill existing rows with the same heuristic (Arabic-block codepoints vs
-- Latin letters) so old threads also get a language tag immediately.
WITH scored AS (
  SELECT id,
    (length(regexp_replace(COALESCE(body_text, snippet, subject, ''), '[^ء-ۿ]', '', 'g')))::numeric AS ar,
    (length(regexp_replace(COALESCE(body_text, snippet, subject, ''), '[^A-Za-z]', '', 'g')))::numeric AS la
  FROM email_messages
  WHERE detected_language IS NULL
)
UPDATE email_messages m SET detected_language = CASE
  WHEN (s.ar + s.la) < 4 THEN NULL
  WHEN s.ar / NULLIF(s.ar + s.la, 0) > 0.65 THEN 'ar'
  WHEN s.ar / NULLIF(s.ar + s.la, 0) < 0.15 THEN 'en'
  ELSE 'mixed'
END
FROM scored s WHERE s.id = m.id;

WITH scored AS (
  SELECT id,
    (length(regexp_replace(COALESCE(body_text, ''), '[^ء-ۿ]', '', 'g')))::numeric AS ar,
    (length(regexp_replace(COALESCE(body_text, ''), '[^A-Za-z]', '', 'g')))::numeric AS la
  FROM whatsapp_messages
  WHERE detected_language IS NULL
)
UPDATE whatsapp_messages m SET detected_language = CASE
  WHEN (s.ar + s.la) < 4 THEN NULL
  WHEN s.ar / NULLIF(s.ar + s.la, 0) > 0.65 THEN 'ar'
  WHEN s.ar / NULLIF(s.ar + s.la, 0) < 0.15 THEN 'en'
  ELSE 'mixed'
END
FROM scored s WHERE s.id = m.id;
