# Antagna — أنتجنا

**Internal operating system for Volt Production (Saudi Arabia).**
CRM + Project Management + Equipment Management + Social Media + Communications + AI memory — built AI-native, fully automated, designed so the team genuinely wants to use it.

---

## Status

**Phase:** Phase 1 features live in production
**Started:** 2026-05-14 (blueprint) → 2026-05-17 (first code) → 2026-05-22 (Email Intel Phase 1 complete)
**Owner:** Mohammed Ghareeb (Director of Production, System Owner)
**Execution:** Claude Code on Ubuntu (`/home/mohammed/antagna`)
**Planning:** Claude Cowork on Windows

### Live URLs

| What | URL |
|------|-----|
| App | <https://antagna-v2.vercel.app> |
| Custom domain | `antagna.me` (Cloudflare zone added 2026-05-21) |
| WhatsApp bot tunnel | <https://whatsapp.antagna.me> |

---

## Locked Foundation Decisions

| Decision | Choice |
|----------|--------|
| Dev environment | Ubuntu machine, code at `/home/<user>/antagna` |
| Frontend hosting | Vercel (Next.js 15 App Router) |
| Backend hosting | Supabase (Postgres + Auth + Storage + Realtime + Edge Functions), region `ap-northeast-1` |
| ORM | Drizzle |
| Monorepo tooling | pnpm + Turborepo |
| AI reasoning | Anthropic Claude — Sonnet 4.6 default, Haiku 4.5 background, Opus 4.6 critical |
| AI extraction / agents | OpenAI `gpt-4o-mini` (Email Intel + WhatsApp bot) |
| AI embeddings | OpenAI `text-embedding-3-small` (1536-dim, pgvector) |
| Job orchestration | **Trigger.dev v4** Pro tier from day 1 (D-005) |
| Scheduled SQL tasks | Supabase pg_cron |
| Mobile | PWA first; Capacitor wrapper later if needed |
| AI cost | Open with guards (per-feature + per-user tracking, soft caps) |
| Communications | Gmail API now · WhatsApp via self-hosted **WPPConnect** + Cloudflare tunnel (D-023) |
| Transactional email | Resend on `antagna.me` |
| Finance | Antagna stores references only — **Dafterah** owns invoicing + ZATCA (D-022) |
| Migration approach | Selective — equipment list (162), active clients, active projects only |
| Language | Arabic (MSA simple) + English mixed; English toggle |
| Legal entity | مؤسسة فولت الإبداعية للخدمات التسويقية (CR 4030483856, VAT 310314280500003) |

See `decisions-log.md` for the running history.

---

## Pillar status — all 16 executed

| # | Pillar | Plan | Code | Verified |
|---|--------|------|------|----------|
| 01 | Foundations & Infra | ✓ | ✓ | ✅ 8 PASS |
| 02 | Data Model | ✓ | ✓ | ✅ 8/8 §16 · **110 tables, 4 views, 41 migrations** |
| 03 | Identity & Permissions | ✓ | ✓ | ✅ 10/10 §10 · view-as impersonation |
| 04 | CRM Core | ✓ | ✓ | clients/leads/contacts CRUD + activity |
| 05 | Project Lifecycle | ✓ | ✓ | ✅ 9/9 §10 · state machine + approval pipeline |
| 06 | Equipment & Reservations | ✓ | ✓ | ✅ 9/9 |
| 07 | Social Media Module | ✓ | 🟡 | schema + UI · OAuth tokens manual |
| 08 | Communications Layer | ✓ | ✓ | Resend + WhatsApp bot live |
| 09 | Attendance & KPIs | ✓ | 🟡 | KPI engine running · PWA check-in deferred |
| 10 | AI & Memory Layer | ✓ | ✓ | daily-brief + insights + Email Intel pipeline + smart-suggestions |
| 11 | Automation & Alerts | ✓ | ✓ | alert-scanner + email-followup + smart-suggestions |
| 12 | UI/UX System | ✓ | ✓ | tokens + Shell + **51 pages** |
| 13 | Integrations | ✓ | 🟡 | Gmail/Drive live · Calendar/ZATCA deferred |
| 14 | Deployment & Ops | ✓ | ✓ | CI + Sentry + custom domain on Cloudflare |
| 15 | Migration & Launch | ✓ | 🟡 | staging tables · legacy merge pending |
| 16 | Hardening (patch) | ✓ | ✓ | all 26 patches applied |

