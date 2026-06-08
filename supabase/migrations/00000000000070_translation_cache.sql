-- Translation cache: shared warm store for the i18n engine (runtime layer +
-- build-time UI dictionary). Keyed by (source hash, target lang, domain).
CREATE TABLE IF NOT EXISTS translation_cache (
  source_sha256   text NOT NULL,
  source_lang     text NOT NULL DEFAULT 'ar',
  target_lang     text NOT NULL,
  domain          text NOT NULL DEFAULT 'ui',
  source_text     text NOT NULL,
  translated_text text NOT NULL,
  status          text NOT NULL DEFAULT 'machine',
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_sha256, target_lang, domain)
);

-- Fast lookups when listing/reviewing a domain's strings.
CREATE INDEX IF NOT EXISTS translation_cache_domain_idx
  ON translation_cache (target_lang, domain);
