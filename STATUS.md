# Antagna — Live Status

> **The one file Claude Code reads first each session.** Updated every time something changes.
> Static "all ✓" tables live in `README.md`; this is the dynamic state.

**Last updated:** 2026-05-22 (Email Intelligence Phase 1 complete + WhatsApp bot live + Smart suggestions feed)
**Phase:** Phase 1 features running end-to-end in prod. Gmail ingest + Email
Intelligence (extraction → suggestions → execute) + WhatsApp team chat-ops bot
+ daily smart-suggestions scan are all live. Remaining backlog is opt-in
(social OAuth, attendance PWA, AI command bar) or external (legacy DB merge).

**Live URLs:**
- App: <https://antagna-v2.vercel.app> (custom domain `antagna.me` zone added on Cloudflare 2026-05-21)
- WhatsApp bot tunnel: <https://whatsapp.antagna.me> (WPPConnect → Cloudflare tunnel → localhost:21465)

---

## 🎯 Next concrete action

> **Next priority: PWA attendance check-in UI (D-031).** All Email Intel
> Phase 1 work is shipped and deployed; attendance is the chosen next
> feature. Mobile-first, GPS-stamped, plugs into the existing
> `attendance_*` schema + KPI engine.

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
