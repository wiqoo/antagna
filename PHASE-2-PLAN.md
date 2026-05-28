# Antagna — Phase 2 (Post-Bug-Sweep) Execution Plan

> **Source:** Cowork audit proposal (2026-05-28) + Claude Code opinion + bug-sweep results.
> **State at plan baseline:** `b3bt4i7oe` deploy READY — all P0 bugs in proposal addressed (with 4 marked NOT-REPRODUCIBLE because the audit was 3 commits stale).
> **Owner:** Mohammed (decisions, scope) · Claude Code (execution).
> **Cadence:** 4 sprints × 2 weeks = 8 weeks. Buffer built into each sprint.

---

## Guiding principles

1. **Highest-ROI Architecture Shift first.** The "Universal Approval Primitive" outranks the Event Bus because it ships measurable UX consolidation (4 flows → 1 surface) versus invisible infrastructure.
2. **AI Command Bar starts NOW, not Sprint 3.** Phase A (read-only) is one week and validates the killer-feature thesis before we invest in Phase B-D.
3. **One discussion at a time.** Each Architecture Shift gets its own decisions log entry + commit chain. No mixing shifts inside a single PR.
4. **Verify after every shift.** Playwright E2E + manual smoke before locking the marker `[x]`.
5. **Buffer for blockers.** Data seeding + auth model + geofence coords are still open. Each sprint reserves 20% slack.

---

## Sprint 1 (Weeks 1-2) — Foundation + killer-feature seed

### Sprint goal
Two things land: (1) a real production-ready **Universal Approval Primitive** that replaces 1 of the 4 existing approval flows, (2) a working **AI Command Bar Phase A** (read-only) gathering usage telemetry.

### Tracks

#### A. Universal Approval Primitive (Shift 2)
- **Schema** — `approval_requests` table (entity_type, entity_id, action, payload jsonb, requested_by/at, approval_chain jsonb, current_step, status, decided_at/by, decision_note, expires_at).
- **Approval-chain config** — store per-entity-type defaults in `approval_chains` reference table; chain = `[{role, sla_hours}]`.
- **Universal page** — `/approvals` lists pending where current approver = me; renders entity-specific preview via a `<{entityType}Preview />` registry (one component per type, lives in `apps/web/src/app/approvals/previews/`).
- **First migration target** — `email_drafts` approval flow (the simplest of the 4). The existing `approvedBy/approvedAt` columns become legacy; new sends route through `approval_requests`.
- **Audit log** — auto-write `activity_events` on every status change.
- **Tests** — Playwright spec for the email-draft approval round-trip.

#### B. AI Command Bar Phase A (Shift 4 — read-only)
- **Endpoint** — `POST /api/ai/command/route.ts` (Node runtime). Accepts `{prompt, context: {currentPage, currentEntityId}}`.
- **Tool registry** — start with read-only tools: `search_projects`, `find_client`, `query_kpi`, `search_memory`, `list_open_tasks`.
- **Frontend** — `<AICommandBar />` mounted from the AppShell ⌘K equivalent (Shift + Space or a new `⌘J`). Reuses `CommandPalette` skin.
- **Telemetry** — every command goes to `ai_action_log` so we can measure adoption + which tools get hit.
- **Memory integration** — every call uses `retrieveMemory({query: prompt, scope: {entityType, entityId}})` as context (Shift 5 lands as a side effect).

#### C. Decisions to lock during Sprint 1
- **Preview/Lab cleanup** — which `/preview/lab/*` variants are final direction?
- **Data seeding** — read volt-os DB OR start fresh manual entry?
- **Auth model** — invite-only OR open self-signup?

### Sprint 1 deliverables checklist
- [ ] Migration: `approval_requests` + `approval_chains`.
- [ ] `/approvals` page (server component + actions).
- [ ] Email-draft flow migrated.
- [ ] Playwright spec: email-draft approval.
- [ ] `/api/ai/command` endpoint with 5 read-only tools.
- [ ] `<AICommandBar />` component + AppShell mount.
- [ ] Telemetry rows in `ai_action_log`.
- [ ] Preview/lab decision logged → cleanup PR.
- [ ] Data seeding direction decided.
- [ ] Decisions log entries D-NNN for both shifts.

---

## Sprint 2 (Weeks 3-4) — UI consolidation + Event Bus foundation

### Sprint goal
Visible UI quality jump + the event-driven backbone goes in *alongside* the existing cron schedule (no breaking change).

### Tracks