Legend: ✓ done · 🟡 partial (schema/UI landed, runtime/manual deferred) · ✅ tested

---

## What's running today

### Worker (Trigger.dev v4) — 11 tasks deployed

10 schedules + 1 fan-out task (Pro tier cap = 10 schedules, so smart-suggestions is triggered from daily-brief).

- `gmail-scanner` (5min), `email-send-scanner` (1min), `email-followup-scanner` (hourly)
- `drive-folder-scanner` (2min)
- `alert-scanner` (5min)
- `oauth-health-scanner` (4h)
- `kpi-engine` (daily 04:30 UTC), `daily-brief` (07:30 KSA), `insights-scanner` (daily), `post-analytics-capture` (daily)
- `smart-suggestions-scanner` (triggered by daily-brief)

### Email Intelligence Phase 1 (live)

Every 5 minutes the pipeline runs: **ingest → AI summary → routing → meeting notes → deep extraction (with PDF attachments) → suggestion generation → conversation analysis**.

Suggestions land at `/inbox/suggestions` with confidence tiers + approve / approve+execute / reject / edit. Manual refresh button available.

### WhatsApp team chat-ops bot (live)

- WPPConnect built from source · Cloudflare tunnel `whatsapp.antagna.me`
- OpenAI `gpt-4o-mini` · 5 tools · LID-aware · 2-digit self-link flow
- Debounce + batch for rapid-fire messages

### Web app (51 pages)

`/login`, `/register`, `/welcome`, `/dashboard`, `/projects`, `/tasks`, `/crm`, `/clients/[id]`, `/equipment`, `/kpis`, `/inbox`, `/inbox/suggestions`, `/calendar`, `/social`, `/team`, `/reports`, `/settings`, `/settings/whatsapp`, `/briefs/new`, `/admin`, `/admin/integrations/{google,whatsapp,email-routes}`, plus a `/preview` library.

---

## Repo layout

```
antagna/
├── apps/
│   ├── web/        # Next.js 15 App Router (Vercel)
│   ├── worker/     # Trigger.dev v4 tasks
│   └── e2e/        # Playwright (9 tests, system Chrome)
├── packages/
│   ├── db/         # Drizzle schema + client
│   ├── ai/         # Anthropic + OpenAI clients + ANTHROPIC_MODELS map
│   └── ui/         # tokens + AppShell + Card + StatusPill + EmptyState
├── infra/
│   └── whatsapp/   # WPPConnect Dockerfile + compose + entrypoint patch
├── supabase/
│   └── migrations/ # 41 SQL migrations
├── scripts/
│   ├── smoke/      # acceptance + smoke tests
│   └── *.sh        # cloud provisioning helpers
├── docs/
│   └── runbooks/   # 5 ops runbooks
├── config/         # roles.yaml + decisions.yaml
├── pillar-01..16-*.md
├── STATUS.md       # ⭐ read this first each session
├── CLAUDE.md       # the autonomy contract + conventions
├── decisions-log.md
└── README.md
```

---

## Working with this repo

```bash
# Find what's next
cat STATUS.md

# Local dev
pnpm install
pnpm --filter=web dev

# Type check + build
pnpm type-check
pnpm build

# Deploy web (no auto-deploy on push — GitHub integration is broken, see CLAUDE.md)
vercel deploy --prod --yes

# Deploy worker
cd apps/worker && npx trigger.dev@latest deploy
```

Slash commands available in Claude Code:

- `/pillar 01` — Execute a pillar end-to-end
- `/decisions pending` — Show open decisions
- `/checklist 01` — Run a pillar's acceptance checklist

(Defined in `.claude/commands/` + agent in `.claude/agents/pillar-executor.md`.)

---

## What's out of scope (Phase 1)

HR module, finance module (Dafterah handles it), old AR migration, 25% partner share modeling, old project history migration, ZATCA submission API, TikTok scheduled posting, AI Command Bar. See D-014 + decisions-log.md.

---

## Source Documents (Discovery)

Read these for context before starting any pillar:

- `../recon-findings-2026-05-14.md` — initial recon
- `../intagna-analysis-2026-05-14.md` — old VOLT OS schema analysis
- `../volt-data-extraction-2026-05-14.md` — full email/calendar/drive intel
- `../deep-dive-findings-2026-05-14.md` — cost sheet, KPIs, internal patterns
