-- Per-quotation smart-analysis cache. One row per project; recomputed only when
-- the quote/email state hash changes or the row goes stale (brain-connected
-- analysis is expensive, so we cache it like email_extractions + the board cache).
CREATE TABLE IF NOT EXISTS quotation_analysis_cache (
  project_id   uuid PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  input_hash   text NOT NULL,
  payload      jsonb NOT NULL,
  model        text,
  computed_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quotation_analysis_cache_computed_idx
  ON quotation_analysis_cache (computed_at);
