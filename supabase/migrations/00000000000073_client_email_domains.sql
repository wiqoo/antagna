-- Client email-domain mapping: link inbound mail to a client by sender domain.
-- Sparse contact data means exact-email matching misses most threads; a domain
-- map (learned from confirmed contact matches + editable) closes the gap.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS email_domains text[] NOT NULL DEFAULT '{}'::text[];

-- GIN index so domain-membership / suffix lookups stay fast as the map grows.
CREATE INDEX IF NOT EXISTS clients_email_domains_gin
  ON clients USING gin (email_domains);

-- ── Backfill 1: domains embedded in the client name, e.g.
--    "Al Naghi Motors (auto.mynaghi.com)" → registrable domain mynaghi.com
--    (stored as the base so auto./bmw. subdomains both match by suffix).
UPDATE clients
SET email_domains = ARRAY[
  regexp_replace(
    lower((regexp_match(coalesce(name_en, name_ar), '\(([a-z0-9.-]+\.[a-z]{2,})\)'))[1]),
    '^[a-z0-9-]+\.([a-z0-9-]+\.[a-z.]+)$', '\1'      -- strip leading subdomain
  )
]
WHERE email_domains = '{}'
  AND coalesce(name_en, name_ar) ~ '\([a-z0-9.-]+\.[a-z]{2,}\)';

-- ── Backfill 2: learn domains from existing CONFIRMED contact emails, excluding
--    free providers. A contact at contact@worldeye-me.ae bootstraps that domain
--    for the WorldEye client so all its threads link going forward.
WITH learned AS (
  SELECT c.client_id,
         array_agg(DISTINCT split_part(lower(cm.normalized_value), '@', 2)) AS domains
  FROM contact_methods cm
  JOIN contacts c ON c.id = cm.contact_id
  WHERE cm.method_type = 'email'
    AND split_part(lower(cm.normalized_value), '@', 2) NOT IN (
      'gmail.com','googlemail.com','hotmail.com','outlook.com','live.com',
      'yahoo.com','icloud.com','me.com','aol.com','proton.me','protonmail.com'
    )
    AND split_part(lower(cm.normalized_value), '@', 2) <> ''
  GROUP BY c.client_id
)
UPDATE clients cl
SET email_domains = (
  SELECT array_agg(DISTINCT d)
  FROM unnest(cl.email_domains || learned.domains) AS d
)
FROM learned
WHERE cl.id = learned.client_id;
