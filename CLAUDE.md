# Antagna — Claude Code Bootstrap

You're working in the **Antagna** repo (`github.com/wiqoo/antagna`), checked out at `/home/mohammed/antagna`. Single repo for both the **blueprint** (Pillars 1–16, decisions log, design docs) and the **code** (once it's written — `apps/`, `packages/`, schema, etc.).

> **First action every session:** read `STATUS.md` to find the active pillar and next concrete task. Don't re-read all 16 pillars by default.

---

## What Antagna is

Internal operating system for **Volt Production** (Saudi Arabia marketing/production company). CRM + Project Management + Equipment Management + Social Media Account Management. Built AI-native on Vercel + Supabase + Anthropic + OpenAI embeddings + Trigger.dev v3.

Owner: **Mohammed Ghareeb** (Director of Production). Team of 11 — full roster in `config/roles.yaml`.

Status: blueprint design complete (Pillars 1–16). Zero code written. Pillar 1 (Foundations) is the next thing to execute.

---

## Reading order for a fresh session

| When you need… | Read |
|---|---|
| What's happening now | `STATUS.md` |
| Why a decision was made the way it was | `decisions-log.md` (or `config/decisions.yaml`) |
| The active pillar's tasks | `pillar-0X-*.md` |
| Patches / overrides on any pillar | the `> **Patches:**` header at the top of that pillar (linked to Pillar 16) |
| The team / roles | `config/roles.yaml` and Pillar 16 §A |
| The locked stack | "Locked Foundation Decisions" in `README.md` |

**Don't reload the whole blueprint every session.** 8,400 lines. Use `STATUS.md` + the one active pillar.

---

## Conventions

- **Append-only decisions log.** New decisions get a new `D-NNN` ID; never edit a past decision in place — supersede it with a new one and link.
- **Pillar 16 patches earlier pillars.** Every patched pillar has a `> **Patches:**` header pointing at the relevant Pillar 16 sections. When you read Pillar X, scan that header first.
- **Two machines.** Mohammed plans on Windows (`C:\Users\AORUS\Documents\Claude\Projects\Management APP\`). Claude Code executes on Ubuntu (`/home/mohammed/antagna`). Both sides sync via this single `antagna` repo — no separate blueprint vs code repos.
- **Language.** Arabic + English mixed is normal for chat. Code, schema, identifiers: English only. UI strings: Arabic primary, English toggle.
- **Ask before big installs / cloud actions.** Anything that costs money or modifies cloud state (Vercel project create, Supabase project create, paid tier upgrades) needs explicit confirmation.
- **Always use exact Anthropic model strings** (D-020): `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`. Single source of truth lives in `packages/ai/src/models.ts` once code exists.

---

## Active stack (locked — see README.md and decisions-log.md)

- **Frontend:** Next.js 15 on Vercel
- **Backend:** Supabase (Postgres + Auth + Storage + Realtime + Edge Functions), region `eu-central-1` (Frankfurt)
- **ORM:** Drizzle
- **Monorepo:** pnpm + Turborepo
- **Jobs:** Trigger.dev v3, Pro tier from day 1 (D-005, hardened in Pillar 16 §B.2)
- **AI:** Anthropic Claude (Sonnet 4.6 default) + OpenAI text-embedding-3-small for memory
- **Mobile:** PWA first (Capacitor wrapper later if needed)
- **Communications:** Gmail API now, WhatsApp via self-hosted Baileys later (D-023)
- **Finance:** Antagna stores references only — **Dafterah** owns invoicing + ZATCA (D-022)

---

## What's out of scope (Phase 1)

HR module, finance module, old AR migration, 25% partner share modeling, old project history migration, WhatsApp integration. See D-014.

---

## Working with this repo

```bash
# Find what's next
cat STATUS.md

# Execute a pillar (uses the pillar-executor agent + checklist)
/pillar 01

# Show pending decisions
/decisions pending

# Run a pillar's acceptance checklist
/checklist 01
```

(The slash commands are defined in `.claude/commands/`. The agent in `.claude/agents/pillar-executor.md`.)
