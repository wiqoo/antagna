# Antagna — Live Status

> **The one file Claude Code reads first each session.** Updated every time something changes.
> Static "all ✓" tables live in `README.md`; this is the dynamic state.

**Last updated:** 2026-05-15
**Phase:** Pre-execution. Blueprint complete, **no code written yet.**

---

## 🎯 Next concrete action

> **Execute Pillar 1 — Foundations.** Start with `pillar-01-foundations.md §3` (Ubuntu machine setup).
> Then §4 (cloud accounts — 7 services to provision) → §5 (monorepo structure) → run §19 acceptance checklist.

**Where the work happens:** this same repo (`/home/mohammed/antagna`). Code lands in `apps/` and `packages/` alongside the existing pillar docs.

---

## 📍 Pillar status

| # | Pillar | Plan | Code | Verified |
|---|--------|------|------|----------|
| 01 | Foundations & Infra | ✓ | ⏳ **active** | — |
| 02 | Data Model | ✓ | ⏳ | — |
| 03 | Identity & Permissions | ✓ | ⏳ | — |
| 04 | CRM Core | ✓ | ⏳ | — |
| 05 | Project Lifecycle | ✓ | ⏳ | — |
| 06 | Equipment & Reservations | ✓ | ⏳ | — |
| 07 | Social Media Module | ✓ | ⏳ | — |
| 08 | Communications Layer | ✓ | ⏳ | — |
| 09 | Attendance & KPIs | ✓ | ⏳ | — |
| 10 | AI & Memory Layer | ✓ | ⏳ | — |
| 11 | Automation & Alerts | ✓ | ⏳ | — |
| 12 | UI/UX System | ✓ | ⏳ | — |
| 13 | Integrations | ✓ | ⏳ | — |
| 14 | Deployment & Ops | ✓ | ⏳ | — |
| 15 | Migration & Launch | ✓ | ⏳ | — |
| 16 | Hardening (patch) | ✓ | n/a | n/a |

Legend: ✓ done · ⏳ pending · ⏸ blocked

---

## 🚧 Open blockers

1. **Rename the GitHub repo from `antagna-blueprint` to `antagna`** — local remote is already updated. Mohammed needs to do this in the GitHub UI (Settings → Rename). GitHub auto-redirects old URLs so existing clones keep working.

2. **Cloud accounts not yet provisioned.** Pillar 1 §4 lists 7 services (Vercel, Supabase ×2, Anthropic, OpenAI, Trigger.dev, Sentry, Google Cloud). Some credentials already exist in memory; the others need manual setup.

---

## 🗳️ Pending decisions (from `decisions-log.md`)

| ID | What | Decide by |
|---|---|---|
| — | Trigger.dev tier (free vs paid) | Pillar 10 (kept Pro at D-005 already) |
| — | Sentry tier (free vs paid) | Pillar 14 |
| — | Domain name (`antagna.voltsaudi.com` vs `app.antagna.me`) | Pillar 14 |
| — | Email sending domain & provider | Pillar 8 |
| — | PDPL compliance level | revisit if KSA-resident client demands |
| — | Backup strategy (native Supabase vs off-site) | Pillar 14 |

---

## ⚠️ Recent risks / events

- **2026-05-15** — credentials snapshot (`Antagna — Credentials & IDs Reference`) loaded into Claude memory. Supabase / Vercel / Anthropic / OpenAI tokens available for automated provisioning.
- **2026-05-14** — Pillar 16 (hardening) added 26 fixes that supersede parts of Pillars 1, 2, 8, 9, 10, 11, 12, 13. Each patched pillar carries a `> **Patches:**` header pointing at Pillar 16.

---

## 🔄 How to update this file

When you finish a chunk of work:
1. Tick the matrix above.
2. Move the "Next concrete action" pointer.
3. Add to "Recent risks / events" if anything surprising happened.

Keep this file **under 200 lines.** It's a status board, not a journal.