#### A. Event Bus foundation (Shift 1) — non-breaking
- **Schema** — `app_events` table (id bigserial, event_type, entity_type, entity_id uuid, payload jsonb, emitted_by, emitted_at).
- **NOTIFY trigger** — `pg_notify('app_events', json_build_object(...))` on insert.
- **Co-emit from existing workers** — `gmail-scanner` emits `email.new` *in addition* to its current insert flow. `whatsapp-bot` emits `whatsapp.new`. Crons keep running unchanged.
- **One real listener** — apps/worker side: a `pg.LISTEN` Node process that consumes `email.new` and runs the same summarize-extract-suggest pipeline. Measure latency vs the 5-min poll.
- **Decision point at end of sprint** — if latency win is real, plan the cron sunset in Sprint 4.

#### B. Kill /preview/lab (per Sprint-1 decision)
- Move kept variants → `packages/ui/`.
- Delete the rest (real `rm`, not commented).
- ESLint rule: no imports from `apps/web/src/app/preview/*` outside that route.

#### C. AI Action Bar — make AIHints clickable
- Each insight gets 1-2 inline actions wired to the Command Bar (Shift 4 reuse).
- Approve flow uses the new Approval Primitive (Sprint 1).

#### D. Selective Page → Panel conversion
- **Only one** for Sprint 2: `/projects/new` wizard becomes a Sheet from `/projects` list. The 8 others (clients/new, equipment/new, …) stay as pages for now.
- Reason: 17-person team; deep-link is more useful than fancy interception for the others.

### Sprint 2 deliverables checklist
- [ ] Migration: `app_events` + NOTIFY trigger.
- [ ] gmail-scanner emits `email.new` alongside current behavior.
- [ ] whatsapp-bot emits `whatsapp.new`.
- [ ] Listener service (Node process in worker) consuming `email.new`.
- [ ] Latency measurement (cron vs listener).
- [ ] `/preview/lab/*` cleanup PR.
- [ ] AIHints interactive on `/dashboard`, `/projects`, `/equipment`.
- [ ] `/projects/new` as Sheet from list.

---

## Sprint 3 (Weeks 5-6) — Command Bar Phase B + Approval wiring

### Sprint goal
The Command Bar starts **doing** things (single-entity create) and the Approval Primitive picks up the remaining 3 flows.

### Tracks

#### A. AI Command Bar Phase B (Shift 4 cont.)
- Add **single-entity create** tools: `create_lead`, `create_task`, `reserve_equipment`, `add_comment`.
- Each tool returns a **preview JSON** (not direct execution) → frontend renders inline confirm.
- Each execution writes `ai_action_log` + the Approval Primitive when applicable.

