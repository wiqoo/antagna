-- Pillar 3 §3-§4 — permission catalog + role defaults + per-user overrides.

CREATE TABLE IF NOT EXISTS public.permissions (
  key              text PRIMARY KEY,
  category         text NOT NULL,
  description_ar   text,
  description_en   text,
  risk_level       text NOT NULL DEFAULT 'normal'  -- 'low' | 'normal' | 'high'
);

CREATE TABLE IF NOT EXISTS public.role_default_permissions (
  role            text NOT NULL,
  permission_key  text NOT NULL REFERENCES public.permissions(key),
  PRIMARY KEY (role, permission_key)
);

CREATE TABLE IF NOT EXISTS public.user_permission_overrides (
  profile_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  permission_key  text NOT NULL REFERENCES public.permissions(key),
  granted         boolean NOT NULL,
  reason          text,
  granted_by      uuid REFERENCES public.profiles(id),
  expires_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, permission_key)
);

CREATE INDEX IF NOT EXISTS upo_profile_idx ON public.user_permission_overrides (profile_id);
CREATE INDEX IF NOT EXISTS upo_expires_idx ON public.user_permission_overrides (expires_at) WHERE expires_at IS NOT NULL;
