-- Pillar 1 — foundational tables (§8.2)
-- Schema is the canonical version derived from packages/db/src/schema/*.
-- Drizzle will read live state and regenerate migrations from here once schema evolves.

-- profiles — Supabase auth-linked
CREATE TABLE IF NOT EXISTS public.profiles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id  uuid UNIQUE,
  email         text NOT NULL UNIQUE,
  full_name     text NOT NULL,
  full_name_ar  text,
  role          text NOT NULL DEFAULT 'user',
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- audit_log — every important state change
CREATE TABLE IF NOT EXISTS public.audit_log (
  id            bigserial PRIMARY KEY,
  actor_id      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_email   text,
  action        text NOT NULL,
  entity_type   text NOT NULL,
  entity_id     text,
  summary       text,
  before_data   jsonb,
  after_data    jsonb,
  metadata      jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_entity_idx     ON public.audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx      ON public.audit_log (actor_id);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON public.audit_log (created_at);

-- ai_usage — cost ledger, append-only
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id                 bigserial PRIMARY KEY,
  feature            text NOT NULL,
  model              text NOT NULL,
  input_tokens       integer NOT NULL DEFAULT 0,
  output_tokens      integer NOT NULL DEFAULT 0,
  cache_read_tokens  integer NOT NULL DEFAULT 0,
  cache_write_tokens integer NOT NULL DEFAULT 0,
  cost_usd           numeric(12,6) NOT NULL DEFAULT 0,
  user_id            uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  project_id         uuid,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_usage_user_idx       ON public.ai_usage (user_id);
CREATE INDEX IF NOT EXISTS ai_usage_feature_idx    ON public.ai_usage (feature);
CREATE INDEX IF NOT EXISTS ai_usage_created_at_idx ON public.ai_usage (created_at);

-- ai_user_limits — soft caps per user
CREATE TABLE IF NOT EXISTS public.ai_user_limits (
  user_id            uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  daily_limit_usd    numeric(10,4) NOT NULL DEFAULT 2.0,
  monthly_limit_usd  numeric(10,4) NOT NULL DEFAULT 30.0,
  hard_cap           boolean NOT NULL DEFAULT false,
  notes              text,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- ai_memory_chunks — pgvector-backed retrieval
CREATE TABLE IF NOT EXISTS public.ai_memory_chunks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope         text NOT NULL,
  scope_id      uuid,
  source        text NOT NULL,
  source_id     text,
  content       text NOT NULL,
  content_lang  text,
  embedding     vector(1536),
  metadata      jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_memory_chunks_scope_idx ON public.ai_memory_chunks (scope, scope_id);
CREATE INDEX IF NOT EXISTS ai_memory_chunks_embedding_idx
  ON public.ai_memory_chunks USING hnsw (embedding vector_cosine_ops);

-- system_settings — single key-value store
CREATE TABLE IF NOT EXISTS public.system_settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