#### B. Approval Primitive — remaining flows
- WhatsApp drafts → `approval_requests` (drop the legacy `pendingDrafts` table once we're confident).
- `ai_suggestions` approve/reject → `approval_requests` (the inbox/suggestions page gets a thin layer).
- Sponsored deals create → approval (if value > threshold).
- Per-entity auto-approve rules (auto-approve < 1000 SAR, AM-only < 10K, director > 10K) — config in `approval_chains.auto_approve_below_sar`.

#### C. Real-time collaboration (Shift 3.2)
- `/projects/[id]` subscribes to `project:{id}` Supabase Realtime channel.
- Presence avatars (who else is viewing).
- Live task-status updates (no refresh needed).

#### D. Memory as default context (Shift 5 — finalize)
- `withMemoryContext` helper in `packages/ai/context.ts`.
- Wire into `insights-scanner`, `daily-brief`, `email-intel`, `whatsapp-bot` calls.

### Sprint 3 deliverables checklist
- [ ] Command Bar Phase B (5 create tools + preview UI).
- [ ] WhatsApp draft approvals → Approval Primitive.
- [ ] `ai_suggestions` approvals → Approval Primitive.
- [ ] Sponsored deal approval flow (with auto-approve threshold).
- [ ] Realtime presence + live task updates on `/projects/[id]`.
- [ ] `withMemoryContext` helper + 4 worker integrations.
- [ ] Playwright specs for Command Bar create + Approval Primitive.

---

## Sprint 4 (Weeks 7-8) — Rules engine + outbound automation

### Sprint goal
Cross-domain rules engine ships with a curated set of templated rules (not free-form DSL), and 5 outbound automations close the inbound-only loop.

### Tracks

#### A. Rules Engine v0 (Shift 3 — scoped down)
- **Schema** — `automation_rules` table, similar to existing `alert_rules` but with:
  - `trigger_type` ∈ {event, schedule}
  - `condition_template` ∈ a **fixed enum** (not free-form JSON DSL) — start with: `stalled_project`, `unresponsive_email`, `equipment_overdue`, `client_silent`, `deadline_approaching`.
  - `actions` jsonb: `[{type: 'notify' | 'create_task' | 'whatsapp' | 'email', target_role, template}]`.
- **Config UI** — simple admin page `/admin/automation`. Per template, configure thresholds (e.g., `stalled_project.days = 7`). No drag-drop canvas yet — that's Sprint 5+ if we ever need it.
- **Visual builder deferred** — Vercel Workflow Builder is marketing-not-shipped; if/when we add a real canvas, use `@xyflow/react`.

#### B. Outbound automation — 5 wins
| Trigger | Action |
|---|---|
| `project.delivered` | Calendar invite for wrap meeting + email client thank-you template |
| `deliverable.approved` | Email client + NPS micro-survey link |
| `project.shoot_starts_at < 24h` | WhatsApp crew call sheet |
| `equipment.checked_out` | WhatsApp shooter accountability ping |
| `lead.temperature_dropped > 20pts` | AM gets WhatsApp + draft email |

Each routes through `/api/internal/notify` (already live) and gets approval-gated where the recipient is a client (Approval Primitive).

#### C. Cron sunset (depends on Sprint 2 listener)
- If Sprint 2's `email.new` listener proved out, sunset the 5-min `gmail-scanner` cron in favor of LISTEN. Keep cron as fallback for 1 sprint.

### Sprint 4 deliverables checklist
- [ ] `automation_rules` table + 5 condition templates.
- [ ] `/admin/automation` page (config UI).
- [ ] 5 outbound automations live.
- [ ] Resend templates for client comms.
- [ ] Cron-sunset decision logged.

---

## Cross-sprint workstreams (continuous)

### i18n extraction
Each touched page extracts its strings to `messages/ar.json` + `messages/en.json`. Foundation already at 117 keys. Estimated +200 keys across 8 weeks as we go. **No big-bang refactor sprint.**

### Tooling additions (P4)
- **Magic UI** — pick 5–6 components only: `AnimatedBeam`, `Shimmer`, `NumberTicker`, `BorderBeam`, `Marquee`. Copy into `packages/ui/src/components/` (no new dep). Sprint 2 fits.
- **Google Stitch** — already installed; consolidate usage (when prototyping a new card, generate first, polish, integrate).
- **Supabase MCP** — already installed.
- **Vercel Workflow Builder** — DO NOT adopt (marketing, not shipped). Use `@xyflow/react` if a canvas ever materializes.
- **Figma MCP** — skip unless a designer joins.
- **n8n** — skip (added friction without payoff).

### Tests
Smoke test for every new flow. Vitest for pure logic. Playwright for E2E. CI job already wired.

### Decisions log
Every Architecture Shift = one `D-NNN` entry in `decisions-log.md` before the first commit on that shift.

---

## Open questions gating each sprint

### Gate Sprint 1
1. **Preview/Lab cleanup** — which `/preview/lab/*` paths stay (`v6 stitch`? `v5 dashboard`? `v4`?), and which get deleted?
2. **Data seeding** — read live volt-os DB (one-time import of clients/equipment/employees) OR keep manual entry?
3. **Auth model** — invite-only (recommended for internal tool) OR open self-signup?

### Gate Sprint 4
4. **Dafterah outbound webhook** — ready to accept `quote.approved` POST and emit invoice back, OR keep manual ref-only?

### Optional (can wait)
5. **Designer for Figma** — anyone joining to maintain a Figma file?
6. **Team rollout cadence** — PM first → AM next → all 17? Or all at once after Sprint 1?
7. **Cloud-API WhatsApp migration** — ban-safe path; investigation only this phase.

---

## Risk register

| Risk | Mitigation |
|---|---|
| Approval Primitive migration breaks the existing 4 flows | Sprint 1 migrates ONE flow (email_drafts) only; others wait until Sprint 3 |
| AI Command Bar Phase A has low adoption | Telemetry from week 1; if < 5 commands/active-user/week, deprioritize Phase B-D |
| Event Bus listener has reliability issues | Crons stay live alongside listener through Sprint 4; sunset only after proof |
| Rules Engine becomes a DSL maintenance burden | Started with FIXED template enum, NOT free-form JSON tree |
| Data seeding decision keeps pushing | Sprint 2 can still deliver without data; UI quality work doesn't need it |
| Vercel function timeouts on heavy command-bar agents | Test Phase B on staging; consider Vercel Sandbox for long-running agents |

---

## What happens after Phase 2 (Sprint 5+)

Not committed yet, but the candidates:
- AI Command Bar Phase C (multi-entity orchestration).
- AI Command Bar Phase D (voice + Whisper integration).
- Rules Engine visual builder (`@xyflow/react`) — only if config-UI proves limiting.
- Page→Panel migration for the remaining 8 candidates (if friction data justifies).
- Outbound integrations beyond Dafterah (Slack, Buffer, custom dashboards).

---

## How we work this plan

- **One sprint at a time.** Don't multi-task across Sprint 1 and Sprint 3.
- **Mid-sprint check-in** — at week 1 of each sprint, status update vs deliverables.
- **End-of-sprint demo** — Playwright walkthrough + measurable wins.
- **Plan stays live** — every commit that delivers a sprint item updates this file's checklist.

— end of plan
