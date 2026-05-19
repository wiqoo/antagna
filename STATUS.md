# Antagna — Live Status

> **The one file Claude Code reads first each session.** Updated every time something changes.
> Static "all ✓" tables live in `README.md`; this is the dynamic state.

**Last updated:** 2026-05-19 (feature pages + worker scheduled tasks landed)
**Phase:** Feature surfaces wired end-to-end (Projects, Tasks, CRM, Equipment,
KPIs, Inbox — all listing + reading real data via Drizzle). Trigger.dev scanner
tasks coded against the schema. Remaining: integration runtime (Google JSON,
Resend, social OAuth), legacy data merge, Trigger.dev prod deploy.

**Live URL:** <https://antagna-v2.vercel.app>

---

## 🎯 Next concrete action

> **Manual blockers are the only thing gating production launch.** App now
> renders every feature surface against the real schema. The runtime
> integrations and the legacy data merge are the remaining work — see the
> blockers section below.
>
> If a blocker frees up: wire the corresponding runtime layer (Gmail send,
> Drive folder create, social post fetch). The schema + scheduled scanners
> already exist; they just call no-op stubs until tokens arrive.

---

## 📍 Pillar status

| # | Pillar | Plan | Code | Verified |
|---|--------|------|------|----------|
| 01 | Foundations & Infra | ✓ | ✓ | ✅ 8 PASS |
| 02 | Data Model | ✓ | ✓ | ✅ 8/8 §16 |
| 03 | Identity & Permissions | ✓ | ✓ | ✅ 10/10 §10 |
| 04 | CRM Core | ✓ | 🟡 schema | runtime → Pillars 8/10 |
| 05 | Project Lifecycle | ✓ | ✓ | ✅ 9/9 §10 |
| 06 | Equipment & Reservations | ✓ | ✓ | ✅ 9/9 |
| 07 | Social Media Module | ✓ | 🟡 schema | OAuth → manual |
| 08 | Communications Layer | ✓ | 🟡 schema | Resend domain + WhatsApp VPS → manual |
| 09 | Attendance & KPIs | ✓ | 🟡 schema | PWA UI → Pillar 12 |
| 10 | AI & Memory Layer | ✓ | 🟡 schema + scanners | daily-brief + insights-scanner coded; Trigger.dev prod deploy → manual |
| 11 | Automation & Alerts | ✓ | 🟡 schema + scanner | alert-scanner coded with 4 handlers; Trigger.dev prod deploy → manual |
| 12 | UI/UX System | ✓ | ✓ | tokens + shell + 6 feature pages (Projects/Tasks/CRM/Equipment/KPIs/Inbox) |
| 13 | Integrations | ✓ | 🟡 schema | Google service account + OAuth → manual |
| 14 | Deployment & Ops | ✓ | 🟡 CI + runbooks | custom domain + Sentry tier → manual |
| 15 | Migration & Launch | ✓ | 🟡 staging tables | run when ready to merge legacy data |
| 16 | Hardening (patch) | ✓ | ✓ | applied across pillars |

Legend: ✓ done · 🟡 partial (schema landed, runtime/UI/manual deferred) · ✅ tested · ⏳ pending

---

## 📊 Database snapshot

- **107 tables** + 2 views (`v_battery_alerts`, `v_integration_health`) in `nicijexpmpekzuzevarf`.
- **31 migrations** applied.
- **Pillar 16 patches:** all 26 hardening items live (B.1-B.5, C.1-C.3, D.1-D.6, E.1-E.5, F-J, N, O, P).
- **Seeded:** 21 capabilities · 5 departments · 14 notification event types · 6 starter tags · 43 permissions · 126 role→permission grants · 30 stage task templates · 24 KPI definitions · 12 alert rules · 4 email templates.
- **Resolver functions:** `has_permission`, `has_capability`, `is_assigned_to_project`, `current_user_has_*`, `current_acting_as_id`, `write_activity`, `fn_get_shared_project`, `fn_create_project_from_template`, `fn_suggest_kit_for_equipment`, `fn_checkout_equipment`, `fn_return_equipment`.
- **State machines wired:** projects.stage (with admin override), deliverables.status (Pillar 16 §N approval pipeline).
- **Cron heartbeats:** `antagna_heartbeat` every minute, `antagna_alert_scan_tick` every 5 minutes (worker scanner listens).

---

## 🟢 Acceptance verifications green

- Pillar 1 §1: 8/10 (1 partial latency, 1 → Pillar 15)
- Pillar 2 §16: 8/8
- Pillar 3 §10: 10/10
- Pillar 5 §10: 9/9
- Pillar 6: 9/9

`scripts/smoke/` has the 5 acceptance scripts + the 3 Pillar 1 smokes (auth/ai/pgvector).

---

## 🚧 Open blockers (for feature/runtime layers)

1. **Google service account JSON** (Pillar 13 runtime). Needed for Drive/Calendar/Gmail-on-behalf-of-user.
2. **Resend domain verification** for `notifications.voltsaudi.com` (Pillar 8 send target).
3. **Social platform OAuth tokens** (Instagram/TikTok/YouTube) (Pillar 7 analytics).
4. **Trigger.dev PROD API key** (when first prod-grade task ships).
5. **Custom domain** (Pillar 14 §3).
6. **Supabase email confirmation re-enable** before real user launch (Pillar 15 cutover).
7. **Legacy DB dump** when ready for Pillar 15 cutover.

---

## ⚠️ Recent events

- **2026-05-19** — Feature pages landed: `/projects` (list/detail/new + stage
  state machine + comments), `/tasks` (project + daily, status toggles),
  `/crm` (clients + leads), `/equipment` (catalog + 14d reservation window),
  `/kpis` (latest snapshots by scope), `/inbox` (email threads + drafts +
  WhatsApp). Worker scheduled tasks added: `alert-scanner` (4 handlers),
  `daily-brief`, `insights-scanner`, `post-analytics-capture`. `@antagna/db`
  client made lazy so Next.js builds without DATABASE_URL at module-load time.
- **2026-05-17 (evening)** — Pillars 7–15 schema + Pillar 12 UI foundations
  landed end-to-end. 107 tables, 31 migrations, new `@antagna/ui` workspace
  with tokens + AppShell + StatusPill / MoneyDisplay / Kbd. CI workflow added
  (type-check + build + migration syntax check). 5 ops runbooks under
  `docs/runbooks/`.
- **2026-05-17 (afternoon)** — Pillars 2–6 complete + verified, OpenAI rotated,
  Trigger.dev DEV key, Resend / Google / Sentry tokens all live in env.
- **2026-05-17 (morning)** — Pillar 1 complete (8 PASS), Sentry verified live,
  single-Supabase plan locked.

---

## 🔄 How to update this file

When you finish a chunk of work:
1. Tick the matrix above.
2. Move the "Next concrete action" pointer.
3. Add to "Recent events" if anything surprising happened.

Keep this file **under 200 lines.** It's a status board, not a journal.
