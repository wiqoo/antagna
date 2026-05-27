# Antagna — Product Vision & Re-architecture Plan

> **Draft for Mohammed's review — 2026-05-26.** Nothing here is executed yet.
> This is the "رؤية شاملة" requested before building. It combines a reality
> audit (what's actually built vs stubbed), a per-module vision, the
> cross-cutting systems (automation, permissions, email, WhatsApp, attendance,
> PWA, auth), the information architecture, and a phased roadmap.
> Open questions for Mohammed are collected at the end (and inline as ❓).

---

## 0. North Star

Antagna is the **AI-native internal operating system for Volt Production**. It
should feel **top-notch and heavily automated, but never remove the human** —
the AI drafts, ranks, links, and proposes; **a human approves and acts.**

Three commitments:
1. **Human-in-the-loop automation.** Every automated action is either (a) a
   reversible enrichment (summaries, links, scores) or (b) a *proposal* a human
   approves. Nothing irreversible happens without a person. (This is already
   the model behind `ai_suggestions` — extend it everywhere.)
2. **One connected graph.** Clients ↔ leads ↔ contacts ↔ projects ↔ deliverables
   ↔ tasks ↔ team/freelancers/talents ↔ equipment ↔ emails ↔ WhatsApp ↔ KPIs.
   Every record links to everything related. (Attio-style relational feel.)
3. **Email + WhatsApp are first-class inputs**, not side features. Most work
   starts as a message; the system should turn messages into structured work.

UI north star: **Linear/Attio-grade** restraint on the locked Volt skin (dark,
single orange `#FF6B1A`, hairlines, Vazirmatn, clean cards, tasteful motion).

---

## 1. Reality audit — what's built vs stubbed

> Verified 2026-05-26 by reading code + DB + Playwright. "The data model is
> designed and migrated, but the write-side UI/actions were often never built."

| System | State | Reality |
|---|---|---|
| Dashboard | ✅ Built | V6 clean skin shipped; real data; customizable. |
| Projects + project detail | ✅ Built (deep) | Strong: stages, tasks, comments, deliverables, approvals, reservations. Needs IA polish + linking. |
| Auth (login/register/session/onboarding) | 🟡 Partial | Works. **Missing:** password reset, email-verify callback, invites, magic link. |
| PWA | 🟡 Partial | Manifest + custom SW + register exist. **Broken:** `icon-192/512.png` missing → not installable. No install prompt, thin offline. |
| Permissions / RBAC | 🟡 Partial | `has_permission`/capabilities + RLS exist and bite for anon-key. **But app runs as service-role (bypasses RLS)** + only a coarse admin gate; **no app-layer `can()`, no management UI.** |
| WhatsApp | 🟡 Partial | **Sends + receives** (WPPConnect → webhook → `whatsapp_messages`), gpt-4o-mini bot, 5 read-only tools, self-linking. **Missing:** human team inbox UI, media handling, low-confidence draft review, group support. |
| Equipment | 🟡 Partial | Schema + **working DB engine** (`fn_checkout/return/suggest_kit`, overlap/lead-time/location triggers, battery view) but **zero callers**. Today = read-only catalog + add-form. **Missing:** detail page, reservation/checkout/return/repair/kit/QR/history UI. |
| Freelancers / Talents | 🟡 Schema-only | Rich schema (rates, payout ref, ratings); `project_assignments` supports `freelancer_id`+rate. **Missing:** all roster/detail/assign/availability/payout UI. |
| Attendance | 🟡 Schema-only | Rich schema (selfie, GPS, geofence, PIN, skew). **Zero runtime** — no UI, no capture, no storage bucket; KPI engine skips it. |
| CRM (clients/leads) | 🟡 Thin | Client cards + lead cards read-only; **no funnel, no 360° client card, no lead→client conversion.** |
| Inbox (email intel) | 🟡 Partial | Pipeline runs (ingest→summary→extract→suggest→analyze). UI under-built vs the intelligence behind it. |
| Tasks | 🟡 Thin | Basic list. Needs "my work" + board + project linkage. |
| Social | 🟡 Read-only | Accounts/posts/deals display; OAuth manual (D-028 cancelled); no compose/schedule. |
| KPIs / Reports / Admin | 🟡 Read-only | Display only; no interactivity, no management writes. |

---

## 2. Modules — vision, gap, plan

### 2.0 Dashboard / control panel (the home)
- **Vision:** the dashboard stays the **command center** — the AI daily brief
  hero + the customizable bento (shipped) — and becomes **role-aware** (PM, AM,
  equipment_manager, HR, shooter each get a default set + landing). It's where
  every system surfaces its "what needs you now" (approvals, suggestions,
  alerts, attendance gaps, equipment conflicts). Keep evolving it as new modules
  come online (e.g., an attendance card, a WhatsApp-unread card, a freelancer-
  availability card). Admin/control surfaces (permissions, alerts, KPIs, seed)
  live under الإدارة and stay tightly linked from here.

### 2.1 CRM — clients, leads, contacts
- **Vision:** a lead **pipeline** (board by status with AI conversion scores) + a
  **360° client card** (projects, contacts, email/WhatsApp history, health,
  revenue, payment behavior) + one-click **lead → client/project** conversion.
- **Gap:** funnel + conversion + 360 card.
- **Automation:** Gmail pipeline auto-links threads to clients by domain, auto-
  creates leads, scores them; AI proposes "convert/merge/contact" as suggestions.

### 2.2 Projects + project detail
- **Vision:** keep the deep detail page; restructure into clean tabs (Overview ·
  Tasks · Deliverables · Team · Equipment · Messages · Activity). Add the
  **related-email/WhatsApp** stream and an **auto-built timeline**. List view as
  board + table with AI health.
- **Gap:** IA/visual polish + message linking + timeline. (Backbone is strong.)

### 2.3 Tasks
- **Vision:** "مهامي" (my work) ranked by AI urgency; board per project; quick
  create from anywhere (incl. from an email/WhatsApp message). Link every task
  to its project + source.

### 2.4 Team (employees) + Freelancers + Talents
- **Vision:** unified **People** area, three rosters: **employees** (the 11),
  **freelancers** (crew for hire — rates, specialties, availability, ratings,
  history), **talents** (on-camera/creators — contracts, commission, niches).
  Each gets a **detail page**: workload, skills, assignments, KPIs, (employees)
  attendance, (freelancers) payouts/availability.
- **Gap:** all roster/detail/assignment UI + freelancer **availability** model +
  payouts (or Dafterah reference, since finance is Dafterah's — D-022).
- **Automation:** AI flags overload/idle/skill-gaps (already heuristic on /team).

### 2.5 Equipment — port `volt-os` "inventory" onto our engine
- **Reference confirmed:** `github.com/wiqoo/volt-os` (private, accessible). Its
  `inventory` module is excellent and rich: list + **per-unit detail + history**,
  edit, **metadata/photo editors**, **QR page + scan-to-checkout** (`lab/scan`),
  **AI photo identify/normalize** (`api/ai/identify-equipment`,
  `normalize-equipment`), **setups = kits** (`lab/setups`), **compatibility**
  (`lab/compatibility`), **reservations + conflict detection**
  (`api/scheduling/equipment-conflicts`).
- **Vision:** port that UX onto **our existing DB engine** (we already have
  `fn_checkout/return/suggest_kit`, overlap/lead-time/location triggers, battery
  view — all currently uncalled). Result: detail page, reservation + checkout/
  return flow, maintenance/repairs, kits, QR + scan, AI photo-ID, activity log.
- **Gap:** the entire interactive layer (engine ready, no UI calls it) — but the
  volt-os reference means we adapt proven code rather than invent.
- **Approach:** study volt-os via `gh`, adapt its components to our schema +
  clean skin, wire to our DB functions. (volt-os also has good `employees`,
  `clients`, `admin/permissions` pages worth learning from for those modules.)

### 2.6 Inbox — email intelligence (+ WhatsApp team inbox)
- **Vision:** the inbox is the **automation cockpit**: triaged threads, AI
  summaries/sentiment, the suggestions queue (approve/dismiss), and reply
  drafts. Add a **WhatsApp team inbox** beside email (same thread UI) reading
  `whatsapp_messages`, with a **human send composer** (reuse `sendText`).
- **Gap:** richer email UI + the WhatsApp human inbox + media.

### 2.7 Social
- **Vision:** accounts, a content **calendar/composer** (manual, since OAuth is
  cancelled D-028), sponsored-deal tracking. Lower priority.

### 2.8 KPIs / Reports
- **Vision:** interactive, drill-down, date ranges; role dashboards (PM/AM/
  equipment/HR). Built on the existing `kpi-engine`.

---

## 3. Cross-cutting systems

### 3.1 Automation & AI (human-in-the-loop)
- 11 Trigger.dev workers run today (gmail-scanner, email-send/followup, drive-
  folder, alert-scanner, oauth-health, kpi-engine, daily-brief, insights,
  post-analytics, smart-suggestions). Email Intelligence pipeline is live.
- **Plan:** make each worker's output **visible and actionable** where it
  belongs (brief→dashboard, suggestions→inbox/CRM, alerts→notifications+page,
  kpi→kpis/reports). Generalize the **propose→approve** pattern (today only
  email suggestions) to equipment/CRM/tasks. Add an **"AI activity" trail** so
  Mohammed always sees what the system did and can undo.

### 3.1.5 AI Memory & Monitoring Engine — the system's brain  ⭐
This is the layer that makes Antagna feel intelligent. Three parts, mostly on
tables that **already exist but are empty/unused**:

**(a) System-wide AI memory ("knows everything that happens").**
Every meaningful event — `activity_events`, `audit_log`, email/WhatsApp,
status changes, approvals, check-ins — plus periodic entity snapshots get
embedded into **`ai_memory_chunks` (pgvector, currently empty)** via OpenAI
embeddings (already our stack). The AI then **retrieves across the whole graph
(RAG)** to ground the daily brief, suggestions, the WhatsApp bot, and advice.
*Result: one memory the whole system reads from — nothing happens that it
doesn't "remember."*

**(b) Monitoring & oversight engine (configurable logic).**
A watcher over **workflow progress, employee performance, client satisfaction,
attendance, equipment, and finance refs** — built on the existing
`kpi_definitions`/`kpi_snapshots`, `alert_rules`/`alert_fires`,
`project_insights`, `client_health_snapshots`, and the `insights-scanner`
worker. **Crucially the rules become editable in an admin UI** (thresholds,
conditions, cadence, severity) so the logic *evolves without code changes*.
Outputs: **advice** (as suggestions), **notifications** (in-app + WhatsApp),
and cleaner downstream data.

**(c) Learning loop (improves itself from usage).**
Capture real usage signals — **`decision_outcomes`** (suggestion accepted /
rejected / edited), `ai_action_log`, `template_edit_patterns`,
`project_learnings`, `compatibility_feedback` (all tables exist). Feed them back:
acceptance rates tune suggestion **confidence + ranking**, rejected advice is
suppressed/learned, edit patterns refine templates, outcomes refine KPIs/alerts.
*The more the team uses it, the sharper it gets* — while every action stays
human-approved (the human's choice IS the training signal).

This brain powers the WhatsApp bot's "knowledge" (§3.4), the dashboard's
"what needs you" (§2.0), and per-entity advice everywhere.

### 3.2 Permissions / RBAC  ❓
- **Today:** real at DB (RLS) for anon-key, but the app uses service-role +
  coarse admin gate; no app `can()`; no UI.
- **Plan:** (a) a server-side `requirePermission()/can()` helper used in server
  actions + page guards; (b) an **admin UI** to manage roles, capabilities, and
  per-user overrides (tables already exist); (c) role-aware navigation/landing.
- ❓ How granular do you want it (per-feature actions vs broad role tiers)? Who
  can manage permissions (you only, or GM/PM too)?

### 3.3 Email integration — Gmail (live)
- Keep the pipeline; surface its output better; ensure thread→client/project
  linking is visible and correctable by humans.

### 3.4 WhatsApp — LID fix, webhook upgrade, team scope  ❓
- **Today:** internal bot (read-only Q&A) over WPPConnect; send+receive+persist.

**(a) The LID problem (sender arrives as `@lid`, not the real number)**
- **Cause:** WhatsApp's privacy "hidden ID" (LID). For normal *messages*, the
  payload **often still carries `senderPn`** (the real phone) alongside the
  `@lid` jid — but our webhook currently keys on the jid and doesn't capture it.
- **Short-term fix (current gateway):**
  1. Upgrade the webhook to **extract `senderPn`/`participantPn`** whenever
     present and **persist a LID↔E.164 mapping** (we already have
     `profiles.whatsapp_lid` + `whatsapp_e164`) — auto-fill it the first time
     WhatsApp reveals the number.
  2. Keep the **2-digit self-link code** as the authoritative fallback.
  3. Upgrade WPPConnect to a version with better LID handling; capture group
     `participant` LIDs too.
- **Long-term fix (official):** move to the **WhatsApp Business Cloud API**,
  which introduces **BSUID** (Business-Scoped User ID): from ~Mar–Apr 2026 Meta
  auto-stores the phone↔BSUID mapping in your Contact Book and (Jun 2026)
  usernames roll out. This is the sanctioned, ban-safe path; we store BSUID as
  another identifier on the contact/profile. Bigger lift (Meta verification).

**(b) Webhook upgrade (capabilities · permissions · knowledge)**
- **Capabilities:** beyond the 5 read-only tools → add **write tools via
  propose→approve** (create task, log note, link thread), **media** handling
  (download/store/transcribe voice notes), group support, and the stubbed
  **low-confidence draft-for-review** path.
- **Permissions:** gate every WhatsApp action by the sender's **role/permissions**
  (ties into the RBAC system §3.2) — e.g. only a PM can move a stage via chat.
- **Knowledge:** give the bot **RAG over our data** (the `ai_memory_chunks` +
  pgvector table already exists but is empty), more tools, and short-term
  conversation memory, so it answers from the real graph, not just 5 queries.

**(c) Team scope** ❓ — pick first: (a) **notifications** (push briefs/alerts/
assignments to WhatsApp), (b) **human team inbox** in Antagna, (c) **action bot**.
- ⚠️ **Risk:** WPPConnect uses the **unofficial** protocol → ban risk; plan the
  official Cloud API path for anything mission-critical.

### 3.5 Attendance — PWA check-in  ❓
- **Plan (from 2026 best practice):** PWA check-in/out with **selfie + GPS
  geofence + optional PIN** (anti-buddy-punching), offline-capable capture,
  manager view (who's in/out/late), feeds `kpi-engine` (`attendance_present_pct`).
  Selfies → a private Supabase Storage bucket. Geofences per Volt location.
- ❓ Which locations/geofences (office + sites)? Personal-device check-in,
  shared **kiosk** mode, or both? Is a selfie required or optional?

### 3.6 PWA
- **Quick win:** add the missing `icon-192/512.png` → installable immediately.
- Then: `beforeinstallprompt` custom install button, a real offline shell,
  push notifications (ties into attendance reminders + WhatsApp-style alerts).

### 3.7 Auth — register/login
- **Plan:** add **password reset** + **email-verify `/auth/callback`** +
  (likely) an **invite flow** (admin invites the 11 + freelancers) instead of
  open self-signup; verify every path works end-to-end (Playwright).
- ❓ Open self-signup, or **invite-only** (more appropriate for an internal tool)?

---

## 3.8 Libraries & MCPs we'll likely need

**Libraries (npm) — by module (install when we reach each):**
- **Tables/lists** (CRM, equipment, people): `@tanstack/react-table` (sort/filter/virtualize).
- **Charts** (KPIs/reports interactivity): `recharts` *or* `tremor` (Tailwind-native dashboards).
- **Equipment QR:** `qrcode` (generate labels) + `@zxing/browser` or `html5-qrcode` (scan-to-checkout in the PWA).
- **Attendance:** native MediaDevices (selfie) + Geolocation (GPS) — no lib; plus `browser-image-compression` (shrink selfies); optional `maplibre-gl` to draw geofences on a map.
- **Drag/reorder:** have `framer-motion`; add `@dnd-kit/core` only if grid DnD needs to be more robust.
- **WhatsApp (long-term official path):** Meta Cloud API is plain REST (no lib); if we self-host deeper, `@whiskeysockets/baileys` directly gives better LID control than WPPConnect.
- Likely already present: `zod`, `date-fns`. (I'll confirm before adding anything.)

**MCPs — already installed & enough for most of this:** playwright, chrome-devtools, context7, shadcn, magicui, magic (21st), supabase, stitch. Plus `gh` CLI for the `volt-os` reference.

**MCPs worth adding for this phase (your call):**
- **Sentry MCP** — we have the DSNs; surfaces runtime errors as we build many features (catch regressions fast). *Recommended.*
- **Trigger.dev** — has a CLI already (we use it); an MCP (if available) would let me inspect/manage the 11 workers + add attendance/WhatsApp jobs. *Optional.*
- A **GitHub MCP** is optional — `gh` CLI already covers browsing `volt-os`.
- No good dedicated WhatsApp MCP exists; we drive it via our own gateway/API.

## 4. Information architecture

- **Sidebar (done):** الرئيسية · المشاريع · المهام · الوارد · التقويم ‖ العمل:
  العملاء · المعدات · السوشيال · الفريق ‖ التحليلات والإدارة: KPIs · التقارير ·
  الإدارة · الإعدادات. → Add **People** grouping (team/freelancers/talents) and a
  **WhatsApp** entry (or fold into الوارد).
- **Role-aware landing:** PM → projects; AM → CRM; equipment_manager → equipment;
  HR → team/attendance; shooter/editor → my tasks + my shoots.
- **Entity linking everywhere:** breadcrumbs + related panels on every detail page.

---

## 5. Phased roadmap (proposed)

**Phase A — Foundation & quick wins (low risk, high value)**
1. PWA icons (installable today) + install prompt.
2. App-layer permissions `can()` + role-aware nav (unblocks everything).
3. Auth recovery (reset/verify/invite) + verify flows.

**Phase B — Re-architect the core surfaces** (the pages, per the approved plan)
4. Projects + project detail polish + message linking.
5. Inbox (email) + CRM (funnel + 360 card + conversion).
6. Tasks ("my work").

**Phase C — Build the missing big systems**
7. Equipment interactive UI (wire the engine; port antagna.me UX).
8. People: freelancers + talents rosters/detail/assignment.
9. WhatsApp team inbox (+ notifications).
10. Attendance PWA check-in (selfie+GPS+geofence).

**Phase D — Analytics, social, polish**
11. KPIs/Reports interactivity; social composer; role dashboards.

> Each item: research → present design → build → verify with Playwright → review
> with you. Step-by-step, confirming what actually works.

---

## 6. Open questions for Mohammed

1. ✅ **Equipment reference resolved** — `wiqoo/volt-os` is accessible; I'll port
   its `inventory` UX onto our engine. (No action needed unless you want me to
   also mirror volt-os's `employees`/`clients`/`permissions` patterns.)
2. **Priorities** — does the Phase A→D order work, or do you want a specific
   system first (e.g., equipment or attendance)?
3. **WhatsApp scope** — notifications, human team inbox, or action-bot first?
   (And: OK to keep the unofficial gateway for now despite ban risk?)
4. **Permissions** — granularity (per-feature vs role tiers) and who manages.
5. **Attendance** — locations/geofences, kiosk vs personal device, selfie
   required?
6. **Auth** — keep open self-signup or move to invite-only (internal tool)?
7. **Freelancers** — confirm: freelancers (crew) vs talents (on-camera) split;
   do we need availability + payouts now, or assignment+rates is enough for v1?
