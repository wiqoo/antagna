# Antagna — Build Checklist (live)

> **Tracker for the full re-architecture.** I tick items + commit/push after each one,
> so this page always reflects real progress. Plan: `PRODUCT-VISION.md` +
> `.claude/plans` (approved). **Last updated: 2026-05-26 — Phase A COMPLETE (A0–A7), build ✓; B1 started (write_activity across all project mutations). Deploy postponed by Mohammed.**
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
- [x] **A6** auth: password reset (`/auth/forgot`→email→`/auth/callback`→`/auth/reset`) + email-verify via `emailRedirectTo`→`/auth/callback` (PKCE exchange) + login/register/forgot/reset re-skinned to DNA via shared `AuthCard`. Invite-vs-self-signup = your call (manual item Q1; register stays open for now).
- [x] **A6** PWA: `beforeinstallprompt` custom install card (`InstallPrompt`) + real `/offline` shell (precached by sw.js v2, added to public allowlist)
- [x] **A7** Account hub `/settings` rebuilt: profile, **language toggle** (switches whole system + syncs locale cookie), per-event×per-channel **notification matrix** (in-app/email/WhatsApp chips → feeds unified notif service), **security** (change password), WhatsApp-link card, admin-tools card (admin-only). Reshaped `notification_prefs` → `{channels:{event:{inApp,email,whatsapp}}}` (no other consumer yet).
- [~] **cross** wire `write_activity` into all server-action mutations — `lib/activity.ts` helper done; **projects (9)** + **clients (4: create/update/contact/archive)** wired; remaining domains (tasks/equipment/people) as each is built in B/C

## Phase B — Core pages (each: DNA skin + i18n + links + quick actions + Playwright verify)
- [x] **B1** `/projects`: list strong+on-DNA (AIHints, stat tiles, filters, relational table) + **board/table toggle** (`?view=board` kanban by stage); detail page comprehensive (header, tasks, team, comments, stage-log, deliverables, equipment, approval pipeline) + new **Activity timeline** (reads `activity_events`); `write_activity` in all 9 project mutations → feeds A4 brain. **Polish later:** reorganize detail sections into tabs, drag-to-advance-stage (need visual QA on the auth-gated page).
- [x] **B2** `/inbox` strong+on-DNA (AIHints, thread list w/ AI summary+status, WhatsApp + drafts sections); `/inbox/suggestions` queue is domain-agnostic (status/expiry filter, not email-only) + gated server-side (A3) + now shows **human-readable labeled proposed-data** (Arabic field view) instead of raw JSON, so approvals are reviewable. Reply-draft compose exists. **Later:** richer per-type cards, inline thread reply.
- [x] **B3** `/crm` + `/clients/[id]` built+on-DNA (AIHints, client 360). **Done:** `write_activity` in client mutations; **lead pipeline board** (`?view=board`, funnel columns + per-card status-move dropdown via `updateLeadStatus`, temperature/value/source) — verified visually via QA login. **Next:** lead→client/project conversion action.
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
