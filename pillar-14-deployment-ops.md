# Pillar 14 — Deployment & Operations

**Status:** Planning
**Depends on:** Pillars 1-13
**Estimated effort:** 2 sessions

CI/CD, monitoring, backups, security hardening, and the operational discipline to keep Antagna running reliably. Resolves Mohammed's prior pain ("two parallel versions and the update flow got tangled") with a single, clean promote pipeline.

---

## 1. Goals

- Three environments, one direction of promotion: local → staging → production.
- No manual deploys to production — everything via PR + merge to `main`.
- Database migrations versioned and audit-able.
- Monitoring + alerting on errors, performance, AI cost.
- Daily backups; documented disaster recovery.
- Saudi PDPL compliance checklist completed.
- Security hardening: secrets, 2FA, audit review cadence.

## 2. Success Criteria

1. Push to `dev` branch → staging deploys + staging Supabase migrates automatically; preview URL works.
2. Merge `dev` → `main` → production deploys + prod Supabase migrates; rollback path tested.
3. Test error in production → Sentry receives + Slack notification fires + on-call paged.
4. Daily database backup exists and a test-restore succeeds.
5. PDPL compliance documents in `docs/compliance/` complete.

---

## 3. Environments & Branches

| Env | Branch | URL | DB | Trigger.dev |
|-----|--------|-----|-------|---------------------|
| local | `feature/*` | localhost:3000 | local Supabase Docker | local dev mode |
| staging | `dev` | `antagna-staging.vercel.app` (and `staging.antagna.voltsaudi.com`) | `antagna-staging` project | staging environment |
| production | `main` | `app.antagna.voltsaudi.com` | `antagna-prod` project | production environment |

Branch protection on `main`: requires PR, requires CI green, requires 1 review (Mohammed) — or admin override for emergencies.

---

## 4. CI/CD (`.github/workflows/`)

### 4.1 `ci.yml` (every push)

```yaml
name: CI
on: [push, pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm type-check
      - run: pnpm test
```

### 4.2 `deploy-staging.yml` (push to `dev`)

```yaml
name: Deploy Staging
on:
  push: { branches: [dev] }
jobs:
  migrate-db:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: supabase link --project-ref ${{ secrets.SUPABASE_STAGING_REF }}
      - run: supabase db push --linked
  deploy-vercel:
    needs: migrate-db
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx vercel deploy --token=${{ secrets.VERCEL_TOKEN }}
  deploy-trigger:
    needs: migrate-db
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx trigger.dev@latest deploy --env staging
```

### 4.3 `deploy-prod.yml` (push to `main`)

Same as staging but pointed at prod project refs + Vercel prod + Trigger.dev prod.

Includes a manual approval gate: GitHub Actions environments → `production` → required reviewer (Mohammed).

---

## 5. Migration Discipline

- Every schema change is a Drizzle migration in `supabase/migrations/<timestamp>_<name>.sql`.
- Generated via `pnpm db:gen`; reviewed in PR.
- Never edit a migration that's already been applied — always create a new one.
- Destructive migrations (DROP, ALTER COLUMN to incompatible type) require explicit `# DESTRUCTIVE` comment + reviewer sign-off.
- Migration auditing: every applied migration logs to `migration_history` in DB.

---

## 6. Backups & Disaster Recovery

### 6.1 Backups

- Supabase Pro: automatic daily backups, 7-day retention.
- Additional weekly off-site backup via Trigger.dev task to S3-compatible storage.
- `supabase db dump` test restore in staging quarterly.

### 6.2 Disaster recovery plan

`docs/runbooks/disaster-recovery.md`:

| Scenario | Recovery time | Recovery point |
|----------|---------------|----------------|
| Vercel outage | 0 (re-deploy elsewhere from `apps/web`) | 0 |
| Supabase outage | depends on Supabase | depends |
| Bad migration on prod | <30 min (point-in-time restore on Supabase Pro) | up to 5 min |
| Data corruption | <2h (restore from off-site backup) | up to 24h |
| Account compromise | rotate all secrets via runbook script | 0 |

---

## 7. Monitoring

### 7.1 Errors → Sentry
- `@sentry/nextjs` on web, `@sentry/node` on worker.
- Source maps uploaded on deploy.
- Slack alert on new error fingerprint.

