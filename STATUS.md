# Antagna — Live Status

> **The one file Claude Code reads first each session.** Updated every time something changes.
> Static "all ✓" tables live in `README.md`; this is the dynamic state.

**Last updated:** 2026-05-17 (Pillar 2 complete)
**Phase:** Pillars 1 and 2 done. Ready to start Pillar 3 (Identity & Permissions).

**Live URL:** <https://antagna-v2.vercel.app>

---

## 🎯 Next concrete action

> **Start Pillar 3 (Identity & Permissions).** Pillar 2 left every table with a
> baseline RLS (read=authenticated, write=admin). Pillar 3 refines those into
> role-tier predicates (system / business / domain / meta per `config/roles.yaml`)
> and wires the SystemRole + Capability checks that already exist in
> `@antagna/shared`.

Nothing in Pillar 3 blocks on manual prerequisites — pure schema + policy work.

---

## 📍 Pillar status

| # | Pillar | Plan | Code | Verified |
|---|--------|------|------|----------|
| 01 | Foundations & Infra | ✓ | ✓ | ✅ 8 PASS |
| 02 | Data Model | ✓ | ✓ | ✅ 8/8 §16 acceptance |
| 03 | Identity & Permissions | ✓ | ⏳ **next** | — |
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

- **61 tables** in production (`nicijexpmpekzuzevarf`).
- **15 migrations** applied: extensions, Pillar 1 tables + RLS + audit + pg_cron + GRANTs, Pillar 2 people/orgs/projects/briefs/money/equipment/cross-cutting + seed lookups + audit-fn polymorphic-PK fix.
- **Pillar 16 patches applied:** B.3 (no share_token), B.5 (equipment_groups by model), D.2 (talents), D.3 (freelancers + project_assignments.freelancer_id), D.4 (locations), D.5 (equipment_profiles), N (internal_approvals + extended deliverable_status enum), O.1 (Dafterah refs).
- **Seeded:** 21 capabilities, 5 departments, 14 notification event types, 6 starter tags.

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
