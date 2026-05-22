-- Email attachments — store metadata + extracted text per file.
-- One row per (message_id, gmail_attachment_id). PDF/image bytes are NOT
-- stored locally (would explode storage) — only the parsed text content
-- + metadata. We re-fetch from Gmail on demand if we ever need the raw.

CREATE TABLE IF NOT EXISTS email_attachments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id          uuid NOT NULL REFERENCES email_messages(id) ON DELETE CASCADE,
  gmail_attachment_id text NOT NULL,
  filename            text NOT NULL,
  mime_type           text NOT NULL,
  size_bytes          integer,
  -- Extracted text content (from pdf-parse for PDFs, or vision OCR
  -- for images). Capped at ~50k chars to stay within token budgets.
  extracted_text      text,
  extraction_method   text,           -- 'pdf-parse' | 'vision' | 'skipped'
  extraction_error    text,
  extracted_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, gmail_attachment_id)
);

CREATE INDEX IF NOT EXISTS email_attachments_message_idx
  ON email_attachments (message_id);

ALTER TABLE email_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY email_attachments_read ON email_attachments FOR SELECT
  USING (auth.role() = 'authenticated' OR is_admin_caller());

COMMENT ON TABLE email_attachments IS
  'Per-attachment metadata + extracted text. PDFs via pdf-parse, images via vision OCR (deferred). Raw bytes not persisted.';
