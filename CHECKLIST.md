# Antagna — Build Checklist (live)

> **Tracker for the full re-architecture.** I tick items + commit/push after each one,
> so this page always reflects real progress. Plan: `PRODUCT-VISION.md` +
> `.claude/plans` (approved). **Last updated: 2026-05-26 — starting Phase A1.**
> Legend: `[x]` done · `[~]` in progress · `[ ]` not started.

## ✅ Done already (this session)
- [x] AppShell redesign — labeled sidebar + wide fluid container (every page)
- [x] Site-wide grid bug fix (comma→underscore in ~40 classes, 20 files)
- [x] Mobile density (2-up + dense backfill) + tasteful motion (page transitions, count-ups, active bar)
- [x] PWA installable — generated icons + dark theme
- [x] Product vision (`PRODUCT-VISION.md`) + master plan (approved)
- [x] Dev MCP toolkit (Playwright, Chrome-DevTools, Context7, shadcn, MagicUI, 21st, Supabase, Stitch) + Sentry MCP configured

## Phase A — Foundation (cross-cutting)
- [~] **A1** RBAC helper `authz.ts` (`can`/`requirePermission`/`requireCapability`) + reconcile phantom `system_manager`
- [ ] **A0** i18n: wire `next-intl` (cookie/profile locale), `ar.json`/`en.json`, dynamic dir/font, language switch
- [ ] **A0** copy: rewrite **all** UI strings → فصحى بسيطة + professional English (incl. dashboard cards)
- [ ] **A0** tone/channel: notifications + emails + WhatsApp in recipient's language
- [ ] **A2** seed new permission keys (`admin.access.manage`, `suggestions.approve`, per-domain)
- [ ] **A2** Access admin UI — users+roles, role×permission matrix, per-user overrides, capabilities
- [ ] **A3** generalize propose→approve (`lib/suggestions/`, extend enum, gate route, write `ai_action_log`)
- [ ] **A4** fix `ai_memory_chunks` drift + unique `(source,source_id)`
- [ ] **A4** `retrieveMemory` (RAG) + wire into daily-brief / insights / email-intel
- [ ] **A4** `memory-indexer` worker (backfill `audit_log` + stream `activity_events`)
- [ ] **A4** editable `alert_rules`/`kpi_definitions` admin (compute_sql locked)
- [ ] **A4** learning loop (`ai_action_log`→`project_learnings`→`adjustConfidence`)
- [ ] **A5** WhatsApp LID capture (`senderPn`) + LID↔e164 mapping + webhook upgrade (perms/RAG/groups)
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
