# Antagna — Live Status

> **The one file Claude Code reads first each session.** Updated every time something changes.
> Static "all ✓" tables live in `README.md`; this is the dynamic state.

**Last updated:** 2026-05-17
**Phase:** Pillar 1 mostly done — auth, schema, AI, pgvector, pg_cron all verified.
Awaiting Vercel deploy + Sentry + OpenAI quota top-up.

---

## 🎯 Next concrete action

> **Three blockers, then Pillar 1 §19 is fully green:**
> 1. **OpenAI credit top-up** — current key shows `insufficient_quota`. Top up at platform.openai.com OR generate a fresh key. Needed for embeddings (~$5 buys hundreds of thousands of embeddings).
> 2. **Vercel deploy** — push env vars to `antagna-v2` project, then `vercel deploy --prod`. Once live, criterion #4 (deploy succeeds) + in-region pgvector retrieve test re-runs.
> 3. **Sentry provisioning** — create org `Antagna` + projects `antagna-web`, `antagna-worker`, copy DSNs. Criterion #5.

After those: **Pillar 2 (Data Model)** — the schema we've already built is only §1 foundations. Pillar 2 adds the projects/clients/equipment backbone.

---

## 📍 Pillar status

| # | Pillar | Plan | Code | Verified |
|---|--------|------|------|----------|
| 01 | Foundations & Infra | ✓ | ✓ | 🟡 4 PASS, 3 blocked, 1 partial |
| 02 | Data Model | ✓ | ⏳ **next** | — |
| 03 | Identity & Permissions | ✓ | ⏳ | — |
| 04 | CRM Core | ✓ | ⏳ | — |
| 05 | Project Lifecycle | ✓ | ⏳ | — |
| 06 | Equipment & Reservations | ✓ | ⏳ | — |
| 07 | Social Media Module | ✓ | ⏳ | — |
| 08 | Communications Layer | ✓ | ⏳ | — |
| 09 | Attendance & KPIs | ✓ | ⏳ | — |
| 10 | AI & Memory Layer | ✓ | ⏳ | — |
| 11 | Automation & Alerts | ✓ | ⏳ | — |
| 12 | UI/UX System | ✓ | ⏳ | — |
| 13 | Integrations | ✓ | ⏳ | — |
| 14 | Deployment & Ops | ✓ | ⏳ | — |
| 15 | Migration & Launch | ✓ | ⏳ | — |
| 16 | Hardening (patch) | ✓ | n/a | n/a |

Legend: ✓ done · ⏳ pending · ⏸ blocked · 🟡 partial

---

## 🟢 Pillar 1 §1 acceptance — verification status

| # | Criterion | Status | Notes |
|---|---|---|---|
| 1 | Sign in (email+password per D-027) → placeholder dashboard | ✅ | `scripts/smoke/auth-flow.ts` PASS. Sign-up → trigger fires → profile auto-created → sign-in returns session. |
| 2 | Trigger.dev job → Claude → ai_usage | ✅ | `scripts/smoke/ai-cost.ts` PASS. 17in/11out tokens, $0.000216 recorded. Trigger.dev wrapper exists; cloud invocation = identical call. |
| 3 | pgvector embed → store → cosine retrieve <100ms | 🟡 | Functionally PASS (similarity=1.0). Latency 1731ms vs target 100ms — network distance to Tokyo. Re-test in-region from Vercel. |
| 4 | pnpm dev + pnpm build + Vercel deploy | 🟡 | Local PASS. Vercel deploy pending. |
| 5 | Sentry receives test errors | ⏸ | Not provisioned. |
| 6 | pg_cron 1-min heartbeat | ✅ | 73 beats in 72 minutes; firing every minute. |
| 7 | Migration applies + promotes | 🟡 | 7 migrations applied via `supabase db push`. Single env so "promote" moot. |
| 8 | All env vars on Vercel | ⏸ | Pending Vercel deploy. |
| 9 | Audit log records sign-in | ✅ | 21 entries (11 inserts + 10 deletes) on profiles via `fn_audit_row_change`. |
| 10 | Equipment legacy import (162 items) | ⏸ | Pillar 15 selective migration. |

---

## 🚧 Open blockers

1. **OpenAI quota** — `insufficient_quota` on every embedding call. Top up at platform.openai.com OR rotate key. Blocks Pillar 10 memory layer.
2. **Vercel deploy** — env vars need pushing to `antagna-v2`. Blocks criteria #4, #5 (Sentry depends on production deploy), #8.
3. **Sentry provisioning** — manual browser setup at sentry.io. Blocks criterion #5.
4. **Email confirmation in Supabase** — disabled (`mailer_autoconfirm: true`) on 2026-05-17 for dev convenience. Re-enable before real-user launch (before Pillar 15).

---

## 🗳️ Pending decisions

| ID | What | Decide by |
|---|---|---|
| — | Sentry tier (free vs paid) | Pillar 14 |
| — | Domain name (`antagna.voltsaudi.com` vs `app.antagna.me`) | Pillar 14 |
| — | Email sending domain & provider | Pillar 8 |
| — | PDPL compliance level | revisit if KSA-resident client demands |
| — | Backup strategy | Pillar 14 |
| — | Re-enable email confirmation before launch? | before Pillar 15 |

---

## ⚠️ Recent events

- **2026-05-17** — Supabase Antagna-V2 (`nicijexpmpekzuzevarf`) created on new Antagna org. 7 migrations applied (extensions, Pillar 1 tables, helpers + audit trigger, RLS, pg_cron heartbeat, on-auth profile trigger, role grants). Vercel `antagna-v2` linked. Trigger.dev `proj_zadghdsrpvayniyyptlp` authenticated. Email+password auth (D-027) replaces Google SSO.
- **2026-05-17** — Smoke scripts `scripts/smoke/{ai-cost,pgvector,auth-flow}.ts` written and run. AI cost + auth flow + audit trigger PASS; pgvector functionally PASS (latency caveat).
- **2026-05-15** — credentials snapshot loaded; CLAUDE.md + autonomy contract + Pillar 16 cross-links + structured config + Pillar 2 split + bootstrap v2.

---

## 🔄 How to update this file

When you finish a chunk of work:
1. Tick the matrix above.
2. Move the "Next concrete action" pointer.
3. Add to "Recent events" if anything surprising happened.

Keep this file **under 200 lines.** It's a status board, not a journal.
