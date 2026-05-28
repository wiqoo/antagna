# Antagna — Decisions Log

A chronological record of every locked architectural / product decision, with the reason and the reversibility note. Append-only.

---

## 2026-05-14 — Foundation decisions (Pillar 1)

### D-001 — Dev environment
**Decision:** Build on a separate Ubuntu machine, not WSL. Code path `/home/<user>/antagna`.
**Why:** Mohammed has a dedicated Ubuntu machine for Claude Code work; cleaner isolation from Windows planning workspace.
**Reversibility:** Moderate. Can migrate to WSL or cloud VM later via git clone.

### D-002 — Hosting: Vercel + Supabase
**Decision:** Next.js frontend on Vercel; Postgres + Auth + Storage + Realtime + Edge Functions on Supabase managed.
**Why:** Fastest start, managed infrastructure, mature integrations, sufficient KSA latency. Saudi data residency deferred (acceptable risk at MVP; Mohammed accepts).
**Reversibility:** Moderate. Postgres can be exported. Vercel app can move to other Node hosts. Migrating off Supabase Auth is harder — accepted lock-in.

### D-003 — ORM: Drizzle
**Decision:** Drizzle over Prisma.
**Why:** Edge-runtime compatible, lighter, better Supabase support, no client/server runtime distinction, SQL-first style.
**Reversibility:** Hard once migrations exist. Initial choice should be deliberate.

### D-004 — Monorepo: pnpm + Turborepo
**Decision:** pnpm workspaces with Turborepo orchestration.
**Why:** Faster installs, deduplicated node_modules, Turbo caching for builds, mature ecosystem.
**Reversibility:** Easy.

### D-005 — Job orchestration: Trigger.dev v3 (revised 2026-05-14)
**Decision:** Trigger.dev v3 for durable AI workflows + retries + observability.
**Why (revised after research):** Open-source (MIT-licensed), self-hostable via Docker Compose, $10/mo cloud start vs Inngest's $75/mo, direct-invocation model that fits AI agent workflows better, no vendor lock-in (Mohammed already stated he can run dedicated servers if needed). Backed by 2026 industry comparisons identifying it as the lower-risk default for SaaS at this scale.
**Reversibility:** Moderate. Both have similar function signatures so a migration to Inngest or Hatchet later is not trivial but not extreme.
**Previous decision (Inngest) superseded.**

### D-006 — Scheduled SQL tasks: Supabase pg_cron
**Decision:** Use pg_cron extension for SQL-side scheduled queries (AR aging recalc, KPI rollup snapshots).
**Why:** Already in Postgres, no extra infra, perfect for SQL-native work.
**Reversibility:** Easy (re-implement as Inngest scheduled functions).

### D-007 — AI: Anthropic Claude
**Decision:** Sonnet 4.6 default, Haiku 4.5 background/batch, Opus 4.6 for complex reasoning.
**Why:** Mohammed already has Anthropic billing; Claude best at Arabic-English mix; Sonnet 4.6 best price/performance for production work.
**Reversibility:** Moderate. Provider abstraction layer recommended in code so we can swap.

### D-008 — Embeddings: OpenAI text-embedding-3-small
**Decision:** OpenAI embeddings (1536-dim) for memory layer.
**Why:** $0.02/1M tokens (cheapest production-quality option), mature, widely supported.
**Reversibility:** Hard. Embeddings are dimension-specific; switching means re-embedding everything.

### D-009 — Mobile: PWA first
**Decision:** next-pwa, manifest + service worker. No native apps initially.
**Why:** Covers 90% of needs (selfie + GPS + offline + responsive). Native apps deferred until iOS push notification reliability becomes critical.
**Reversibility:** Easy — Capacitor can wrap an existing PWA into native shells later.

### D-010 — AI cost: open with guards
**Decision:** No hard monthly cap. Per-feature + per-user tracking. Alert on threshold breach. Soft caps per user with override.
**Why:** Mohammed wants AI to be a real partner not a metered utility. Visibility > restriction.
**Reversibility:** Easy — cost guard policies can tighten any time.

