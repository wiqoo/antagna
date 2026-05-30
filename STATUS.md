# Antagna — Live Status

> **The one file Claude Code reads first each session.** Updated every time something changes.
> Static "all ✓" tables live in `README.md`; this is the dynamic state.

**Last updated:** 2026-05-30 (**inbox manual Gmail-sync button + Vercel build hardened (OOM/Sentry)**; on top of the Phases 0–4 UI/UX overhaul + Sprint 0)
**Phase:** **UI/UX overhaul COMPLETE + live** on antagna-v2. Delivered this pass:
(0) data reset — wiped all smoke data, kept 2 real users + equipment (172) +
reference; seeded the real 11-person team as `invited` (no email yet). (1)
`ListWorkspace` keystone (search/filter/sort/cards-table-compact/saved-view) +
mobile table-wraps + empty states; equipment retrofit verified (camera 172→8).
(2) **System Admin console** `/admin/system` (keys/tokens · AI cost-guard ·
email · brain/memory · settings · subscriptions/cron) + **`/my-day`** per-position
home (routine checklist from `config/routines.yaml` + today's items + position
board). (3) **~26 new pages** to volt-os parity: approvals, notifications,
reservations, repairs, contacts, employees, departments, custom-fields, groups,
meetings, assets, skills, social(×5), locations, stage-templates, compatibility,
tags, equipment metrics, ai-insights, search, changelog + **inbox AI-triage**
(spam/marketing classifier → clean table excluding noise). (4) verified: **all 26
new routes return 200 live**, 0 console errors on spot-checks, mobile overflow
fixed (notifications bell). Migrations 052→058 applied. New perm keys ai.manage/
memory.manage/integration.manage. — Prior: Sprint 0 (Permissions) substantially
complete + live
on antagna-v2 (migrations 048→051). Delivered: `capabilities`→`skills` rename;
16 **positions** + `position_default_permissions` (258 grants); `has_permission()`
by effective positions (multi-hat, NO system_admin bypass, `*`=general_manager);
`current_effective_profile_id()` GUC + `withProfileScope()` helper; **6 `v_*_safe`
masking views** (field-level masking per spec Part 2) with read pages switched
over; Abu Luka content masking; invite-only (self-signup gated + `/admin/invite-user`,
**email held**); per-position dashboards; **acceptance smoke 11/11**. Verified live
(0 console errors on /projects, /dashboard, /admin/invite-user, /team). Equipment
(172) untouched. **2 deliberate holds:** غريب TEMP `*` hat (full access, Test 10
RED by design — delete the override row when ready) + real invite-email dispatch
(category-5, needs your OK). See `01PERMISSIONSforClaudeCode.md` + D-037→D-041.

**Live URLs:**
- App: <https://antagna-v2.vercel.app> (custom domain `antagna.me` zone added on Cloudflare 2026-05-21)
- WhatsApp bot tunnel: <https://whatsapp.antagna.me> (WPPConnect → Cloudflare tunnel → localhost:21465)

---

## 🎯 Next concrete action

> **Sprint 0 is built + live. Finalize + decide the 2 holds, then Sprint 1.**
>
> 1. 🔲 **When ready:** remove غريب's TEMP `general_manager '*'` hat (delete the
>    `user_position_overrides` row) → re-enforces production_director "no
>    financial" → spec Test 10 goes GREEN. Currently full access by your request.
> 2. 🔲 **When approved:** seed real users (Ahmed `ahmedakj.1423@gmail.com`
>    trainee, Abu Luka `mo.malki88@gmail.com` GM+Creative) + enable invite-email
>    dispatch in `/admin/invite-user` (category-5 — currently stubbed).
> 3. ✅ **Page switchover DONE** — 8 read pages (projects list+detail, crm,
>    clients/[id], equipment list+detail, inbox, team/[id]) now read `v_*_safe`
>    via `withProfileScope`. Verified live with view-as (خالد PM sees 3 assigned
>    projects, القيمة masked to "—"). Remaining base-table reads are non-masked
>    aux queries (option lists, aggregate signals) — fine.
> 4. ⏭️ **Then Sprint 1** — Approval Primitive + AI Command Bar Phase A.
> 3. ⏳ Replace the heuristic project_health / at_risk scoring with a
>    real LLM/AI scorer.
> 4. ⏳ PWA attendance check-in (D-031).
>
> V6 motion exploration + Stitch concept live at `/preview/lab/v6`.

