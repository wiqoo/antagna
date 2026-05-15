# scripts/

Operational scripts for the Antagna repo. All are idempotent unless noted.

| Script | What it does | Required env |
|---|---|---|
| `bootstrap.sh` | Set up a fresh Ubuntu machine — Node, pnpm, Claude Code, Supabase/Vercel/Trigger CLIs, Docker, GitHub CLI, then clone this repo. Parametrized via env (drop-in replacement for `../antagna-bootstrap.sh`). | optional: `GITHUB_USER`, `REPO_NAME`, `CODE_DIR`, `NODE_VERSION`, `INSTALL_DOCKER` |
| `provision-supabase.sh` | Create `antagna-staging` + `antagna-prod` Supabase projects (skips if they already exist). Uses the Management API — no `supabase init` / `supabase link` needed. | `SUPABASE_ACCESS_TOKEN` (sbp_…), `SUPABASE_ORG_ID` |
| `provision-vercel.sh` | Create the two Vercel projects (idempotent). | `VERCEL_TOKEN` (vca_…), `VERCEL_TEAM_ID` |

## Why these exist

Pillar 1 §4 asked Mohammed to click through 7 cloud account setups by hand. The legacy `antagna-bootstrap.sh` installs CLIs but stops short of provisioning. These scripts close that gap for the two services with usable REST APIs (Supabase, Vercel).

Anthropic, OpenAI, Trigger.dev, Sentry, and Google Cloud project creation is still manual — no general-purpose REST endpoints exist for those.

## Order of execution (first-time setup)

1. `bash scripts/bootstrap.sh` — get the machine ready.
2. Fill in `.env.local` with the credentials you already have (some live in Claude's memory).
3. `bash scripts/provision-supabase.sh` — creates the two Postgres projects.
4. `bash scripts/provision-vercel.sh` — creates the two web projects.
5. Manually set up Anthropic / OpenAI / Trigger.dev / Sentry / Google Cloud projects (one-time browser work).
6. Open Claude Code in this folder; it auto-reads `CLAUDE.md` and `STATUS.md`.