### D-011 — Migration: selective
**Decision:** Pull from old Supabase: equipment list (162 items), active client list, active projects only. Everything else (historical projects, old briefs, old financials, abandoned KPI attempts) stays as read-only reference.
**Why:** Clean schema from day 1; team experiences a fresh, fast system; no historical baggage in the new model.
**Reversibility:** Easy — can pull additional historical data later if needed.

### D-012 — Communications: Email primary, WhatsApp Phase 2
**Decision:** Gmail API integration from day 1. WhatsApp deferred to Phase 2 (after Pillar 9).
**Why:** Email is the dominant external channel (Edelman, BPG, Al-Futtaim, HRMNY all use email). WhatsApp adds Meta Cloud API complexity; can wait.
**Reversibility:** Easy — WhatsApp layer adds, not replaces.

### D-013 — Single legal entity
**Decision:** All invoices under "مؤسسة فولت الإبداعية للخدمات التسويقية" (CR 4030483856, VAT 310314280500003). No multi-entity support in Antagna.
**Why:** Mohammed confirmed; old "Volt vs Abu Luka" historical splitting is out of scope for Antagna.
**Reversibility:** Hard — would require schema rework.

### D-014 — Out of scope (Phase 1)
**Decisions excluded from initial build:**
- HR module (leave, payroll, performance reviews) — Phase 2+
- Finance module (full invoicing/AR/AP/expenses) — Phase 2+
- Old AR (1.9M SAR aged) migration — Mohammed working on it separately
- 25% partner share modeling — out of scope entirely
- Old project history migration — reference only
- WhatsApp integration — Phase 2+

### D-015 — Names locked
**Decision:**
- Brand: **Antagna / أنتجنا** (English: Antagna; Arabic with hamza: أنتجنا)
- Email domain: `voltsaudi.com` (existing)
- Abu Luka legal name: محمد المالكي (Mohammed Almalki). UI always shows "أبو لوكا".
- Mohammed Ghareeb (the user) — separate person, different from Abu Luka. UI shows "محمد غريب".

---

### D-016 — Ubuntu username
**Decision:** `mohammed`. Code path locked to `/home/mohammed/antagna` and `/home/mohammed/antagna-blueprint`.
**Confirmed:** 2026-05-14.

### D-017 — Abu Luka's account: deferred
**Decision:** Old `m.malki@voltsaudi.com` is cancelled. New account will be provisioned **later**, not blocking Pillar 1. Abu Luka's profile exists in the system but is `active=false` until then. Approvals on his behalf are recorded with an `acting_for` field on the audit log so the formal authorship is preserved.
**Confirmed:** 2026-05-14.

### D-018 — GitHub user
**Decision:** `wiqoo`. Repos: `github.com/wiqoo/antagna` (code, private) + `github.com/wiqoo/antagna-blueprint` (planning, private).
**Confirmed:** 2026-05-14.

### D-019 — Antagna's own MCP server
**Decision:** Antagna exposes its own MCP server at `/api/mcp` so internal team members can act on the system via Claude / Cursor / external clients.
**Why:** 2026 industry pattern (Linear, Notion, Stripe all have MCP servers now). Lets the team operate the system from Cursor while coding, from Claude while planning, from Claude Code while implementing.
**Reversibility:** Easy. The MCP layer is additive.

### D-020 — Anthropic model strings (locked)
**Decision:** Always use exact API model strings:
- `claude-opus-4-6` — Opus 4.6
- `claude-sonnet-4-6` — Sonnet 4.6
- `claude-haiku-4-5-20251001` — Haiku 4.5
**Why:** Prevents hallucinated model names in code. The mapping lives in `packages/ai/src/models.ts` as a single source of truth.

### D-021 — PDPL compliance posture
**Decision:** Volt is non-critical sector → Frankfurt hosting (Supabase eu-central-1) is permitted with proper SCCs + DPAs + documented data flow + subject-rights endpoints.
**Status:** Action items recorded in Pillar 1 §14.5; full checklist in Pillar 14.
**Trigger to re-evaluate:** if any client demands KSA-resident storage as contract condition.

