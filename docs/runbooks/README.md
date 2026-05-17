# Antagna runbooks

Operational playbooks for common production scenarios. Each runbook is structured:

1. **What broke** — the visible symptom
2. **Why it might be broken** — likely root causes ordered by frequency
3. **What to do** — exact commands, with rollback at the end

Currently included:

- [`supabase-down.md`](./supabase-down.md) — database unreachable
- [`vercel-deploy-failed.md`](./vercel-deploy-failed.md) — build/deploy break
- [`auth-trigger-stuck.md`](./auth-trigger-stuck.md) — new sign-ups don't get a profile
- [`pg-cron-not-firing.md`](./pg-cron-not-firing.md) — scheduled jobs silent
- [`oauth-token-expired.md`](./oauth-token-expired.md) — integration calls failing on auth

When you hit something not listed here, add a new one. Keep them under 100 lines.
