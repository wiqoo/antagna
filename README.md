# Antagna — أنتجنا

**Internal operating system for Volt Production (Saudi Arabia).**
CRM + Project Management + Equipment Management + Social Media Account Management — built AI-native, fully automated, designed so the team genuinely wants to use it.

---

## Status

**Phase:** Blueprint design
**Started:** 2026-05-14
**Owner:** Mohammed Ghareeb (Director of Production, System Owner)
**Execution:** Claude Code on a dedicated Ubuntu machine
**Planning:** Claude Cowork on Windows

---

## Locked Foundation Decisions (2026-05-14)

| Decision | Choice |
|----------|--------|
| Dev environment | Separate Ubuntu machine, code at `/home/<user>/antagna` |
| Frontend hosting | Vercel |
| Backend hosting | Supabase (Postgres + Auth + Storage + Realtime + Edge Functions) |
| ORM | Drizzle |
| Monorepo tooling | pnpm + Turborepo |
| AI reasoning | Anthropic Claude (Sonnet 4.6 default, Haiku 4.5 background, Opus 4.6 critical) |
| AI embeddings | OpenAI text-embedding-3-small |
| Job orchestration | Trigger.dev v3 (start at Pro tier $25/mo to avoid free-tier 5K runs/month cap) |
| Scheduled SQL tasks | Supabase pg_cron |
| Mobile | PWA first (next-pwa); Capacitor wrapper later if needed |
| AI cost | Open with guards (per-feature + per-user tracking, alerts, soft caps) |
| Migration approach | Selective — bring equipment list (162), active clients, active projects only |
| Communication channel | Email (Gmail) primary; WhatsApp Phase 2 |
| Language | Arabic (MSA simple) + English mixed; English toggle |
| Legal entity | مؤسسة فولت الإبداعية للخدمات التسويقية (CR 4030483856, VAT 310314280500003) |

See `decisions-log.md` for the running history.

---

## Blueprint Roadmap — 15 Pillars

| # | Pillar | Status |
|---|--------|--------|
| 01 | Foundations & Infra | **✓ Planning complete (2026-05-14)** — awaiting Ubuntu execution |
| 02 | Data Model | **✓ Planning complete (2026-05-14)** |
| 03 | Identity, Permissions & Multi-Role | **✓ Planning complete (2026-05-14)** |
| 04 | CRM Core | **✓ Planning complete (2026-05-14)** |
| 05 | Project Lifecycle | **✓ Planning complete (2026-05-14)** |
| 06 | Equipment & Reservations | **✓ Planning complete (2026-05-14)** |
| 07 | Social Media Module | **✓ Planning complete (2026-05-14)** |
| 08 | Communications Layer | **✓ Planning complete (2026-05-14)** |
| 09 | Attendance & KPIs | **✓ Planning complete (2026-05-14)** |
| 10 | AI & Memory Layer | **✓ Planning complete (2026-05-14)** |
| 11 | Automation & Alerts Engine | **✓ Planning complete (2026-05-14)** |
| 12 | UI/UX System | **✓ Planning complete (2026-05-14)** |
| 13 | Integrations | **✓ Planning complete (2026-05-14)** |
| 14 | Deployment & Operations | **✓ Planning complete (2026-05-14)** |
| 15 | Migration & Launch Plan | **✓ Planning complete (2026-05-14)** |
| 16 | **Blueprint Hardening (Peer Review Patch)** | **✓ Patch complete (2026-05-14)** — supersedes parts of P1, P2, P8, P9, P10, P11, P12, P13 |

Build sequence: pillars are written one at a time, each fully completed and reviewed before moving on.

---

## How to Use This Blueprint with Claude Code

1. On the Ubuntu machine, clone this blueprint folder (we'll git-init it).
2. Open Claude Code in the cloned folder.
3. Each session, point Claude Code at the current active pillar:
   ```
   Read pillar-01-foundations.md.
   Execute the [Section X] tasks per its acceptance criteria.
   When done, run the verification checklist at the end.
   ```
4. Mohammed reviews completion; pillar marked Done in this README.

---

## Source Documents (Discovery)

Read these for context before starting any pillar:

- `../recon-findings-2026-05-14.md` — initial recon
- `../intagna-analysis-2026-05-14.md` — old VOLT OS schema analysis
- `../volt-data-extraction-2026-05-14.md` — full email/calendar/drive intel
- `../deep-dive-findings-2026-05-14.md` — cost sheet, KPIs, internal patterns