### D-022 — Finance / ZATCA: OUT of Phase 1
**Decision (revised 2026-05-14 by Mohammed):** Volt uses an existing system called **Dafterah** (دفترة) for finance. Antagna does NOT generate invoices, quotes, or POs. Antagna does NOT submit to ZATCA. Antagna only stores REFERENCES to documents created in Dafterah.
**What Antagna does:**
- Has `dafterah_invoice_number`, `dafterah_quote_number`, `dafterah_po_number` text fields on projects (and optionally on quotes/invoices tables if kept as lightweight stubs).
- Has `attachments` (polymorphic, already in Pillar 2) for PDFs of POs / invoices / receipts dropped into a project.
- No XML generation, no ZATCA UUID chaining, no submission. Those happen in Dafterah.
**What Antagna's schema does NOT need anymore:**
- ZATCA cryptographic fields (we can keep them nullable for future re-evaluation, but don't wire any logic).
- Full quote/invoice line-item tables (kept as schema stubs but disabled in UI for Phase 1).
**Reversibility:** Easy. If Mohammed later wants Antagna to own invoicing, we re-enable the existing schema + plug in the ZATCA integration we'd already prepared in Pillar 13 §7.
**Trigger to revisit:** Mohammed's call — based on Dafterah experience.

### D-023 — WhatsApp: open-source self-hosted (not Meta Cloud API)
**Decision (2026-05-14 by Mohammed):** Use **Baileys** (open-source WhatsApp Web protocol library) running on a self-hosted VPS. NOT Meta WhatsApp Business Cloud API.
**Why:** Mohammed wants open-source. Avoids Meta business verification (1-2 weeks), avoids per-conversation pricing, no template approval bottleneck. Trade-off: unofficial protocol, account-ban risk if patterns look like spam.
**What this means:**
- New service: `apps/whatsapp-gateway` — Node.js + Baileys on a VPS (Hetzner / STC Cloud / etc.).
- Authentication via QR scan on first run + auto-reconnect.
- HTTP API towards Antagna: `/send-message`, `/get-status`, webhook on inbound.
- Persistent session state in Postgres or filesystem.
**Risks + mitigations:**
- WA Web protocol changes → keep Baileys updated; pin major version.
- Account ban risk → never broadcast aggressively, throttle (max 1 message / 5s outbound), don't use marketing templates, use a dedicated Saudi number (not Mohammed's personal).
- Multi-device limit (4 max) → operationally fine; we use 1.
**Schema impact:** `whatsapp_messages` from Pillar 8 stays — just the gateway changes. No Meta-specific fields needed (drop `business_scoped_user_id`, `conversation_category`, `template_status`).
**Hosting cost:** ~$5-20/mo for a tiny VPS.

### D-024 — Abu Luka account: no special handling required
**Decision (2026-05-14 by Mohammed):** Antagna doesn't care about email provisioning. Every user signs in with whatever email they have (Google SSO) OR exists pre-seeded in the DB and admin grants permissions. Abu Luka gets a `profiles` row from day 1; he signs in when he's ready. If he never signs in, Mohammed acts on his behalf via the `acting_for_id` pattern.
**Implication:** Pillar 1 §20 risk #1 closed. Abu Luka's email is not a launch blocker.

### D-025 — National Data Governance Platform: NOT required
**Decision (2026-05-14 by Mohammed):** Skip NDGP registration. With face matching removed (D-022-era decision) and no other biometric/sensitive-PII processing, the registration trigger is not met. Re-evaluate only if Volt adds biometric processing later.

### D-027 — Authentication: Supabase email + password (no Google SSO)
**Decision (2026-05-17 by Mohammed):** Drop the Pillar 1 §7 Google Workspace SSO plan.
Users register and sign in with email + password via Supabase Auth directly. No
Google Cloud Console OAuth client, no domain restriction.
**Why:** Simpler. Removes the Google Workspace dependency. Anyone with any email
can register (vendors, freelancers, external collaborators don't need a `@voltsaudi.com`
mailbox to use Antagna). Admin still controls what they can DO via roles +
capabilities once they're in.
**What this changes:**
- Pillar 1 §7 "Primary: Google Workspace SSO" is superseded.
- No `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` env vars needed.
- The `auth_user_to_profile` trigger (migration 00006) already handles email-only
  signups — falls back to `split_part(email, '@', 1)` for `full_name` when no
  Google metadata is present.
