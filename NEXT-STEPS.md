# Antagna — Remaining work (post Phases A–D)

> The full plan (A→D) is **built + deployed** to `antagna-v2.vercel.app`. This file
> tracks what's left, grouped by *what each item needs*. Pick from here when ready.
> Live tracker of done work: `CHECKLIST.md`.

## ① Needs Mohammed's input / decision (can't be coded around)
- [ ] **Auth model** — invite-only vs open self-signup; if invite, the 2 missing team emails (Abu Luka, Ahmed in `roles.yaml`).
- [ ] **Data** — approve reading the `volt-os` LIVE DB for a one-time import (clients/equipment/people), OR keep manual entry / start fresh.
- [ ] **DNS** — flip `antagna.me` → antagna-v2 when you want it on the main domain (today it serves `*.vercel.app`).
- [ ] **Attendance geofences** — enter office/site coords + radius via the admin UI on `/attendance` (no code needed; I built the form).
- [ ] **(optional)** Sentry `/mcp` OAuth at the Ubuntu machine (only to let me query Sentry).

## ② Needs a new dependency / external API
- [ ] **Equipment QR** — labels (`qrcode`) + scan-to-checkout (`@zxing/browser`) in the PWA.
- [ ] **Equipment AI photo-ID** — port volt-os `api/ai/identify-equipment`.
- [ ] **WhatsApp media/voice** — download/store media + voice transcription (Whisper/OpenAI).
- [ ] **Unit tests** — Vitest for authz / role-landing / notif-prefs / haversine / confidence. (Playwright E2E already exists in `apps/e2e`.)

## ③ Needs a new table / schema
- [ ] **Freelancer availability** — availability table + UI on `/freelancers/[id]`.
- [ ] **Talent detail page** `/talents/[id]`.

## ④ Pure polish — no blockers, can do anytime
- [ ] **Worker-side `notify`** — wire the notification service into alert-scanner / deadline checks / daily-digest / mentions so the monitoring brain actually alerts people. (Needs `notify()` extracted to a shared package or an internal API the worker can call.)
- [ ] **B4** — per-project task board view + quick-create a task from an email/WhatsApp message.
- [ ] **B1** — reorganize the project detail's long scroll into clean tabs; drag-to-advance-stage on the board.
- [ ] **B2** — richer per-type suggestion cards + inline thread reply.
- [ ] **C3** — attendance offline capture queue (PWA) + feed `attendance_present_pct` into the KPI engine.
- [ ] **D1** — KPI/report drill-down + date-range filters.
- [ ] **D3** — social calendar grid view + sponsored-deal CRUD.
- [ ] **D4** — consolidate shared Card/table/page-header primitives into `@antagna/ui` (design-system).
- [ ] **A0** — full per-string extraction into `ar`/`en` i18n catalogs (for the live English toggle; colloquial cleanup already done).

## Done + live (summary)
Phases A (i18n·RBAC·AI-memory+learning·automation admin·WhatsApp-LID·auth+PWA·account hub),
B (projects·inbox·crm·tasks), C (equipment·people·attendance·WhatsApp inbox),
D (kpi+report charts·role landing+bento·⌘K search·social composer); `write_activity`
everywhere; unified `notify()` (assignments+comments); interactive **system map** at `/system-map`.
