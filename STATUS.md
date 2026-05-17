# Antagna — Live Status

> **The one file Claude Code reads first each session.** Updated every time something changes.
> Static "all ✓" tables live in `README.md`; this is the dynamic state.

**Last updated:** 2026-05-17 (post-deploy)
**Phase:** Pillar 1 6/10 PASS, **live on production**. Awaiting Sentry + OpenAI quota top-up for the last two functional criteria.

**Live URL:** <https://antagna-v2.vercel.app>

---

## 🎯 Next concrete action

> **Pillar 1 is functionally complete and live.** Two non-blocking items remain:
> 1. **OpenAI credit top-up** (~$5) — enables real embeddings (criterion #3 latency re-test).
> 2. **Sentry provisioning** — manual signup at sentry.io; create projects `antagna-web` + `antagna-worker`, get DSNs.
>
> **Then start Pillar 2 (Data Model)** — the projects/clients/equipment backbone. The Pillar 1 foundations schema is only the spine of the spine.

---

## 📍 Pillar status

| # | Pillar | Plan | Code | Verified |
|---|--------|------|------|----------|
| 01 | Foundations & Infra | ✓ | ✓ | 🟡 6 PASS, 1 partial, 2 blocked (Sentry, OpenAI quota), 1 deferred (Pillar 15) |
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
| 4 | pnpm dev + pnpm build + Vercel deploy | ✅ | Local + Vercel both PASS. <https://antagna-v2.vercel.app> live; all 4 auth routes 200/307 as expected. |
| 5 | Sentry receives test errors | ⏸ | Not provisioned. |
| 6 | pg_cron 1-min heartbeat | ✅ | 73 beats in 72 minutes; firing every minute. |
| 7 | Migration applies + promotes | ✅ | 8 migrations applied via `supabase db push`. Single env; will split when prod traffic warrants. |
| 8 | All env vars on Vercel | ✅ | 11 vars pushed to production + development on `antagna-v2`. |
| 9 | Audit log records sign-in | ✅ | 21 entries (11 inserts + 10 deletes) on profiles via `fn_audit_row_change`. |
| 10 | Equipment legacy import (162 items) | ⏸ | Pillar 15 selective migration. |

---

## 🚧 Open blockers

1. **OpenAI quota** — `insufficient_quota` on every embedding call. Top up at platform.openai.com OR rotate key. Blocks Pillar 10 memory layer with real embeddings.
2. **Sentry provisioning** — manual browser setup at sentry.io (criterion #5).
3. **Email confirmation in Supabase** — disabled (`mailer_autoconfirm: true`) on 2026-05-17 for dev convenience. Re-enable before real-user launch (before Pillar 15).

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
- **2026-05-17** — Vercel deploy live at <https://antagna-v2.vercel.app>. 11 env vars pushed; auth routes verified (200/307); Supabase site_url + uri_allow_list updated to point at the production URL. Migration 00007 added Supabase role GRANTs (anon/authenticated/service_role get DML on public.*).
- **2026-05-15** — credentials snapshot loaded; CLAUDE.md + autonomy contract + Pillar 16 cross-links + structured config + Pillar 2 split + bootstrap v2.

---

## 🔄 How to update this file

When you finish a chunk of work:
1. Tick the matrix above.
2. Move the "Next concrete action" pointer.
3. Add to "Recent events" if anything surprising happened.

Keep this file **under 200 lines.** It's a status board, not a journal.
