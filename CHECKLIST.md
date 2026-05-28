# Antagna — Build Checklist (live)

> **Tracker for the full re-architecture.** I tick items + commit/push after each one,
> so this page always reflects real progress. Plan: `PRODUCT-VISION.md` +
> `.claude/plans` (approved). **Last updated: 2026-05-27 — Phases A·B·C·D all built + 🚀 DEPLOYED live to antagna-v2 prod (https://antagna-v2.vercel.app). Camera attendance tested ✓. Remaining = scattered polish sub-items (tabs/QR/offline-queue/notif-service/tests/design-system consolidation) + i18n catalog extraction.**
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
- [~] **A0** copy: **Egyptian colloquial removed app-wide → فصحى بسيطة** (dashboard cards/briefing, welcome, settings/whatsapp, crm, inbox, intake, social, admin integrations — verified 0 colloquial tokens remain outside dev-only `/preview`). Remaining: full per-string extraction into the `ar`/`en` i18n catalogs for the English toggle (nav/chrome done; pages still have inline Arabic).
- [x] **A0** tone/channel: the `notify()` service renders each message in the **recipient's `ui_language`** across all three channels (in-app/email/WhatsApp).
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
- [x] **cross** `write_activity` wired across every built mutation — projects(9)/clients(4)/leads/tasks/equipment/assignments/attendance — all feed the A4 brain + per-entity Activity timelines.

## Phase B — Core pages (each: DNA skin + i18n + links + quick actions + Playwright verify)
- [x] **B1** `/projects`: list strong+on-DNA (AIHints, stat tiles, filters, relational table) + **board/table toggle** (`?view=board` kanban by stage); detail page comprehensive (header, tasks, team, comments, stage-log, deliverables, equipment, approval pipeline) + new **Activity timeline** (reads `activity_events`); `write_activity` in all 9 project mutations → feeds A4 brain. **Polish later:** reorganize detail sections into tabs, drag-to-advance-stage (need visual QA on the auth-gated page).
- [x] **B2** `/inbox` strong+on-DNA (AIHints, thread list w/ AI summary+status, WhatsApp + drafts sections); `/inbox/suggestions` queue is domain-agnostic (status/expiry filter, not email-only) + gated server-side (A3) + now shows **human-readable labeled proposed-data** (Arabic field view) instead of raw JSON, so approvals are reviewable. Reply-draft compose exists. **Later:** richer per-type cards, inline thread reply.
- [x] **B3** `/crm` + `/clients/[id]` built+on-DNA (AIHints, client 360). `write_activity` in client+lead mutations; **lead pipeline board** (`?view=board`, funnel columns + per-card status-move); **lead→client conversion** (convert link on unmatched leads → prefilled new-client form → `createClient` links the lead + marks qualified). All verified visually via QA login.
- [~] **B4** `/tasks` built+on-DNA ("my work" ranked by urgency, priority tones, daily+project tasks, quick-create). **Done:** `write_activity` on task status-change (+ revalidates the project) and daily-task create. **Later:** per-project task board, quick-create from a message.

## Phase C — Big systems
- [~] **C1** Equipment — **`/equipment/[id]` detail page** (photo/specs/financials/battery, reservations, activity timeline) + **checkout/return** wiring the previously-uncalled `fn_checkout_equipment`/`fn_return_equipment` + **status** (repair/available) + **charge** + `equipment_activity_log` + `write_activity`; list rows now link to detail. Verified end-to-end via QA login (status change mutated DB + logged, then reverted). **QR label** on `/equipment/[id]` (server-rendered SVG, scan→opens the item) done. **Remaining:** scan-to-checkout camera (@zxing, needs device), AI photo-ID, kits/compatibility.
- [x] **C2** People — `/team/[id]` employee detail + `/freelancers` roster+detail + **`/talents` roster** (category/niches/commission/contract) + **assignment composer** (project team form picks members **or freelancers** → `project_assignments` + `write_activity`). All linked from `/team`; **`/talents/[id]` detail** + **freelancer availability** (`freelancer_availability` table, migration 045; add/remove windows on `/freelancers/[id]`). **C2 fully done.**
- [~] **C3** Attendance PWA — **BUILT** (build ✓): `/attendance` check-in PWA (`CheckInPanel`: camera selfie capture + GPS + type) → `checkIn` action (uploads to private `attendance-selfies` bucket, haversine geofence match → verified/flagged, inserts `attendance_records` + `write_activity`); **my-records** list, **team-today** (admin), **geofence-config admin** (add fences by coords — `addGeoFence`, so no hardcoded coords). Selfie required by schema. ⚠️ **Camera needs your phone to verify** (getUserMedia can't run headless) — test on the deployed HTTPS URL. **Remaining:** offline queue, KPI feed.
- [~] **C4** WhatsApp **team inbox** — `/whatsapp` thread list (grouped by `thread_key`, last msg + count + direction) → `/whatsapp/[thread]` conversation view (message bubbles in/out, media chips) + **human composer** (`sendWhatsappMessage` → `sendText` + persists outbound + `write_activity`); LID threads correctly block sending until resolved. Linked from `/inbox`. **Remaining:** media download/store + voice transcription, notification fan-out (per-language).

## Phase D — Analytics, social, polish
- [x] **D1** KPIs/Reports interactive — **recharts**: `/kpis` trend sparklines (90d AreaChart per KPI, tone-colored) + `/reports` interactive monthly-revenue BarChart (replaced the static CSS bars; tooltips + axes). **Later:** drill-down + date-range filters.
- [x] **D2** role-aware landing (root/login → role's best surface) + **per-role default dashboard bento** (`roleDefaultLayout` leads each role's most-relevant cards when no saved layout: PM→health/capacity/approvals, AM→suggestions/triage/revenue, finance→revenue, etc.).
- [~] **D3** Social — `/social` (accounts/posts/deals) gained a **content composer**: pick managed account + title + caption + format + planned date → `createContentPost` inserts a `content_posts` idea; **sponsored-deal create** (`createSponsoredDeal` → `sponsored_deals`, tracking-only per D-022) both + `write_activity` (OAuth posting off per D-028). **Remaining:** calendar grid view.
- [~] **D4** ⌘K global search — palette (`packages/ui/CommandPalette` + `/api/search`) already existed; **enhanced** it: people now link to `/team/[id]` + equipment to `/equipment/[id]` (were stubbed to `/admin` & `/equipment`), and **added freelancers + talents** to results (+ type labels/colors). Cross-entity links already live on every detail page. **Remaining:** consolidate shared Card/table primitives into `@antagna/ui`.

## Visual
- [x] **System map** `/system-map` — interactive Obsidian-style force graph (react-force-graph): modules + data stores + AI, color-coded by type, sized by importance, AI-flow links highlighted; hover→focus a node's links, click→zoom, drag→pan. Linked from `/admin`. Verified visually.

## Cross-cutting (from critical review)
- [ ] Data seeding/import (from `volt-os`) so pages aren't empty
- [~] Unified notification service — **`lib/notify.ts` built**: reads the recipient's A7 channel prefs + `ui_language`, fans out to **in-app** (notifications row) + **email** (Resend) + **WhatsApp** (sendText) in their language, records requested/delivered. First consumer wired: **project assignment** (`on_assignment`). Remaining: wire into alerts/deadlines/daily-digest/mentions.
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