### 7.2 Performance
- Vercel Analytics (or self-hosted Plausible).
- Web Vitals tracked: LCP, INP, CLS targets met per Pillar 12.

### 7.3 AI cost
- `/admin/ai-cost` dashboard (Pillar 10).
- Daily Trigger.dev task `ai-cost-rollup` produces daily/weekly/monthly aggregates.
- Slack alert if daily cost exceeds historic 95th percentile.

### 7.4 Health checks
- Vercel: hits `/api/health` every minute.
- UptimeRobot or similar: external monitor on the production URL.
- Alerts on 3 consecutive failures.

### 7.5 Logs
- Structured logging via `pino`.
- Vercel Log Drain to Axiom (or BetterStack) for searchable retention.

---

## 8. Security Hardening

### 8.1 Account level
- 2FA enforced on GitHub, Vercel, Supabase, Anthropic, OpenAI, Trigger.dev, Sentry, Google Cloud.
- Per-env API keys (dev keys never touch prod).
- Service role keys server-only (never in client bundle).

### 8.2 Application
- Content Security Policy headers via Next.js.
- Rate limiting on critical endpoints (`/api/auth`, `/api/ask`).
- CAPTCHA on public forms.
- Input sanitization (Zod everywhere).

### 8.3 Database
- RLS on every public table (enforced by CI lint).
- Audit log on every important entity.
- Encrypted secrets via Supabase Vault.

### 8.4 Secrets rotation
- Quarterly: API keys.
- Annually: OAuth credentials.
- Immediately: if any compromise suspected.

---

## 9. PDPL Compliance Checklist

`docs/compliance/pdpl.md`:

- [ ] Data Processing Agreement signed with Supabase.
- [ ] Data Processing Agreement signed with Vercel.
- [ ] Data Processing Agreement signed with Anthropic.
- [ ] Data Processing Agreement signed with OpenAI.
- [ ] Standard Contractual Clauses (SCCs) in place for EU/US transfers.
- [ ] Data flow diagram: `docs/compliance/pdpl-data-flow.md` lists which personal data flows to which provider.
- [ ] Subject rights endpoints implemented: data export (JSON of own profile + activities); data deletion (anonymization).
- [ ] Breach notification process documented; first responder: Mohammed Ghareeb (acting DPO).
- [ ] Retention policy documented per data category (e.g., audit_log: 7 years; ai_memory_chunks: 3 years; ai_usage: 2 years).
- [ ] Privacy notice published at `app.antagna.voltsaudi.com/privacy`.
- [ ] Cookie consent banner if any tracking cookies used (we minimize these).
- [ ] Personal data inventory (which tables contain PII) maintained.

If any client demands KSA-resident storage in writing: trigger migration to KSA-hosted Postgres (preserves Vercel for stateless app).

---

## 10. On-call & Runbooks

For Phase 1, on-call is Mohammed Ghareeb. Runbooks in `docs/runbooks/`:
- `disaster-recovery.md`
- `secret-rotation.md`
- `bad-migration-rollback.md`
- `gmail-pubsub-resubscribe.md`
- `ai-cost-spike.md`

Each runbook: one-page, numbered steps, commands ready to copy.

---

## 11. Acceptance Checklist

- [ ] CI workflow passes on a sample PR.
- [ ] Push to `dev` deploys staging + applies migration.
- [ ] Push to `main` (after manual approval) deploys prod.
- [ ] Sentry receives a test error from both web + worker; Slack alert fires.
- [ ] Vercel Analytics + Web Vitals reporting works.
- [ ] AI cost rollup task produces daily aggregate row.
- [ ] Health check endpoint returns proper JSON.
- [ ] Daily Supabase backup verified; quarterly restore test scheduled.
- [ ] All accounts have 2FA enabled.
- [ ] PDPL compliance docs created (even if some items not yet completed).
- [ ] At least 3 runbooks written.

---

## 12. Deferred

- **Multi-region deploy** → if needed when scale demands.
- **Self-hosted KSA Postgres** → if client residency requires.
- **Bug bounty / external pen test** → after launch + 3 months.

---

## 13. Next: Pillar 15 — Migration & Launch Plan
