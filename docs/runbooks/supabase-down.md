# Supabase down

**Visible symptom:** sign-in failing, pages returning 500, dashboard shows DB connection errors.

## Verify

```bash
# 1. Is the project itself up?
curl -fsS -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  https://api.supabase.com/v1/projects/nicijexpmpekzuzevarf | jq .status
# expect: "ACTIVE_HEALTHY"
```

```bash
# 2. Can we reach the DB?
PGPASSWORD='Wiqo2026@Volt' psql \
  "postgresql://postgres.nicijexpmpekzuzevarf@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres" \
  -c 'SELECT now()'
```

## Likely causes

1. **Free-tier pause** — Supabase auto-pauses idle Free projects after ~1 week of no requests. Cure: visit the dashboard, click Restore.
2. **Region outage** — check <https://status.supabase.com>. Wait.
3. **Pooler hostname change** — verify the pooler URL via:
   `curl …/v1/projects/<ref>/config/database/pooler`.

## Rollback / mitigation

If the DB is unreachable but the app is up, set Vercel maintenance flag:

```bash
vercel env add MAINTENANCE_MODE production
# value: "true"
vercel deploy --prod --yes
```

`apps/web/middleware.ts` short-circuits to a static "we'll be back" page when `MAINTENANCE_MODE=true`. (Add this in Pillar 14 §10.)