---

## 📍 Pillar status

| # | Pillar | Plan | Code | Notes |
|---|--------|------|------|-------|
| 01 | Foundations & Infra | ✓ | ✓ | 8 PASS · Trigger.dev **v4** + Sentry + AI clients live |
| 02 | Data Model | ✓ | ✓ | 8/8 §16 · **110 tables, 4 views, 41 migrations** |
| 03 | Identity & Permissions | ✓ | ✓ | 10/10 §10 · View-as impersonation added |
| 04 | CRM Core | ✓ | ✓ | clients/leads/contacts CRUD + activity surfaces wired |
| 05 | Project Lifecycle | ✓ | ✓ | 9/9 §10 · state machine + comments + deliverables + approval (P16 §N) |
| 06 | Equipment & Reservations | ✓ | ✓ | 9/9 |
| 07 | Social Media Module | ✓ | 🟡 schema + UI | OAuth tokens **cancelled** (D-028) — manual entry permanent |
| 08 | Communications Layer | ✓ | ✓ | Resend on antagna.me + WhatsApp bot live |
| 09 | Attendance & KPIs | ✓ | 🟡 schema + KPI engine | **PWA check-in UI — next sprint (D-031)** |
| 10 | AI & Memory Layer | ✓ | ✓ | daily-brief + insights + Email Intel pipeline + smart suggestions |
| 11 | Automation & Alerts | ✓ | ✓ | alert-scanner + email-followup + smart-suggestions feed |
| 12 | UI/UX System | ✓ | ✓ | tokens + Shell + **51 pages** + view-as bar |
| 13 | Integrations | ✓ | 🟡 | Gmail/Drive live · Calendar runtime + ZATCA deferred (Dafterah owns invoicing) |
| 14 | Deployment & Ops | ✓ | ✓ | CI + Sentry + custom domain + Cloudflare zone |
| 15 | Migration & Launch | ✓ | 🟡 staging tables | Legacy DB merge — when ready |
| 16 | Hardening (patch) | ✓ | ✓ | all 26 patches live |

Legend: ✓ done · 🟡 partial (schema/UI landed, runtime/manual deferred) · ⏳ pending

---

## 📊 Database snapshot

- **110 tables** + 4 views (`v_battery_alerts`, `v_integration_health`,
  `v_email_communication_metrics`, `v_client_communication_health`).
- **41 migrations** applied + tracked in `supabase_migrations.schema_migrations`.
- **Pillar 16 patches:** all 26 hardening items live (B.1-B.5, C.1-C.3, D.1-D.6, E.1-E.5, F-J, N, O, P).
- **Seeded:** 21 capabilities · 5 departments · 14 notification event types · 6 starter tags · 43+ permissions (incl. Email Intel additions) · 126+ role→permission grants · 30 stage task templates · 24 KPI definitions · 12 alert rules · 4 email templates.
- **Resolver functions:** `has_permission`, `has_capability`, `is_assigned_to_project`, `current_user_has_*`, `current_acting_as_id`, `write_activity`, `fn_get_shared_project`, `fn_create_project_from_template`, `fn_suggest_kit_for_equipment`, `fn_checkout_equipment`, `fn_return_equipment`.
- **State machines wired:** projects.stage (with admin override), deliverables.status (Pillar 16 §N approval pipeline).
- **Cron heartbeats:** `antagna_heartbeat` every minute, `antagna_alert_scan_tick` every 5 minutes.

---

## 🤖 Worker / Trigger.dev v4 — 11 tasks live

10 scheduled + 1 regular (daily-brief fans out to smart-suggestions):

| Task | Cadence | Purpose |
|------|---------|---------|
| `gmail-scanner` | 5 min | Ingest + summarize + extract + classify + suggest |
| `email-send-scanner` | 1 min | Drain `email_drafts` via Resend |
| `email-followup-scanner` | hourly | Find threads needing follow-up |
| `drive-folder-scanner` | 2 min | Auto-create project folders |
| `alert-scanner` | 5 min | 4 alert handlers |
| `oauth-health-scanner` | 4 h | Track token expiry |
| `kpi-engine` | daily 04:30 UTC | Compute KPI snapshots |
| `daily-brief` | daily 07:30 KSA | Per-project + per-person AI brief |
| `insights-scanner` | daily | Cross-system insights |
| `post-analytics-capture` | daily | Social analytics rollup (no-op until OAuth wired) |
| `smart-suggestions-scanner` | (triggered by daily-brief) | Proactive opportunities feed |