**Reversibility:** Easy. Supabase Auth supports both providers simultaneously;
Google SSO can be re-added later by enabling it in the Supabase dashboard +
provisioning a Google OAuth client.
**Trigger to revisit:** if Volt grows past ~30 users and password fatigue becomes
real, OR if external clients demand SSO.

---

### D-026 — NEW FEATURE: Internal approval workflow on deliverables
**Decision (2026-05-14 by Mohammed):** Before any deliverable goes to the client, it passes through TWO internal approval stages:
- **Stage 1: Director review** — Abu Luka reviews. He approves → moves to AM. He requests revisions → goes back to creator, then re-submits.
- **Stage 2: Account Manager review** — The AM responsible for the project reviews. He approves → ready for client. He requests revisions → goes back to creator (or back to director, depending on config).
**Cycle**: Creator ↔ Director ↔ AM ↔ Client. Each revision request restarts the chain at the appropriate point.
**Schema/feature**: see Pillar 16 §N (Internal Approval Workflow) below.
**Affects:** Pillar 5 (Project Lifecycle), Pillar 12 (UI), Pillar 11 (notifications).

---

### D-028 — Social Media OAuth: CANCELLED for Phase 1
**Decision (2026-05-22 by Mohammed):** Social platform OAuth (Instagram Graph,
TikTok Business, YouTube Data) is **cancelled** — not just deferred. All social
data entry stays manual via the existing `/social` UI. The `post-analytics-capture`
worker scanner remains in place as a no-op (kept idempotent so a future enable
doesn't require schema changes).
**Affects:** Pillar 7 (Social Media Module) — schema + UI stay, runtime OAuth is removed from the roadmap.
**Trigger to revisit:** explicit decision to enable automated analytics later.

---

### D-029 — AI Command Bar: CANCELLED
**Decision (2026-05-22 by Mohammed):** The natural-language entry point
("ابعت لـ BMW السعر" → intent + suggestion) is **cancelled**, not deferred.
Replaced in practice by: (a) the WhatsApp team chat-ops bot (already live),
and (b) the proactive smart-suggestions feed.
**Affects:** Pillar 10/12 backlog item. Removed from STATUS.md.

---

### D-030 — Google Calendar runtime: gate behind Drive verification
**Decision (2026-05-22 by Mohammed):** Before wiring Calendar auto-block on
shoot dates, verify the existing Drive folder auto-create runtime end-to-end
in production (project insert → folder appears within 60s · `projects.driveFolderUrl` set).
Only after that passes do we add the Calendar event creation + crew invite logic.
**Reason:** Both use the same service-account / domain-wide delegation path. If
Drive isn't actually flowing in prod, Calendar won't either. Validate the link
first, layer conditions after.
**Affects:** Pillar 13 §3-4 acceptance.

---

### D-031 — PWA attendance check-in: PRIORITY (was deferred)
**Decision (2026-05-22 by Mohammed):** Pillar 9's mobile check-in UI is no
longer deferred — it's the next priority feature after Email Intel Phase 1.
**Scope:** PWA-installable check-in / check-out, GPS-stamped, integrates with
existing `attendance_*` schema + KPI engine. Manager view of who's in, who's
not, late arrivals. Notifications via existing Pillar 8 channels.
**Affects:** Pillar 9 (Attendance & KPIs), Pillar 12 (PWA shell).

---

### D-032 — Team Chat: scope locked to per-project, deferred
**Decision (2026-05-22 by Mohammed):** When Team Chat eventually ships, it is
**per-project only** — no DMs, no general/global channels. Each project has
exactly one chat thread, auto-created when the project is created, members =
project participants. Deferred for now (no sprint slot yet).
**Reason:** Keep chat tied to work context. Avoid Slack-style channel sprawl.
**Affects:** Backlog item in STATUS.md updated.

---

### D-033 — Dashboard direction: V5 bento + AI cards
**Decision (2026-05-25 by Mohammed):** After a long design exploration session
(V1 — boring comparison variants; V2 — premium creative-pro mockups
[Editorial/Studio/Glass]; V3 — restrained mono palette [Calm/Precise/Spaced];
V4 — Frame.io workbench), the production dashboard moves to the **V5** model:

- **Cards-only.** No tables embedded in the page, no inline lists outside
  cards. Every piece of info is a discrete card.
- **AI inside cards.** Each card declares an AI level (heavy / medium /
  light / none). A 1-px top stripe on the card visually encodes the
  density — orange at full opacity for heavy, fading to none for "no AI".
  A tiny `AI` pill sits next to the title.
- **28-card catalog.** See D-035.
- **Bento layout.** Sizes per card: sm (3-col), md (4), lg (6), xl (8),
  full (12). User can mix densities — small KPI tiles alongside large
  AI Brief cards.

Lives at `apps/web/src/app/preview/lab/v5/`. Production port is the
next major work item.

**Affects:** Pillar 12 (UI/UX), Pillar 10 (AI surface), Pillar 11 (suggestion
visibility). Supersedes the rough customization first introduced in
`apps/web/src/app/dashboard/dashboard-customize.tsx` — that's now the
seed for the V5 customize drawer.

---

### D-034 — Palette discipline: mono orange, no chromatic gradients
**Decision (2026-05-25 by Mohammed):** Across the whole UI:

- The accent palette is the **single orange** already locked in
  `apps/web/src/app/globals.css` (`--accent: #FF6B1A`, hover `#FF8442`).
- **No mesh gradients, no glow shadows, no chromatic gradient fills**
  (no purple/cyan/pink/emerald accents anywhere). The V2 mockups
  (Editorial/Studio/Glass) tried these and were rejected as "اوفر اوي،
  مش الالوان بتاعتي".
- Greens / yellows / reds only for **semantic state** indicators
  (success / warning / error in tiny pills) — never as decoration.
- Backgrounds: `#0F0F12` page, `#17171C` surface, hairline borders at
  `rgba(255,255,255,0.06–0.16)`.
- Premium feel comes from **typography, spacing, and rhythm** — not
  color or glow.

**Reason:** Volt is a creative production agency. The UI is shown to
clients (BMW, Rolls Royce). The user has a strong visual eye and
explicitly rejected anything that "tries too hard" with color.

**Affects:** All future components. Reviewers (including future Claude
sessions) should flag any new chromatic gradient as out of policy.

---

### D-035 — V5 Card Catalog (28 cards)
**Decision (2026-05-25 by Mohammed):** The dashboard customization
drawer ships with a fixed seed catalog of 28 cards across 4 AI tiers:

- **AI Heavy (13):** ai_brief · at_risk · hot_leads · ai_suggestions ·
  email_triage · next_actions · project_health · bottleneck ·
  client_mood · capacity_forecast · followups · stale_convos · ai_tip
- **AI Medium (7):** cashflow · approvals · lead_temp · ai_cost ·
  velocity · win_rate · today_shoots (light boundary)
- **AI Light (5):** mtd_revenue · open_tasks · activity · equip_conflicts · battery
- **No AI (3):** email_sla · oauth_health · workers

Source of truth: `apps/web/src/app/preview/lab/v5/cards.tsx`
exporting `CARD_CATALOG`. Each entry has `{ id, title, group, ai,
component, defaultSize, desc }`. Production port should reuse this
catalog verbatim — only swap mock content for live Supabase queries.

**Affects:** Pillar 10/12, the customize drawer, future per-role
default profiles (D-031 deferred attendance card can become catalog
entry #29 when shipped).

---

### D-036 — Dashboard shipped: V5 bento → production + V6 "clean" skin & motion

**2026-05-26.** Executed D-033 and iterated. Production `/dashboard` now
renders the bento from a shared module `apps/web/src/app/dashboard/cards/`
(shell + 28 cards + catalog), wired to the real Supabase queries, with a
customize system (per-card size cycle, drag/▲▼ reorder, add/hide) persisted
in a `dash_layout` cookie.

After review, Mohammed steered the look toward a **"clean" card skin**, which
**supersedes the monospace `// snake_case` card-title aesthetic** from D-034 /
D-035 (the palette discipline of D-034 — single orange, dark, hairlines, no
chromatic gradients — still holds). Changes:

- Card titles are clean human Arabic (catalog `titleAr`) in the display font,
  not `// code` mono labels. The mono skin survives only in `/preview/lab/v5`.
- Body text unified on **Vazirmatn** (the display font) with higher contrast;
  numbers/timecodes stay mono.
- Per-card **quick actions** on hover (رد / موافقة / مراجعة …) linking to the
  relevant section.
- **Framer Motion** added (`framer-motion`): spring entrance stagger, hover
  lift, layout-spring reflow. Drag is gated behind the customize ("ترتيب")
  mode so it never hijacks scrolling.

V6 motion/skin exploration lives at `/preview/lab/v6` + a Google Stitch
concept at `/preview/lab/v6/stitch`. project_health / at_risk scoring is a
deterministic heuristic for now (real LLM scoring is a follow-up).

**Affects:** Pillar 12 (UI), the dashboard customize drawer, future per-role
default layouts.

---

## 2026-05-28 — Permissions architecture (Phase 2 Sprint 0)

### D-037 — Strict positions + field-level masking (Permissions Architecture v1)
**Decision:** Adopt the "01PERMISSIONSforClaudeCode.md" architecture wholesale:
16 positions × per-field visibility matrix × per-entity access rules. Replaces
the coarse `role` model with a position-driven, capability-gated system.
**Why:** A 17-person production company needs fine-grained data isolation
(financial visible to финance only, Abu Luka content masked from non-AM crew,
freelancers blind to client contacts). The audit matrix from the doc is the
spec. Production Director gets system_admin but NOT financial — explicit.
**Reversibility:** Hard once data is masked through `v_*_safe` views — pages
will assume the masked shape. Plan for it carefully.

### D-038 — Naming: rename existing `capabilities` table → `skills`
**Decision:** Reclaim `capabilities` for the access-control codes the new
architecture introduces. The current `capabilities` table (21 rows: shooter,
editor, drone_pilot, sound_engineer…) becomes `skills`; `user_capabilities`
becomes `user_skills`. `has_capability()` function gets the access-code
semantic.
**Why:** Two parallel concepts called "capabilities" would be confusing;
the proposal's vocabulary is more standard. Existing `permissions` table
(50 rows: project.read, project.create…) extends with fine-grained codes
(`projects.read.all`, `projects.read.financial`, …) and `role_default_permissions`
becomes `position_default_permissions`.
**Reversibility:** Moderate — one focused PR migrates schema + ~15 source
files. Apply before the rest of Sprint 0 work hits the schema.

### D-039 — Enforcement: app-layer `can()` + safe views, NOT user-token RLS
**Decision:** Keep the service-role connection pattern. Enforce entity-level
access via `requirePermission()` in actions + `where`-clause filters in views.
Enforce field-level masking via `v_*_safe` views (`CASE WHEN user_has_capability(...)`
per sensitive column). RLS stays enabled as belt-and-suspenders but isn't the
primary gate.
**Why:** Switching the app to per-user PG connections (so RLS actually fires)
is a refactor that breaks workers + the existing `withActor()` pattern.
Views + can() achieve the same outcome with less risk; supersedes the
proposal's "Postgres RLS as primary" stance.
**Reversibility:** Easy — adding RLS as the primary gate later is a config
flip if the foundation is in place.

### D-040 — Auth model: invite-only (supersedes earlier verbal "open self-signup")
**Decision:** Admins (system_admin / hr_manager) invite users with a position
assigned at invite time. New `auth.users` rows without a `profiles.position_key`
get NO access. Public self-signup is OFF.
**Why:** The position-driven permission model is incompatible with open
self-signup — a self-registered user has no position → undefined behavior or
default-overly-permissive. Strict positions need strict identity provisioning.
Earlier Phase-2 question pick of "Open self-signup" reversed after reading
the permissions doc.
**Reversibility:** Easy — flip the registration handler back on, but plan
the position-on-invite flow regardless.

---

## Pending Decisions (to revisit in later pillars)

- **Inngest tier**: free vs paid — depends on background workflow volume (decided in Pillar 10)
- **Sentry tier**: free vs paid (decided in Pillar 14)
- **Domain name for the app**: e.g., `antagna.voltsaudi.com` vs `app.antagna.me` (decided in Pillar 14)
- **Email sending domain**: `notifications@antagna.voltsaudi.com` vs Postmark/Resend (decided in Pillar 8)
- **PDPL compliance level**: minimum vs comprehensive (revisit if KSA-resident client demands)
- **Backup strategy**: Supabase native vs additional off-site (decided in Pillar 14)
