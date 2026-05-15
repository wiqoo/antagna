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

## Autonomy contract (aggressive — set 2026-05-15)

**Mohammed authorizes Claude Code to act autonomously on this repo.** Don't pause for routine confirmations. The allowlist in `.claude/settings.local.json` is generous; the rules below define what's still gated.

### ✅ Do without asking

- Read / Write / Edit anything inside `/home/mohammed/antagna/**`.
- Git: add, commit, branch, switch, merge (--ff or --no-ff), rebase, pull, push (to any branch including `main`), tag, fetch, remote config, cherry-pick, revert.
- Pnpm/npm: `install`, `add <pkg>`, `remove`, `update`, `build`, `typecheck`, `lint`, `test`, `db:*`. Vetting npm dependencies is on the user's reasonable judgment — install reputable libraries without asking.
- Local file ops: mkdir, mv, cp, chmod, ln. `rm` is allowed within `/home/mohammed/antagna/**` and `/tmp/**`; nowhere else.
- Cloud (staging AND production):
  - Provision Supabase / Vercel projects via the scripts in `scripts/`.
  - `vercel deploy` (preview or `--yes` prod), `vercel env` add/pull/list.
  - `supabase db push`, migration apply, function deploy.
  - Curl POST/PATCH against `api.supabase.com`, `api.vercel.com`, `api.trigger.dev` using the tokens in memory.
- GitHub: create repos, open PRs, comment on PRs/issues, merge PRs (after CI passes), view runs.
- Docker: build, compose up/down/logs, run containers in this repo's compose files.
- Run any of `scripts/*.sh` or `./antagna-bootstrap.sh`.
- Update `STATUS.md`, `decisions-log.md` (new `D-NNN`), `config/decisions.yaml`, `config/roles.yaml` — and commit those updates yourself.

### ⚠️ Still ask first ("مصيري")

These five categories pause for explicit user confirmation, every time:

1. **Force operations on shared history** — `git push --force`, `git push --force-with-lease`, `git reset --hard` on a branch that has been pushed, `git branch -D` on a branch with un-merged commits, rewriting public history with `git rebase -i` of pushed commits.
2. **Destructive blast outside this repo** — `rm` / `mv` / `chmod` outside `/home/mohammed/antagna/**` and `/tmp/**`. Editing system files (`/etc/...`, anything in `~/.config/` that isn't Claude's own). Anything with `sudo`.
3. **Rotating live production secrets** — replacing the Anthropic / OpenAI / Vercel / Supabase service-role keys that real users depend on. (Setting NEW keys for a new staging env is fine.)
4. **Spending real money beyond stated caps** — upgrading any service tier whose monthly bill jumps by more than ~$25; provisioning a paid Supabase Pro/Team for a new project; raising AI cost caps (Pillar 16 §B.2 already locks Trigger.dev Pro from day 1, that doesn't need re-asking).
5. **Operations visible to other humans** — sending email (Resend, Gmail API), posting WhatsApp, pinging Slack/Teams, opening PRs / commenting on issues in repos owned by other people, merging PRs into other people's repos.

Anything that fits ≥1 category → say what you're about to do in one sentence, then ask.

### 🛑 Never (without explicit, scoped permission)

- `git push --force` to `main` / a release branch.
- Drop a Supabase project, delete a Vercel project, delete a GitHub repo.
- Rotate Mohammed's personal credentials (the GitHub PAT, the cloud tokens) without a clear "yes, rotate".
- Touch the LIVE Antagna data (`prj_CPB8DKAwejSOjGr8T9jcn2r8t7xu` / Supabase `jhfkgmomntkgzzycdbmt`) without scope confirmation. Staging is fair game; live is privileged.
- Commit anything that looks like a real secret (a key matching `sk-ant-…`, `sb_secret_…`, `vca_…`, `sbp_…`). If you find one, surface it; don't commit it.

### How to behave inside this contract

- Move fast. Don't narrate every decision. Make the call, do the work, summarize at the end.
- Commit liberally — small, focused commits are cheaper to revert than one huge one.
- If a step is reversible and stays local, just do it. If it's irreversible OR external, pause and quote what you're about to do.
- When in genuine doubt, ask. The contract trades fewer prompts for more responsibility; don't burn the user by guessing wrong on something they'd have caught.

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