---

## 📧 Email Intelligence — what runs every 5 min

1. **Ingest** new Gmail threads/messages (`gmail-ingest.ts`)
2. **AI summary** per thread (Haiku) → `email_threads.ai_summary`
3. **Routing** — auto-link to clients by domain, auto-close noise, auto-create leads
4. **Meeting notes** extraction (Read.ai / Gemini Notes / Fathom / Otter / Granola)
5. **Deep extraction** (gpt-4o-mini JSON) → `email_extractions` + parses PDF attachments
6. **Suggestion generation** → `ai_suggestions` queue with confidence tiers
7. **Conversation analysis** → 4-6 sentence narrative + sentiment trajectory + decision points + outcome status

Manual refresh button at `/inbox/suggestions` runs the full pipeline on demand.

---

## 💬 WhatsApp bot — what's running

- **WPPConnect v2.10.0** built from source in Docker (`infra/whatsapp/`)
- **Cloudflare Tunnel:** `whatsapp.antagna.me` → `127.0.0.1:21465` (always-up)
- **LID-aware:** stores `whatsapp_lid` + `whatsapp_e164` separately (privacy v3)
- **Self-service linking:** 2-digit code at `/settings/whatsapp`
- **AI provider:** OpenAI **gpt-4o-mini** (switched from Claude per user feedback)
- **5 tools:** my_open_tasks · project_status · lookup_colleague · antagna_link · recent_activity
- **4.5s debounce + batch** for rapid-fire messages
- **Outbound persistence** so the bot doesn't re-answer its own replies

---

## 🟢 Acceptance verifications green

- Pillar 1 §1: 8/10 (1 partial latency, 1 → Pillar 15)
- Pillar 2 §16: 8/8
- Pillar 3 §10: 10/10
- Pillar 5 §10: 9/9
- Pillar 6: 9/9

`scripts/smoke/` has the 5 acceptance scripts + the 3 Pillar 1 smokes
(auth/ai/pgvector). E2E: 9 Playwright tests under `apps/e2e/` against system Chrome.

---

## 🚧 Open manual items (not blockers — opt-in)

1. **Google Calendar auto-block** on shoot dates — gated behind verifying
   Drive folder auto-create end-to-end first (D-030). Both use the same
   service-account path — validate Drive in prod, then layer Calendar.
2. **Legacy DB dump** — deferred until after this release lands.
3. **Custom domain switch** — `antagna.me` zone is on Cloudflare; flip
   Vercel DNS to it when retiring `antagna-v2.vercel.app`.

---

## 📋 Backlog

### PWA attendance check-in UI (**next sprint** — D-031)
GPS-stamped check-in / check-out installable to mobile. Plugs into existing
`attendance_*` schema + KPI engine. Manager view: who's in, who's out, late.
Notifications via Pillar 8.

### Team Chat — per-project only (deferred — D-032)
Each project has exactly one chat thread, auto-created on project create,
members = project participants. No DMs, no global channels. Will ship when
attendance is done.

### Cancelled (do not reopen without new decision)

- **Social OAuth (IG/TikTok/YouTube)** — D-028. Manual entry is permanent.
- **AI Command Bar** — D-029. Replaced by WhatsApp bot + smart suggestions.

---

## ⚠️ Recent events

- **2026-05-30 (full-scope follow-ups, waves 1-5)** — Executed every audit
  follow-up. **W1 AI cost-safety:** new `assertAiBudget()` guard in `@antagna/ai`
  (enforces company monthly budget + per-user hard caps BEFORE each model call —
  the admin "hard cap" was display-only) wired into all ~15 AI surfaces; added
  `recordUsage` to the untracked spenders (gmail-summarize/email-intel/whatsapp-
  bot/meeting-notes) + prompt caching to gmail-summarize; priced gpt-4o-mini.
  **W2:** Drive folder now created synchronously at project creation (cron still
  backstop); `/search` gated + routed through `v_*_safe` (was leaking team
  email); M6/L9 legacy `profiles.role` gates → permission keys. **W3 nav perm-
  filtering:** privileged nav items hidden from users lacking the keys (sidebar+
  dock+drawer); `canMany` rewritten to ONE query (was N — flooded the cold pool
  via Shell, broke the dashboard; fixed). **W4 worker:** kpi-engine `profiles.
  active`→`status='active'` (was writing 0 snapshots); alert-notifier ROLE_MAP
  missing audiences→falls back to admins (alerts notified nobody). **Worker
  redeployed** (Trigger.dev v20260530.1). **W5:** L2 addContact errors surfaced,
  L4 industry dropdown parity, L5 repairs gating, L10 receipt table wrap.
  Verified live (view-as videographer: gates redirect, financials masked, nav
  trimmed, dashboard healthy cold+warm). **Still open (your call):** off-policy
  gpt-4o-mini swap (now tracked+capped), Gmail OAuth connect (creds+SITE_URL
  ready), freelancers/talents masking views, Arabic-in-mono font, + the new-
  feature gaps (leads create route, client_health pipeline, contact_methods
  social types). See `docs/AUDIT-2026-05-30.md`.
