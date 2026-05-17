# Antagna — Live Status

> **The one file Claude Code reads first each session.** Updated every time something changes.
> Static "all ✓" tables live in `README.md`; this is the dynamic state.

**Last updated:** 2026-05-17 (Pillar 4 schema complete)
**Phase:** Pillars 1-3 fully done; Pillar 4 schema applied (runtime logic deferred to its dependencies). Pillar 5 (Project Lifecycle) is next.

**Live URL:** <https://antagna-v2.vercel.app>

---

## 🎯 Next concrete action

> **Start Pillar 4 (CRM Core).** Schema for managing clients/contacts is
> mostly in Pillar 2 — Pillar 4 wires the UI + business logic (lead → client
> conversion, contact deduplication, agency-brand assignments, AM ownership
> rules, follow-ups). Pure code work; no manual prerequisites.

---

## 📍 Pillar status

| # | Pillar | Plan | Code | Verified |
|---|--------|------|------|----------|
| 01 | Foundations & Infra | ✓ | ✓ | ✅ 8 PASS |
| 02 | Data Model | ✓ | ✓ | ✅ 8/8 §16 acceptance |
| 03 | Identity & Permissions | ✓ | ✓ | ✅ 10/10 §10 acceptance |
| 04 | CRM Core | ✓ | 🟡 schema only | runtime logic → Pillar 8/10 |
| 05 | Project Lifecycle | ✓ | ⏳ **next** | — |
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

Legend: ✓ done · ⏳ pending · ⏸ blocked

---

## 🟢 Pillar 2 §16 acceptance

| # | Criterion | Status |
|---|---|---|
| 1 | All tables + RLS enabled | ✅ 61 tables, 61 with RLS |
| 2 | Triggers compile + fire | ✅ audit trigger writes on every change |
| 3 | Drizzle types match SQL | ✅ pnpm type-check clean |
| 4 | Domain test rows | ✅ smoke-tested via acceptance script |
| 5 | Audit log captures CRUD across Pillar 2 tables | ✅ verified — 5 deliverable transitions captured |
| 6 | Project with all FK refs in one transaction | ✅ PRJ-NNNN auto-generated, all FKs satisfied |
| 7 | Deliverable state machine | ✅ draft → submitted → pending_director → pending_am → client_ready → delivered |
| 8 | Equipment reservation overlap rejected | ✅ exclusion constraint `no_overlap_per_unit` rejected the conflicting insert |
| 9 | Selective migration ≥ 162 equipment + ≥ 20 clients | ⏸ Pillar 15 (migration plan) |
| 10 | type-check across packages/db consumers | ✅ 5/5 packages |

**8 PASS, 2 deferred (#9 → Pillar 15, RLS per-role refinement → Pillar 3).**

---

## 📊 Database snapshot

- **68 tables** in production (`nicijexpmpekzuzevarf`).
- **21 migrations** applied.
- **Pillar 16 patches applied:** B.3 (no share_token), B.5 (equipment_groups by model), D.2 (talents), D.3 (freelancers + project_assignments.freelancer_id), D.4 (locations), D.5 (equipment_profiles), N (internal_approvals + extended deliverable_status enum), O.1 (Dafterah refs).
- **Seeded:** 21 capabilities, 5 departments, 14 notification event types, 6 starter tags, **43 permissions**, **126 role→permission grants** across 7 roles.
- **Resolver functions live:** `has_permission`, `has_capability`, `is_assigned_to_project`, `current_user_has_*`, `current_acting_as_id`.
- **Acting-for pattern wired:** `SET LOCAL app.acting_as = '<uuid>'` inside a transaction stamps audit_log.acted_as_id and activity_events.acted_as_id.

---

## 🚧 Open blockers

1. **Email confirmation** in Supabase still disabled (`mailer_autoconfirm: true`) for dev convenience. Re-enable before real-user launch.
2. (No blockers for the next pillar.)

---

## 🛠 Manual items resolved this session (2026-05-17)

- ✅ OpenAI key rotated + $5 credit. Real embeddings now work.
- ✅ Trigger.dev DEV API key generated and in `.env.local`/Vercel.
- ✅ Resend API key in env.
- ✅ Google API key (Gmail/Calendar/Drive) in env. Note: API key alone is read-only / public-API; OAuth or service-account still pending for Pillar 13.
- ✅ Sentry source-map auth token in env. Next Vercel build will upload source maps for unminified stack traces.

## 🛠 Manual items still pending

- **Trigger.dev PROD API key** — generate when Pillar 5 starts deploying tasks.
- **WhatsApp Baileys VPS** — deferred per Mohammed (Pillar 8).
- **Custom domain** — deferred per Mohammed (Pillar 14).
- **Google service account + domain-wide delegation** — Pillar 13 (the API key alone won't access user data).
- **Resend domain verification (`notifications.voltsaudi.com`)** — before Pillar 8 send goes to anyone but Mohammed.
- **Sentry orphan project cleanup** — optional housekeeping.
- **Email confirmation re-enable** — before Pillar 15 launch.

---

## ⚠️ Recent events

- **2026-05-17 (afternoon)** — Pillar 2 fully complete. 51 new tables across 8 migrations. §16 acceptance script passed 8/8. OpenAI quota top-up confirmed by re-running pgvector smoke with real embeddings (1536-dim returned, similarity=1.000000 for identical text). Sentry source-map token + Resend + Google API key + Trigger.dev dev key all pushed to Vercel production env.
- **2026-05-17 (morning)** — Pillar 1 complete (8 PASS), Sentry verified, smoke tests, single-Supabase decision recorded.

---

## 🔄 How to update this file

When you finish a chunk of work:
1. Tick the matrix above.
2. Move the "Next concrete action" pointer.
3. Add to "Recent events" if anything surprising happened.

Keep this file **under 200 lines.** It's a status board, not a journal.
