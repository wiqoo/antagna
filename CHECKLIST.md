# Antagna — Build Checklist (live)

> **Tracker for the full re-architecture.** I tick items + commit/push after each one,
> so this page always reflects real progress. Plan: `PRODUCT-VISION.md` +
> `.claude/plans` (approved). **Last updated: 2026-05-26 — A1·A0·A2·A3·A4-memory·A5 done; next A4 rules+learning, then A6/A7.**
> Legend: `[x]` done · `[~]` in progress · `[ ]` not started.

## ✅ Done already (this session)
- [x] AppShell redesign — labeled sidebar + wide fluid container (every page)
- [x] Site-wide grid bug fix (comma→underscore in ~40 classes, 20 files)
- [x] Mobile density (2-up + dense backfill) + tasteful motion (page transitions, count-ups, active bar)
- [x] PWA installable — generated icons + dark theme
- [x] Product vision (`PRODUCT-VISION.md`) + master plan (approved)
- [x] Dev MCP toolkit (Playwright, Chrome-DevTools, Context7, shadcn, MagicUI, 21st, Supabase, Stitch) + Sentry MCP configured

## Phase A — Foundation (cross-cutting)
- [x] **A1** RBAC helper `authz.ts` (`can`/`requirePermission`/`requireCapability`) + reconciled phantom `system_manager`→`general_manager`
- [x] **A0** i18n framework: `next-intl` wired (cookie locale, `ar`/`en` catalogs, dynamic dir, topbar language switch) — toggle verified flipping chrome + RTL/LTR
- [~] **A0** copy: nav/chrome done in فصحى بسيطة + English; per-page strings converted as each page is rebuilt (B/C)
- [ ] **A0** tone/channel: notifications + emails + WhatsApp in recipient's language
- [x] **A2** seeded `access.manage` key (migration 042); reuse existing keys elsewhere (`ai_suggestion.approve`, `user.update_role`…)
- [x] **A2** Access admin UI `/admin/access` — users+roles, role×permission matrix, per-user overrides + capabilities (gated by `access.manage`; builds clean)
- [x] **A3** approve route gated by `ai_suggestion.approve` + writes `ai_action_log` on every decision (seeds A4 learning loop); inbox already domain-agnostic. Executor file-relocation → when first non-email domain lands (C).
- [x] **A4** fixed `ai_memory_chunks` Drizzle drift + unique `(source,source_id)` (migration 043)
- [x] **A4** `retrieveMemory`/`indexMemory`/`markChunkUseful` in `@antagna/ai` (RAG); wiring into brief/email = when those are reworked
- [x] **A4** `memory-indexer` worker (backfills `audit_log` + streams `activity_events`), triggered from insights-scanner
- [x] **A4** editable monitoring admin `/admin/automation` — full edit of alert rules (labels/recipients/cooldown/trigger_spec JSON/active) + KPI thresholds/labels/active; `compute_sql` shown read-only (code-managed); gated `automation.manage` (migration 044); linked from `/admin` (also linked the orphaned `/admin/access`)
- [x] **A4** learning loop — `learning-aggregator` worker rolls `ai_action_log` (suggestion_review) → `project_learnings` acceptance rates; `adjustConfidence()` helper blends them into tiers (bounded ±0.10, sample floor 10). Wire into tiering = B2 /inbox.
- [x] **A5** WhatsApp LID fix: webhook extracts real phone (`senderPn`/`sender.id`/group `author`), persists LID↔e164 mapping both ways + resolves known LIDs; bot gets RAG via `retrieveMemory`. Bot-action propose→approve folds into C4 team inbox.
- [ ] **A6** auth: password reset + email-verify `/auth/callback` + invite/self-signup decision
- [ ] **A6** PWA: install prompt + real offline shell
- [ ] **A7** Account control panel (profile, WhatsApp link, **language toggle**, per-event channel prefs, security, view-as)
- [ ] **cross** wire `write_activity` into all server-action mutations

## Phase B — Core pages (each: DNA skin + i18n + links + quick actions + Playwright verify)
- [ ] **B1** `/projects` list (board+table, AI health) + `/projects/[id]` clean tabs + Messages/Activity
- [ ] **B2** `/inbox` + `/inbox/suggestions` (generalized queue)
- [ ] **B3** `/crm` lead pipeline + `/clients/[id]` 360° + lead→client/project conversion
- [ ] **B4** `/tasks` — "my work" + per-project board + quick-create from a message

## Phase C — Big systems
- [ ] **C1** Equipment — detail page, reservation+checkout/return, repairs, kits, QR+scan, AI photo-ID (port `volt-os`)
- [ ] **C2** People — employees/freelancers/talents rosters + detail + assignment composer + availability
- [ ] **C3** Attendance PWA — selfie+GPS+geofence, storage bucket, offline queue, manager view, KPI feed
- [ ] **C4** WhatsApp team inbox + media + notifications fan-out (per-language)

## Phase D — Analytics, social, polish
- [ ] **D1** KPIs/Reports interactive (charts, drill-down, ranges)
- [ ] **D2** role-aware dashboards + per-role landing
- [ ] **D3** Social composer/calendar + sponsored deals
- [ ] **D4** ⌘K global search + cross-entity links + design-system consolidation into `@antagna/ui`

## Cross-cutting (from critical review)
- [ ] Data seeding/import (from `volt-os`) so pages aren't empty
- [ ] Unified notification service (in-app + email + WhatsApp, per-language)
- [ ] Automated tests — Vitest (authz/executors/locale) + Playwright E2E (login, approve, checkout, check-in) in CI
- [ ] Every page verified mobile (390) + basic a11y + RTL/LTR

## Every page on ONE DNA (no exception)
`[ ]` /dashboard(core✓) · /projects · /projects/[id] · /tasks · /inbox · /inbox/suggestions · /crm ·
/clients · /clients/[id] · /calendar · /equipment · /equipment/[id] · /team→/people · /social · /kpis ·
/reports · /admin(+subs) · /settings→account · /login · /register · /welcome

## Manual items from Mohammed (I'll remind at each)
- [ ] Approve me reading `volt-os` LIVE DB for a one-time data import (or "start fresh")
- [ ] Auth: invite-only vs self-signup + missing team emails (Abu Luka, Ahmed)
- [ ] Attendance: office/site geofence coordinates + radius; selfie required?
- [ ] Optional/later: Sentry `/mcp` OAuth (local) · DNS flip `antagna.me`→Vercel