- **2026-05-30 (deep audit + fixes)** — Two multi-agent audits (page-by-page +
  UX/IA/fonts/AI/permissions) → `docs/AUDIT-2026-05-30.md`. **Permissions were
  NOT uniformly enforced**: DB model (`has_permission`, `v_*_safe`) correct, but
  ~18 pages/actions only checked `if(!user)` + read base tables. **Fixed + live-
  verified** (view-as videographer: /employees·/reports·/inbox·/whatsapp all
  redirect; /equipment loads with financials masked; dashboard revenue card
  absent from payload): C1 employees salary, C2 inbox-thread IDOR, C3 WhatsApp
  (was ungated — `whatsapp.send` seeded but never wired), H1 equipment fin, H2
  project-edit, H3 client legal/VAT, H4 reports+kpis, H5 freelancers/talents +
  ungated availability writes, M1 task IDOR, M2 11 render guards, M3 dashboard
  revenue, + 4 ungated AI actions (parseBriefRich, identifyEquipmentPhoto vision,
  generateBriefing, reanalyzeProject). **UX:** desktop sidebar-overflow (content
  column margin+min-w-0+overflow-x-clip), mobile dashboard cards (grid-cols-1→
  sm:2→md:12 + responsive spans), **fonts unified on Vazirmatn** (body was
  cyclic-var→Geist; now direct), inbox added to mobile dock. **Dashboard cold-
  start reliability**: streamed board behind Suspense + every query bounded by
  6s timeout (was hitting Vercel runtime timeout → error boundary on cold).
  **Build:** webpackMemoryOptimizations + skip in-build tsc (OOM) + Sentry
  errorHandler. **Drive auto-folder confirmed working** (Trigger.dev cron).
  **Known follow-ups:** AI cost-cap is display-only (no enforcement), off-policy
  gpt-4o-mini ×3, nav not permission-filtered, freelancers/talents need masking
  views. Gmail still needs connecting on antagna-v2 (creds + stable SITE_URL set).
- **2026-05-30** — **Inbox manual Gmail-sync button** + **Vercel build
  hardened**. Added a "تحديث الوارد" button on `/inbox` (`syncInboxAction` →
  resolves connected mailbox → runs `ingestGmail` 7d/50-thread; returns a
  structured result so an unconnected Gmail shows a friendly "اربطه من
  الإعدادات" toast instead of a 500). Verified live (button renders, click =
  0 console errors, graceful not-connected path). Then fixed a **chain of 3
  prod-deploy failures** the overhaul's page-count growth exposed: (1) 8 GB
  Vercel build container **OOM** → `experimental.webpackMemoryOptimizations`
  + Sentry `deleteSourcemapsAfterUpload`; (2) transient Sentry **503** on
  `releases new` → `unstable_sentryWebpackPluginOptions.errorHandler`
  downgrades any Sentry build error to a warning (a Sentry outage can no
  longer fail a deploy); (3) a misplaced option I shipped unvalidated →
  fixed + now gate every config change on a full local `next build`. Deploy
  green (`m1te8v592` ● Ready). Full-scope waves recap: **A** writes proven
  end-to-end, **B** field-masking enforced, **C** orders/procurement +
  admin-parity + mobile + E2E — all live.
- **2026-05-26 (eve)** — **Dashboard shipped to production** (D-036). Applied
  the V6 "clean" skin to the real `/dashboard`: Arabic card titles (not `//`
  code), Vazirmatn body, higher contrast, per-card quick actions, Framer
  Motion (entrance/hover/reflow). Merged `feat/dashboard-v5-port` → `main`
  and `vercel deploy --prod`. Mono skin kept only in `/preview/lab/v5`.
