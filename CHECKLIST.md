# Antagna — Build Checklist (live)

> **Tracker for the full re-architecture.** I tick items + commit/push after each one,
> so this page always reflects real progress. Plan: `PRODUCT-VISION.md` + `PHASE-2-PLAN.md` +
> `.claude/plans` (approved). **Last updated: 2026-05-29 — Permissions spec
> (`01PERMISSIONSforClaudeCode.md`) landed in repo. Sprint 0 Phase A STARTED.
> Live-DB audit reconciled the naming plan → D-041 (drop empty `skills` stubs
> before rename; new access codes extend `permissions` not a new `capabilities`
> table; helper = `user_has_permission`; spec Part 3 RLS-first superseded by
> D-039). Prior: Phases A·B·C·D sealed + 🚀 live on antagna-v2
> (https://antagna-v2.vercel.app). Cowork audit swept. PHASE-2-PLAN locked:
> Sprint 0 (4w) → Sprints 1-4 (8w) = 12 weeks. Decisions D-037 → D-041 locked.**
> Legend: `[x]` done · `[~]` in progress · `[ ]` not started.

## 🐛 Bug sweep — Cowork audit (2026-05-28)
- [x] **#2** `/projects/new` wizard step-5 silent submit — pre-submit guard + disabled button + visible bounce-back message.
- [x] **#3** Number formatting `9.688` → `9,688` — `Counter` default branch locked to `maximumFractionDigits: 0`.
- [x] **#4** Dashboard cards empty (only briefing visible) — `resolveLayout` defensive fallback to `roleDefaultLayout` when a corrupted cookie hides everything.
- [x] **#5** AI parse 8s silence — rolling progress hint (يقرأ النصّ → يستخرج العميل → يحلّل التواريخ → يقترح deliverables → لمسات أخيرة).
- [x] **#9** ⌘K search bar small — bumped to h-9 / min-260px / aria-label.
- [x] **#12** `/calendar` 7/14/30 only — added 45-day view.
- [x] **#13** `/inbox/suggestions` confidence % unexplained — tooltip with tier table + A4 learning-loop blend formula.
- [x] **#1** `/projects/[id]` server crash — NOT REPRODUCIBLE (server returned 200 + full HTML in 2.4s; audit baseline `cc69f7f` was 3 commits stale).
- [x] **#7** `/whatsapp/[thread]` no composer — exists (WhatsappComposer).
- [x] **#8** `/admin/access` duplicate users — no duplicate emails in DB.
- [x] **#10** View-as visible to all — already gated on ADMIN_ROLES.
- [x] **#6** `/kpis` partial fix — 6 new engine handlers (team_size_count, tasks_completed_count, shoots_completed_count, projects_count_last_12mo, days_brief_to_quote, days_quote_to_award). Remaining 14 keys still need Dafterah (revenue/payment/margins) + survey ingestion (NPS/complaints) — wired in Sprint 4.
- [x] **#11** mixed AR/EN labels — 22 translations across 6 files (admin/integrations, clients/new, equipment/new, projects/[id]/edit, projects/new). Tech acronyms (VAT, KPI, Workspace) intentionally kept.
- [x] **#14** `/admin` bundle — analyzed via @next/bundle-analyzer (`ANALYZE=true pnpm build`). Result: `/admin` client JS is **5.6 KB**; the audit's "329KB" was server-rendered HTML + drizzle runtime. No optimization needed.
- [x] **#15** `/tasks` TTFB — 3 sequential probes: 1.44s / 0.48s / 0.48s. Confirmed Vercel cold-start; warm requests are 480ms. Not a real perf bug.

## 📐 Phase 2 — Strategic re-architecture (12 weeks, see PHASE-2-PLAN.md)
**Sprint 0 — Permissions architecture (Weeks 1-4)** · locked decisions D-037/D-038/D-039/D-040/D-041 · spec: `01PERMISSIONSforClaudeCode.md`:
- [x] Phase A — **DONE + deployed 2026-05-29** (migrations 048+049 on live antagna-v2, verified via SQL + Playwright). Dropped empty `skills` stubs → renamed `capabilities → skills` + `user_capabilities → user_skills` (21+19 rows, audit triggers re-armed); extended `permissions` with 20 fine-grained codes + `*` sentinel; renamed `role_default_permissions → position_default_permissions` + seeded 16-position matrix (258 rows); rewrote `has_permission()` to resolve by effective positions (multi-hat) with NO system_admin bypass. Swept 8 source files. **9/10 spec tests pass; Test 10 fails BY DESIGN** (غريب TEMP `*` hat — cleanup item below). Reviewed via multi-agent workflow before apply.
- [x] Phase B — **DONE within 049**: `positions` table (16) + `profiles.position_key` + `user_position_overrides` (multi-hat: Abu Luka GM+Creative, Mohammed Prod+SysAdmin+TEMP GM). All 17 profiles mapped. Dedicated assignment UI → Phase F.
- [ ] Phase C — app-layer integration: `current_effective_profile_id()` GUC fn (migration 050) + `withProfileScope()` transaction helper in `@antagna/db` + authz.ts JSDoc fix (system_admin bypass removed). `can()` stays as-is (position-aware via has_permission).
- [ ] Phase D — Safe views (`v_projects_safe`/`v_clients_safe`/`v_contacts_safe`/`v_email_threads_safe`/`v_equipment_safe`/`v_profiles_safe`) + pages switch to views + write-side guards.
- [ ] Phase E — Abu Luka content edge case (`is_abu_luka_content` + crew-sees-project-no-client visibility).
- [ ] Phase F — Disable self-signup + `/admin/invite-user` + seed Ahmed (`ahmedakj.1423@gmail.com`) + Abu Luka (`mo.malki88@gmail.com`).
- [ ] Phase G — Per-position dashboard layouts (10 personas).
- [ ] Phase H — 10 audit specs (Playwright) + team sign-off.

**🟡 Sprint 0 — open decisions (deferred, need Mohammed before Phase C/D proceed):**
- [ ] **D-1 · Phase D go/no-go** — switching all read pages (projects/crm/equipment/inbox/team) to `v_*_safe` masking views changes what every user sees + is the biggest regression surface in Sprint 0. With غريب on full access + all data dummy, impact on Mohammed's own use is minimal now. **Decision: build Phase C (GUC, zero-risk) + Phase D views now, or hold?** _Recommendation: proceed; keep the page-switchover behind tight verification._
- [ ] **D-2 · غريب TEMP `*` hat** — keep full access until when? Cleanup = delete the `user_position_overrides` (`general_manager`, `mohammedelghareib@gmail.com`) row to re-enforce production_director "no financial" (Test 10). _Default: keep until Mohammed says remove._
- [ ] **D-3 · migration-history drift** — `supabase_migrations.schema_migrations` only records up to `041`, but `042`–`049` are applied. A future `supabase db push` would try to re-apply `042`–`047`. **Backfill the history rows (safe) or leave?** _Recommendation: backfill 042–047._
- [ ] **D-4 · pillar3 smoke obsolete** — `scripts/smoke/pillar3-acceptance.ts` tests #1/#2 assert the retired role-based model + system_admin bypass → fail by design. Rewrite for the position model in Phase H.
- [ ] **D-5 · Phase F invite emails (category-5)** — seeding real users Ahmed (`ahmedakj.1423@gmail.com`) + Abu Luka (`mo.malki88@gmail.com`) dispatches invite emails to real humans → needs explicit Mohammed OK at that point (DB-only seed can run earlier).

**Sprint 1 — Approval Primitive + AI Command Bar Phase A (Weeks 5-6)**.
**Sprint 2 — Event Bus foundation + UI consolidation (kill `/preview/lab`) (Weeks 7-8)**.
**Sprint 3 — Command Bar Phase B + Approval Primitive wiring + Realtime (Weeks 9-10)**.
**Sprint 4 — Rules Engine v0 (templated, not free-form DSL) + 5 outbound automations (Weeks 11-12)**.

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
- [x] **B4** `/tasks` built+on-DNA ("my work" ranked by urgency, priority tones, daily+project tasks, quick-create). **Done:** `write_activity` on task status-change (+ revalidates the project) and daily-task create. **Later:** per-project task board, quick-create from a message.

## Phase C — Big systems
- [x] **C1** Equipment — **`/equipment/[id]` detail page** (photo/specs/financials/battery, reservations, activity timeline) + **checkout/return** wiring the previously-uncalled `fn_checkout_equipment`/`fn_return_equipment` + **status** (repair/available) + **charge** + `equipment_activity_log` + `write_activity`; list rows now link to detail. Verified end-to-end via QA login (status change mutated DB + logged, then reverted). **QR label** (server-rendered SVG on `/equipment/[id]`), **`/equipment/scan`** camera scanner (@zxing/browser, auto-navigate on detect + manual fallback), **AI photo-ID** (Claude vision on `/equipment/new` — suggests brand/model/category + applies to form). **Kits CRUD** at `/equipment/kits` (create + add/remove items with mandatory flag, primary-equipment selector) — schema already had `kits`/`kit_items`/`kit_suggestions`/`compatibility_rules`; this exposes the writers, the readers (`fn_suggest_kit_for_equipment`) light up automatically once a kit is seeded. Compatibility rules table writers can ship next as data lands.
- [x] **C2** People — `/team/[id]` employee detail + `/freelancers` roster+detail + **`/talents` roster** (category/niches/commission/contract) + **assignment composer** (project team form picks members **or freelancers** → `project_assignments` + `write_activity`). All linked from `/team`; **`/talents/[id]` detail** + **freelancer availability** (`freelancer_availability` table, migration 045; add/remove windows on `/freelancers/[id]`). **C2 fully done.**
- [x] **C3** Attendance PWA — **BUILT** (build ✓): `/attendance` check-in PWA (`CheckInPanel`: camera selfie capture + GPS + type) → `checkIn` action (uploads to private `attendance-selfies` bucket, haversine geofence match → verified/flagged, inserts `attendance_records` + `write_activity`); **my-records** list, **team-today** (admin), **geofence-config admin** (add fences by coords — `addGeoFence`, so no hardcoded coords). Selfie required by schema. ⚠️ **Camera needs your phone to verify** (getUserMedia can't run headless) — test on the deployed HTTPS URL. **Remaining:** offline queue, KPI feed.
- [x] **C4** WhatsApp **team inbox** — `/whatsapp` thread list (grouped by `thread_key`, last msg + count + direction) → `/whatsapp/[thread]` conversation view (message bubbles in/out, media chips) + **human composer** (`sendWhatsappMessage` → `sendText` + persists outbound + `write_activity`); LID threads correctly block sending until resolved. Linked from `/inbox`. **Remaining:** media download/store + voice transcription, notification fan-out (per-language).

## Phase D — Analytics, social, polish
- [x] **D1** KPIs/Reports interactive — **recharts**: `/kpis` trend sparklines (90d AreaChart per KPI, tone-colored) + `/reports` interactive monthly-revenue BarChart (replaced the static CSS bars; tooltips + axes). **Later:** drill-down + date-range filters.
- [x] **D2** role-aware landing (root/login → role's best surface) + **per-role default dashboard bento** (`roleDefaultLayout` leads each role's most-relevant cards when no saved layout: PM→health/capacity/approvals, AM→suggestions/triage/revenue, finance→revenue, etc.).
- [x] **D3** Social — `/social` (accounts/posts/deals) gained a **content composer**: pick managed account + title + caption + format + planned date → `createContentPost` inserts a `content_posts` idea; **sponsored-deal create** + **content-calendar month grid** (7-col Sat-first; posts placed by `planned_publish_at`, today highlighted) — tracking-only per D-022, OAuth posting off per D-028. **D3 done.**
- [x] **D4** ⌘K global search — palette (`packages/ui/CommandPalette` + `/api/search`) already existed; **enhanced** it: people now link to `/team/[id]` + equipment to `/equipment/[id]` (were stubbed to `/admin` & `/equipment`), and **added freelancers + talents** to results (+ type labels/colors). Cross-entity links already live on every detail page. **Remaining:** consolidate shared Card/table primitives into `@antagna/ui`.

## Visual
- [x] **System map** `/system-map` — interactive Obsidian-style force graph (react-force-graph): modules + data stores + AI, color-coded by type, sized by importance, AI-flow links highlighted; hover→focus a node's links, click→zoom, drag→pan. Linked from `/admin`. Verified visually.

## Cross-cutting (from critical review)
- [x] Data seeding (hybrid per D-038 spirit) — 162 equipment rows + photos + AI-extracted specs imported from volt-os live (`jhfkgmomntkgzzycdbmt`) into antagna-v2 on 2026-05-28. Result: 172 total equipment, 136 with photos, 14 normalized categories, 148 with ai_meta + 153 with compatibility_tags from volt-os's earlier AI pass. CRM + employees stay manual per the Hybrid pick.
- [x] Unified notification service — **`lib/notify.ts` built**: reads the recipient's A7 channel prefs + `ui_language`, fans out to **in-app** (notifications row) + **email** (Resend) + **WhatsApp** (sendText) in their language, records requested/delivered. First consumer wired: **project assignment** (`on_assignment`). All channels wired: **deadlines** (deadlineNotifier, 2h via insights-scanner) · **alerts** (alertNotifier, 5min via alert-scanner — recipient_strategy → role mapping → fan-out + notified_profile_ids stamp) · **daily-digest** (dailyDigest, mornings via daily-brief — open tasks + due-today + unread emails per active profile) · **mentions** (postComment parses @email-prefix tokens → on_mention fan-out, skipping the author + already-notified PM).
- [x] Automated tests — **Vitest** (12 unit tests on roleLanding + project-stage helpers in `apps/web`) + **Playwright E2E** (apps/e2e: dashboard, projects-list, inbox, view-as, gmail-admin, **equipment+kits**, **attendance**, **command-palette** — 8 specs). CI job in `.github/workflows/ci.yml` (`unit-tests` + `e2e`) runs both on push/PR; E2E gracefully no-ops if `E2E_*` secrets aren't set in repo Settings.
- [x] Every page verified mobile (390) + basic a11y + RTL/LTR — Playwright sweep at 390x844 on 9 surfaces (dashboard/tasks/projects/equipment/attendance/team/whatsapp/inbox/social): 0 horizontal overflow, every page has an `<h1>`, 0 img-without-alt, 0 button-without-aria after the topbar-logout fix. RTL preserved by direction inheritance from `<html dir>`.

## Every page on ONE DNA (no exception)
- [x] Verified via Playwright sweep @390 px on 9 surfaces (2026-05-28): /dashboard · /projects · /tasks · /equipment · /attendance · /team · /whatsapp · /inbox · /social — every page has an `<h1>`, 0 horizontal overflow, 0 img-without-alt, 0 button-without-aria (after the topbar-logout fix).

## Manual items from Mohammed (I'll remind at each)
- [x] Volt-os live DB read authorized + executed 2026-05-28 (equipment import + team-email lookup — saved in [[project_team_emails]] memory).
- [x] Auth: **invite-only** locked (D-040) + emails pulled from live: Ahmed → `ahmedakj.1423@gmail.com`, Abu Luka → `mo.malki88@gmail.com`.
- [x] Mohammed (غريب) = production_director + system_admin override (D-037, D-040). Production_director **without** financial visibility.
- [ ] **TEMP: remove غريب's full-access hat** — migration 049 grants Mohammed a `general_manager` hat (`*` = everything, incl. financial) per his 2026-05-29 request "give me all perms now, remove later". DELETE the `user_position_overrides` row (`position_key='general_manager'` for `mohammedelghareib@gmail.com`) to re-enforce the intended `production_director` "no financial" restriction (spec Test 10).
- [ ] **Attendance geofence coords** — office + recurring shoot locations (lat/lng + radius). Needed when Sprint 0 Phase E finalizes the personal-PWA attendance UX.
- [ ] **Optional/later** — Sentry token with `event:read` scope (current is release-only — limits proactive Sentry triage). DNS flip `antagna.me` → Vercel when retiring the `.vercel.app` URL.

## Decisions locked this session (D-NNN — see `decisions-log.md`)
- D-037 — 16-position × field-masking permissions architecture.
- D-038 — rename existing `capabilities` (skills catalog) → `skills`; reclaim `capabilities` for access codes.
- D-039 — enforcement: app-layer `can()` + safe views, NOT user-token RLS. RLS as belt-and-suspenders.
- D-040 — auth model: invite-only (supersedes "open self-signup").
