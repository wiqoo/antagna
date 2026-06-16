-- Phase 2 of the external-work module: independent accounts for this system.
-- Volt staff access via their existing Antagna profile; PARTNERS get their own
-- accounts (Supabase Auth user + an ext_users row, NO profile) created through
-- an invite they accept themselves. Partner scope is enforced by partner_id.

CREATE TABLE IF NOT EXISTS ext_users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id  uuid NOT NULL UNIQUE,            -- Supabase auth.users.id
  role          text NOT NULL,                   -- 'volt' | 'partner'
  partner_id    uuid REFERENCES partners(id) ON DELETE CASCADE,  -- set for partners
  display_name  text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ext_users_partner_idx ON ext_users(partner_id);

CREATE TABLE IF NOT EXISTS partner_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id  uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  token       uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  email       text,
  created_by  uuid REFERENCES profiles(id),
  accepted_at timestamptz,
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS partner_invites_partner_idx ON partner_invites(partner_id);
