-- Smart duplicate detection — pg_trgm gin indexes on the fields we match for
-- "did this client / contact / project already exist?". The action layer calls
-- similarity() + exact checks; these indexes make sub-50ms responses possible
-- on the create-form pre-insert hook.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS clients_trgm_name_ar    ON public.clients   USING gin(name_ar    gin_trgm_ops);
CREATE INDEX IF NOT EXISTS clients_trgm_name_en    ON public.clients   USING gin(name_en    gin_trgm_ops) WHERE name_en IS NOT NULL;
CREATE INDEX IF NOT EXISTS clients_trgm_legal_name ON public.clients   USING gin(legal_name gin_trgm_ops) WHERE legal_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS contacts_trgm_full_name      ON public.contacts        USING gin(full_name  gin_trgm_ops);
-- Emails/phones live on contact_methods (normalized_value already stripped).
CREATE INDEX IF NOT EXISTS contact_methods_norm_value   ON public.contact_methods (method_type, normalized_value) WHERE normalized_value IS NOT NULL;

CREATE INDEX IF NOT EXISTS projects_trgm_title     ON public.projects  USING gin(title     gin_trgm_ops);
CREATE INDEX IF NOT EXISTS projects_trgm_title_ar  ON public.projects  USING gin(title_ar  gin_trgm_ops) WHERE title_ar IS NOT NULL;