- **2026-05-26 (pm)** — **V6 motion preview + Stitch concept** on branch
  `feat/dashboard-v5-port`. `/preview/lab/v6/dashboard` = V5 bento + Framer
  Motion (spring entrance, weightless hover, drag-float-snapback, layout
  reflow, parallax hero). `/preview/lab/v6/stitch` = a Google Stitch
  (Gemini 3.1 Pro) alternative concept honoring the palette. Added
  `framer-motion`. Review: <https://antagna-v6.vercel.app/preview/lab/v6>.
  Preview env (16 vars) set for all preview branches via `preview ""` trick
  (see [[project-vercel-preview-env]]).
- **2026-05-26** — **V5 bento ported to production `/dashboard`** (D-033)
  on branch `feat/dashboard-v5-port`. New shared `dashboard/cards/` module
  is the single source of truth (preview labs re-export it). 10 cards wired
  to the existing Supabase queries; `DashboardGrid` adds size-cycle +
  drag/▲▼ reorder + add-card + hide, persisted in a `dash_layout` cookie.
  Old `dashboard-customize.*` (show/hide-only) removed. Typecheck + prod
  build green. Not merged — pending visual review + preview deploy.
- **2026-05-25** — Design system journey + Stitch MCP. Built five
  preview labs (`/preview/lab/v1..v5`) exploring eight aesthetic
  directions over a long session. User rejected V1 (boring variants),
  V2 (too over-the-top, gradients clash with palette), V3 (still not
  it), and V4 (~30% liked — kept the table-style + monospace headers,
  but the workbench layout itself was rejected as "too big"). **V5
  picked**: bento layout, 28 AI cards, ٤ AI-density tiers (heavy /
  medium / light / none), 1-px orange top-stripe whose opacity encodes
  AI weight. Aesthetic preferences captured in
  `memory/feedback_design_taste.md`. Added Google Stitch MCP server
  (local scope) so future sessions can generate UI variants directly.
  Decisions D-033 (V5 direction), D-034 (palette discipline),
  D-035 (28-card catalog) logged.
- **2026-05-22** — Long bug-fix + UI session: Vercel region pinned to
  hnd1 (co-located with Supabase Tokyo), pdf-parse quarantined as
  serverExternalPackages (was 500ing every gmail/summarize), middleware
  exclude list for `sw.js` + manifest (PWA was bricking on iOS),
  `recordUsage` now resolves authUserId → profileId internally (FK
  violation fixed), 6-second per-query timeout on dashboard (was
  hitting the 300s Vercel limit), AppShell dock flipped to visual
  right, project codes demoted to subtitles across CRM/projects/
  equipment.
- **2026-05-22 (afternoon)** — Backlog cleaned: Social OAuth **cancelled** (D-028), AI Command Bar **cancelled** (D-029), PWA attendance check-in **promoted to next sprint** (D-031), Team Chat **locked to per-project only** + deferred (D-032), Calendar runtime **gated behind Drive verification** (D-030). README + STATUS + bootstrap refreshed.
- **2026-05-22** — Email Intel Phase 1 complete: attachment parsing (PDFs via pdf-parse) + cross-thread conversation analysis + proactive smart-suggestions feed. WhatsApp bot switched to gpt-4o-mini with tighter persona. Migration tracking gap (032-041) repaired in `supabase_migrations.schema_migrations`.
- **2026-05-21** — Custom domain `antagna.me` zone added on Cloudflare. WPPConnect WhatsApp bot live via Cloudflare tunnel. View-as impersonation for admins.
- **2026-05-20** — Resend domain switched to `antagna.me`. E2E Playwright (9 tests) added. Trigger.dev migrated v3 → v4.
- **2026-05-19** — Feature pages landed: `/projects`, `/tasks`, `/crm`, `/equipment`, `/kpis`, `/inbox`. Worker scanners.
- **2026-05-17** — Pillars 7–15 schema + Pillar 12 UI foundations.
- **2026-05-14** — Blueprint locked. Pillar 1 → 6 complete + verified.

---

## 🔄 How to update this file

When you finish a chunk of work:
1. Tick the matrix above.
2. Move the "Next concrete action" pointer.
3. Add to "Recent events" if anything surprising happened.

Keep this file **under 200 lines.** It's a status board, not a journal.
