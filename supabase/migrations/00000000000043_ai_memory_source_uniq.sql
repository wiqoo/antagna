-- A4: make the memory indexer idempotent — one chunk per (source, source_id).
-- NULL source_id rows (e.g. manual chunks) stay distinct (PG default), so this
-- only dedups indexed events. Table is empty today, so safe to add.
CREATE UNIQUE INDEX IF NOT EXISTS ai_memory_chunks_source_uniq
  ON ai_memory_chunks (source, source_id);
