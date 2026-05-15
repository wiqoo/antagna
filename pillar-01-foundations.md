# Pillar 1 — Foundations & Infrastructure

**Status:** In progress
**Owner:** Mohammed Ghareeb
**Estimated effort:** 2-4 Claude Code sessions on the Ubuntu machine

This pillar establishes everything before any feature code is written: the Ubuntu machine, the cloud accounts, the repo structure, the AI architecture pattern, the security baseline. When this is done, the team has a working dev environment that can be handed off to any later pillar without re-decisions.

---

## 1. Goals & Success Criteria

### Goals
- A clean Ubuntu machine ready for Claude Code work.
- A fresh Supabase project + Vercel project, with environment promotion (local → staging → production).
- A monorepo skeleton with `web`, `worker`, `shared`, `db` packages.
- Working Google Workspace SSO login (no app screens yet, just auth).
- An "always-on AI" architecture pattern, with Trigger.dev + Anthropic + OpenAI embeddings wired but no business logic yet.
- A memory layer (pgvector tables + retrieval helpers) ready to be filled by feature pillars.
- Security baseline: RLS on every table, audit log table, secrets in environment vault, MFA on the cloud accounts.
- Observability: Sentry hooked to web + worker, AI cost tracking table.

### Success Criteria — Pillar 1 is DONE when:
1. ✅ Mohammed can sign in with Google to `staging` and `production` URLs and land on an empty placeholder dashboard.
2. ✅ A trigger fires an Trigger.dev job that calls Claude Sonnet with a test prompt and writes the cost to the `ai_usage` table.
3. ✅ A pgvector test: embed "hello world" with OpenAI, store, retrieve by cosine similarity in <100ms.
4. ✅ `pnpm dev` works on Ubuntu; `pnpm build` works; deploy to Vercel staging succeeds.
5. ✅ Sentry receives a test error from web + worker.
6. ✅ pg_cron runs a 1-minute scheduled query that logs to a table.
7. ✅ A migration applied locally promotes successfully to staging.
8. ✅ All env vars are set in Vercel (web) + Trigger.dev secrets, never committed.
9. ✅ Audit log records the test sign-in.
10. ✅ The selective migration script from old Supabase imports the 162 equipment items as a sanity check (loaded into a `legacy_equipment_import` staging table — not the final `equipment` model yet).

---

## 2. The Two-Machine Workflow

Mohammed works across two machines:

| Machine | Role | Path |
|---------|------|------|
| **Windows desktop** | Planning, Cowork chat, blueprint review, brief writing | `C:\Users\AORUS\Documents\Claude\Projects\Management APP\` |
| **Ubuntu machine** | Development, Claude Code, all code | `/home/mohammed/antagna/` (we'll fix `<USER>` below) |

### Sync strategy

- The **blueprint folder** is the source of truth for plans. Lives on Windows, mirrored to Ubuntu via `git`:
  ```bash
  # On Ubuntu, one-time:
  cd /home/mohammed
  # Mohammed: create a private GitHub repo "antagna-blueprint" and push the Windows folder to it
  git clone git@github.com:wiqoo/antagna-blueprint.git
  cd antagna-blueprint
  ```
- The **code itself** lives on Ubuntu only. Pushed to a separate `antagna` repo on GitHub.
- Claude Code reads `antagna-blueprint` for plans, writes code into `antagna`.

> [!ACTION]
> Mohammed: share your GitHub username so we replace `wiqoo` everywhere. Ubuntu username confirmed as `mohammed`.

---

## 3. Ubuntu Machine Setup

Run these commands on the Ubuntu machine. They are idempotent; safe to re-run.

### 3.1 System update + essentials

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential ca-certificates gnupg lsb-release unzip jq
```

### 3.2 Node.js (via nvm)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
# restart shell or:
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm install 20
nvm alias default 20
node -v   # should be v20.x
```

### 3.3 pnpm

```bash
corepack enable
corepack prepare pnpm@latest --activate
pnpm -v   # should be 9.x
```

### 3.4 Claude Code

```bash
npm install -g @anthropic-ai/claude-code
claude --version
```
First time: `claude` → sign in via browser → return to terminal.

### 3.5 Supabase CLI

```bash
curl -fsSL https://supabase.com/cli/install/linux | bash
# or
npm install -g supabase
supabase --version
```

### 3.6 Vercel CLI

```bash
npm install -g vercel
vercel --version
vercel login
```

### 3.7 Docker (for local Postgres + local Supabase dev)

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# log out and back in for group to take effect
docker --version
```

### 3.8 GitHub auth (SSH)

```bash
ssh-keygen -t ed25519 -C "mohammed-ubuntu"
# accept defaults; no passphrase
cat ~/.ssh/id_ed25519.pub
```
Paste the public key into GitHub → Settings → SSH Keys.

### 3.9 Useful CLI extras

```bash
sudo apt install -y direnv
# add to ~/.bashrc:
echo 'eval "$(direnv hook bash)"' >> ~/.bashrc
```

---

## 4. Cloud Accounts Setup

These steps Mohammed does manually in the browser. Each step → save the resulting credentials in a temporary file (we'll wire them into the project later).

### 4.1 Vercel
- Sign in with Google (use `ghareib@voltsaudi.com`).
- Team name: `Antagna`.
- Plan: Hobby for staging, upgrade to Pro when production needs cron + longer functions.
- Note your team slug.

### 4.2 Supabase
Create TWO Supabase projects:

| Project | Purpose |
|---------|---------|
| `antagna-staging` | Used by Vercel preview deployments + local dev sometimes |
| `antagna-prod` | Production — touched only by main branch deploys |

For each:
- Region: **eu-central-1 (Frankfurt)** — best balance for KSA latency until Supabase opens KSA region. (Alternative: `us-east-1` if Frankfurt has noticeable lag.)
- Plan: Free for staging, Pro for production ($25/mo + usage).
- Note the **Project URL** and **anon key** and **service role key** for each.

### 4.3 Anthropic
- Console: https://console.anthropic.com
- Create a workspace `Antagna`.
- Generate two API keys: `antagna-staging` and `antagna-prod`.
- Set spend limits per key (e.g., $200/month staging, $1000/month production initially — we'll tune).

### 4.4 OpenAI (embeddings only)
- Platform: https://platform.openai.com
- Add $10 credit to start.
- Generate one API key `antagna-embeddings`.
- Restrict to `embeddings` scope only (in API key settings → Permissions → Restricted → tick "Embeddings: Write").

### 4.5 Trigger.dev
- https://trigger.dev (or self-hosted via Docker Compose — defer decision).
- Create projects `antagna-prod` and `antagna-staging`.
- Note the API key for each.
- Plan: Cloud Free / Pro $10-25/mo start. Migrate to self-hosted if costs scale or KSA-residency demands it.

### 4.6 Sentry
- https://sentry.io
- Create org `Antagna`.
- Create two projects: `antagna-web` and `antagna-worker`.
- Note both DSNs.

### 4.7 Google Cloud Console (for Workspace SSO + Drive/Calendar/Gmail later)
- Project: `Antagna Saudi`.
- Enable APIs:
  - Google OAuth 2.0
  - Gmail API
  - Google Calendar API
  - Google Drive API
- Create OAuth 2.0 Client ID for `Web application`:
  - Authorized JavaScript origins: `https://antagna-staging.vercel.app`, `https://antagna.voltsaudi.com` (or whatever final domain)
  - Authorized redirect URIs: same with `/auth/callback`
- Note `CLIENT_ID` and `CLIENT_SECRET`.
- Configure OAuth consent screen → restrict to `voltsaudi.com` domain (Google Workspace internal only) for now.

> [!ACTION]
> Mohammed: do these 7 account setups in parallel. Send me back: the project URLs/slugs, but **never** the secrets (we'll set those directly in Vercel/Trigger.dev dashboards via copy-paste).

---

## 5. Repo Structure

### 5.1 Create the monorepo

On Ubuntu:

```bash
mkdir -p ~/antagna
cd ~/antagna
git init
pnpm init
```

Use this top-level structure:

```
antagna/
├── apps/
│   ├── web/                   # Next.js 15 app (the UI)
│   └── worker/                # Trigger.dev worker (background AI loops)
├── packages/
│   ├── db/                    # Drizzle schema, migrations, types
│   ├── ai/                    # Anthropic + OpenAI clients, memory layer, prompts
│   ├── shared/                # Shared types, validators (Zod), utilities
│   └── ui/                    # Shared React components (shadcn-based)
├── supabase/
│   ├── migrations/            # SQL migrations (managed by Supabase CLI)
│   ├── seed.sql               # Local seed data
│   └── config.toml            # Supabase project config
├── scripts/                   # One-off scripts (migration, data import)
├── .github/
│   └── workflows/             # CI: lint, test, build, deploy
├── pnpm-workspace.yaml
├── turbo.json
├── package.json
├── tsconfig.base.json
├── .editorconfig
├── .gitignore
├── .nvmrc                     # "20"
└── README.md
```

### 5.2 `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### 5.3 `turbo.json` (minimal start)

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": [".next/**", "dist/**"] },
    "dev": { "cache": false, "persistent": true },
    "lint": {},
    "type-check": {},
    "test": { "dependsOn": ["^build"] }
  }
}
```

### 5.4 Root `package.json`

```json
{
  "name": "antagna",
  "private": true,
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "type-check": "turbo run type-check",
    "test": "turbo run test",
    "db:gen": "pnpm --filter @antagna/db drizzle:generate",
    "db:push": "pnpm --filter @antagna/db drizzle:push",
    "db:studio": "pnpm --filter @antagna/db drizzle:studio"
  },
  "packageManager": "pnpm@9.0.0",
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.4.0"
  }
}
```

---

## 6. Tech Stack — Locked Versions

| Layer | Tool | Version (target) | Why |
|-------|------|------------------|-----|
| Frontend | Next.js | 15.x (App Router) | Latest stable, server actions, partial pre-rendering |
| Language | TypeScript | 5.4+ strict | Type safety end-to-end |
| Styling | Tailwind CSS | 3.4 | Industry standard, fits shadcn |
| Components | shadcn/ui | latest | Composable primitives; we own the code |
| Forms | React Hook Form + Zod | latest | Validated forms |
| Data fetching | TanStack Query | 5.x | Server state |
| Client state | Zustand | 4.x | Local UI state only |
| i18n | next-intl | latest | AR/EN with proper RTL |
| Database | Postgres | 15+ (Supabase managed) | Native pgvector, RLS |
| ORM | Drizzle ORM | 0.30+ | Edge compat, SQL-first |
| Auth | Supabase Auth | bundled | Google SSO, easy RLS integration |
| Storage | Supabase Storage | bundled | Files + signed URLs |
| Realtime | Supabase Realtime | bundled | Postgres LISTEN/NOTIFY |
| Background jobs | **Trigger.dev v3** | 3.x | Open-source, self-hostable, $10/mo cloud start, mature AI agent workflows |
| Scheduled SQL | pg_cron | bundled in Supabase | SQL cron |
| AI reasoning | `@anthropic-ai/sdk` | latest | Claude Sonnet 4.6 (`claude-sonnet-4-6`), Haiku 4.5 (`claude-haiku-4-5-20251001`), Opus 4.6 (`claude-opus-4-6`) |
| AI embeddings | `openai` | latest | text-embedding-3-small (1536-dim) |
| Vector storage | pgvector | bundled in Supabase | In-DB vector search |
| Error tracking | `@sentry/nextjs` | latest | Web + worker errors |
| Logging | `pino` | latest | Structured logs |
| Email send | `resend` | latest (Phase 1 limit) | Replace with custom SMTP later if needed |
| Testing (later) | Vitest + Playwright | latest | Unit + e2e |

> [!NOTE]
> No npm install commands here — the actual installation will happen in Section 11 once the repo skeleton is created.

---

## 7. Authentication Architecture

### 7.1 Primary: Google Workspace SSO

Mohammed's team are all on `*@voltsaudi.com`. Flow:

1. User clicks **Sign in with Google** on `app.antagna.voltsaudi.com`.
2. Google OAuth, restricted to the `voltsaudi.com` domain (configured in Google Cloud Console).
3. Supabase Auth receives the OAuth token, creates / matches a `auth.users` row.
4. Postgres trigger `handle_new_auth_user()` creates a row in `public.profiles` with the matching email, name, and `role='user'` (defaults; admin upgrades roles manually).
5. Profile insert triggers `auto_link_or_create_employee()` to ensure `public.employees` exists.

### 7.2 Fallback (Phase 2): WhatsApp OTP

Deferred. Not in Pillar 1. We design the schema with `phone_number` field present so it's ready.

### 7.3 Session management

- Cookies: HTTP-only, secure, SameSite=Lax, 7-day refresh.
- Server-side session checks via Supabase middleware in `apps/web/src/middleware.ts`.
- Route protection: any path under `/app/*` requires auth; `/auth/*` is public.

### 7.4 First-admin bootstrap

After deploy, Mohammed signs in once. Then a manual SQL one-liner promotes him:
```sql
UPDATE public.profiles SET role = 'system_admin' WHERE email = 'ghareib@voltsaudi.com';
```

---

## 8. Database Foundation

### 8.1 Drizzle setup (packages/db)

```
packages/db/
├── src/
│   ├── schema/
│   │   ├── auth.ts            # profiles, employees, sessions
│   │   ├── audit.ts           # audit_log, activity_events
│   │   ├── memory.ts          # ai_memory_chunks, ai_usage, ai_user_limits
│   │   └── index.ts
│   ├── client.ts              # createClient(env) wrapper
│   ├── types.ts               # exported Drizzle types
│   └── index.ts
├── drizzle.config.ts
└── package.json
```

### 8.2 Pillar 1 tables (minimum viable)

These are the ONLY tables Pillar 1 creates. Feature tables come in later pillars.

```typescript
// profiles — Supabase auth-linked
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  authUserId: uuid("auth_user_id").references(() => authUsers.id).unique(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  fullNameAr: text("full_name_ar"),
  role: text("role").notNull().default("user"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// audit_log — every important state change
export const auditLog = pgTable("audit_log", {
  id: bigserial("id").primaryKey(),
  actorId: uuid("actor_id").references(() => profiles.id),
  actorEmail: text("actor_email"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  summary: text("summary"),
  beforeData: jsonb("before_data"),
  afterData: jsonb("after_data"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ai_usage — cost ledger, append-only
export const aiUsage = pgTable("ai_usage", {
  id: bigserial("id").primaryKey(),
  feature: text("feature").notNull(),         // 'project_status' | 'brief_parse' | 'daily_brief' | ...
  model: text("model").notNull(),             // 'claude-sonnet-4-6' | 'text-embedding-3-small' | ...
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
  cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
  costUsd: numeric("cost_usd", { precision: 12, scale: 6 }).notNull().default("0"),
  userId: uuid("user_id").references(() => profiles.id),
  projectId: uuid("project_id"),              // soft FK, resolved later
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ai_user_limits — soft caps per user
export const aiUserLimits = pgTable("ai_user_limits", {
  userId: uuid("user_id").primaryKey().references(() => profiles.id),
  dailyLimitUsd: numeric("daily_limit_usd", { precision: 10, scale: 4 }).notNull().default("2.0"),
  monthlyLimitUsd: numeric("monthly_limit_usd", { precision: 10, scale: 4 }).notNull().default("30.0"),
  hardCap: boolean("hard_cap").notNull().default(false),  // false = warn only; true = block
  notes: text("notes"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ai_memory_chunks — the memory layer
export const aiMemoryChunks = pgTable("ai_memory_chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  scope: text("scope").notNull(),             // 'user' | 'project' | 'client' | 'company'
  scopeId: uuid("scope_id"),                  // null for company-wide
  source: text("source").notNull(),           // 'email' | 'whatsapp' | 'project_event' | 'meeting' | 'manual'
  sourceId: text("source_id"),                // e.g., gmail thread id
  content: text("content").notNull(),         // the chunk text
  contentLang: text("content_lang"),          // 'ar' | 'en' | 'mixed'
  embedding: vector("embedding", { dimensions: 1536 }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// system_settings — single key-value store
export const systemSettings = pgTable("system_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### 8.3 Required extensions (Supabase SQL editor, once per project)

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "btree_gist";    -- for exclusion constraints in equipment_reservations later
```

### 8.4 RLS baseline (every table)

Pillar 1 establishes the pattern. EVERY table in EVERY future pillar must follow this:

```sql
-- Example for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_self_read" ON public.profiles
  FOR SELECT USING (auth.uid() = auth_user_id OR public.is_admin_caller());

CREATE POLICY "profiles_admin_write" ON public.profiles
  FOR ALL USING (public.is_admin_caller());
```

A `helpers.sql` migration creates these reusable functions:

```sql
CREATE OR REPLACE FUNCTION public.current_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.profiles WHERE auth_user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin_caller()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT public.current_role() IN ('system_admin', 'admin');
$$;
```

### 8.5 Audit trigger pattern

A reusable `audit_table()` function attached as `AFTER INSERT OR UPDATE OR DELETE` on every important table writes to `audit_log` with `before_data` and `after_data` jsonb diffs.

```sql
CREATE OR REPLACE FUNCTION public.fn_audit_row_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.audit_log (actor_id, actor_email, action, entity_type, entity_id, before_data, after_data)
  VALUES (
    auth.uid(),
    (SELECT email FROM public.profiles WHERE auth_user_id = auth.uid()),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id::text, OLD.id::text),
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE row_to_json(OLD)::jsonb END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE row_to_json(NEW)::jsonb END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;
```

Every feature table just does:
```sql
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE
ON public.<table> FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row_change();
```

---

## 9. Always-On AI Architecture

This is the heart of Antagna. The system is not a CRUD app with AI features bolted on — it's an AI agent loop with humans in it.

### 9.1 The four AI loops (Pillar 1 just sets up the scaffold)

| Loop | When it fires | What it does | Implementation |
|------|---------------|--------------|----------------|
| **Reactive** | On every relevant DB event (new email, new project status, etc.) | Parse, classify, suggest | Trigger.dev task listening on event triggers |
| **Scheduled** | Every N minutes (5min / 1h / daily / weekly) | Scan for stalled items, generate digests | pg_cron + Trigger.dev `schedules.task()` |
| **On-demand** | User clicks "Ask Antagna" | Generate report, answer question | Edge Function with streaming response (Vercel) |
| **Memory builder** | After every interaction | Embed, store in `ai_memory_chunks` | Trigger.dev task on `*.completed` events |
| **MCP** (new) | When admin or external Claude/Cursor connects | Acts on Antagna via tool calls | Antagna's own MCP server exposed at `/api/mcp` |

### 9.2 Trigger.dev setup (apps/worker)

```
apps/worker/
├── src/
│   ├── trigger/                  # Trigger.dev tasks (auto-discovered)
│   │   ├── ai-reactive.ts        # event-triggered: reacts to email/project changes
│   │   ├── ai-scheduled.ts       # cron tasks: stalled-project scan, daily briefs
│   │   ├── ai-memory.ts          # embedding + storage tasks
│   │   ├── ai-cost-monitor.ts    # hourly ai_usage rollup + soft-cap warnings
│   │   ├── email-ingest.ts       # Gmail Pub/Sub → parse → memory → notification
│   │   └── chase-runner.ts       # auto follow-up emails per chase rules
│   ├── lib/
│   │   ├── ai-call.ts            # wrapper around Anthropic SDK with cost tracking
│   │   └── memory.ts             # embed + store + retrieve helpers
│   └── trigger.config.ts
├── package.json
└── tsconfig.json
```

Tasks use Trigger.dev's `task()` API — every task is durable, retryable, and observable. Long-running AI agent loops survive restarts. Cron tasks use `schedules.task()`.

### 9.3 The cost guard pattern

Every Claude/OpenAI call goes through this wrapper:

```typescript
// packages/ai/src/call-claude.ts
export async function callClaude(opts: {
  userId: string;
  feature: string;
  model: 'sonnet-4-6' | 'haiku-4-5' | 'opus-4-6';
  messages: Anthropic.MessageParam[];
  max_tokens: number;
}) {
  // 1. Check user limits
  const limit = await checkUserLimit(opts.userId, opts.feature);
  if (limit.blocked) {
    logger.warn({ userId: opts.userId, feature: opts.feature }, "AI call blocked by limit");
    return { blocked: true, reason: limit.reason };
  }

  // 2. Make call (with prompt caching for system prompts)
  const start = Date.now();
  const response = await anthropic.messages.create({
    model: MODEL_MAP[opts.model],
    max_tokens: opts.max_tokens,
    messages: opts.messages,
  });

  // 3. Record usage
  await db.insert(aiUsage).values({
    feature: opts.feature,
    model: MODEL_MAP[opts.model],
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
    costUsd: calculateCost(opts.model, response.usage),
    userId: opts.userId,
  });

  // 4. If user crossed soft cap → notify (don't block unless hard_cap = true)
  await maybeWarnLimitApproaching(opts.userId);

  return { blocked: false, response, durationMs: Date.now() - start };
}
```

### 9.4 Model routing (cost-aware default)

| Task class | Default model | Reasoning |
|------------|---------------|-----------|
| High-volume batch (categorize 1000 emails) | Haiku 4.5 | Fast, cheap |
| Daily user brief generation | Sonnet 4.6 | Quality matters; once per user per day |
| Project status analysis | Sonnet 4.6 | Per-project, important |
| Brief parsing (extract structured data) | Sonnet 4.6 | Single-shot, high stakes |
| Complex multi-step reasoning (project plan) | Opus 4.6 | Worth the cost for the few hard cases |
| Memory chunk classification | Haiku 4.5 | High volume |
| Quick UI suggestions | Sonnet 4.6 | User-facing latency target <2s |

### 9.5 Prompt caching strategy

Every system prompt (>1024 tokens, repeated) uses Anthropic prompt caching. Massive cost reduction for repeated reasoning.

### 9.6 Antagna's own MCP server (new in 2026 patterns)

To let internal team members use Claude / Cursor / external Claude clients to act on the system, Antagna exposes its own MCP server at `apps/web/api/mcp/route.ts`:

```
Tools exposed by Antagna MCP:
- list_projects(stage?, client_id?)
- get_project(id) -> full project bundle
- create_task(project_id, title, assignee_id, due_at)
- update_deliverable_status(deliverable_id, status, note?)
- send_chase_email(invoice_id, template_key) -> drafts only, requires confirm
- search_memory(scope, query) -> retrieve from ai_memory_chunks
- log_meeting_notes(project_id, content)
- ...
```

This means Mohammed can say in Claude: "open project PRJ-0023, mark all delivered, and remind Khaled to invoice" — and it works. Same for the team via Cursor.

Auth via Bearer token + scoped per profile. Read-only by default; write actions require explicit user confirmation in the UI.

```typescript
const systemPrompt = [
  { type: "text", text: COMPANY_CONTEXT, cache_control: { type: "ephemeral" } },
  { type: "text", text: TASK_SPECIFIC_INSTRUCTIONS },
];
```

---

## 10. Memory Layer Architecture

### 10.1 The 4 memory scopes

| Scope | Examples | Retrieval trigger |
|-------|----------|-------------------|
| **user** | Mohammed's preferences, his interaction history | Personalizing notifications, suggestions |
| **project** | This project's brief, all comms, deliverables, revisions | When opening / discussing a project |
| **client** | All projects for this client, payment history, communication style | Drafting a quote, replying to client |
| **company** | Company policies, common templates, institutional knowledge | "How do we usually do X?" |

### 10.2 Schema

`ai_memory_chunks` (defined in §8.2) holds embedded text chunks with `scope` and `scope_id`. Each chunk is 500-2000 tokens. Retrieval is hybrid: vector similarity (top-K) + recency boost + scope filter.

### 10.3 Embedding pipeline

```typescript
// packages/ai/src/embed.ts
export async function embedAndStore(chunk: {
  scope: 'user' | 'project' | 'client' | 'company';
  scopeId: string | null;
  source: string;
  sourceId: string;
  content: string;
  metadata?: Record<string, any>;
}) {
  // 1. Detect language
  const lang = detectLanguage(chunk.content);
  
  // 2. Embed via OpenAI
  const { data } = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: chunk.content,
  });
  
  // 3. Store
  await db.insert(aiMemoryChunks).values({
    ...chunk,
    contentLang: lang,
    embedding: data[0].embedding,
  });
  
  // 4. Record cost
  await recordEmbeddingUsage(chunk.content.length);
}
```

### 10.4 Retrieval

```typescript
export async function recallMemory(opts: {
  query: string;
  scopes: { scope: string; scopeId?: string }[];
  limit?: number;
}): Promise<MemoryChunk[]> {
  const queryEmbedding = await embed(opts.query);
  
  return db.select()
    .from(aiMemoryChunks)
    .where(
      and(
        inArray(aiMemoryChunks.scope, opts.scopes.map(s => s.scope)),
        // additional scope_id filter
      )
    )
    .orderBy(cosineDistance(aiMemoryChunks.embedding, queryEmbedding))
    .limit(opts.limit ?? 10);
}
```

`cosineDistance` is a Drizzle helper around pgvector's `<=>` operator.

---

## 11. Installation Order (Claude Code executes this on Ubuntu)

```bash
cd ~/antagna

# Root
pnpm init
echo "20" > .nvmrc
cat > .gitignore <<'EOF'
node_modules
.next
dist
.env
.env.local
.turbo
.vercel
.DS_Store
*.log
EOF

# Workspaces
mkdir -p apps/web apps/worker packages/db packages/ai packages/shared packages/ui

cat > pnpm-workspace.yaml <<'EOF'
packages:
  - "apps/*"
  - "packages/*"
EOF

# Turbo
pnpm add -Dw turbo typescript @types/node

# Next.js app
cd apps/web
pnpm create next-app@latest . --typescript --tailwind --app --import-alias "@/*" --src-dir --no-eslint --use-pnpm
cd ../..

# Worker (Trigger.dev)
cd apps/worker
pnpm init
pnpm add @trigger.dev/sdk@latest @anthropic-ai/sdk openai pino dotenv
pnpm add -D typescript tsx @types/node
npx trigger.dev@latest init
cd ../..

# db package
cd packages/db
pnpm init
pnpm add drizzle-orm postgres
pnpm add -D drizzle-kit
cd ../..

# ai package
cd packages/ai
pnpm init
pnpm add @anthropic-ai/sdk openai
cd ../..

# shared package
cd packages/shared
pnpm init
pnpm add zod
cd ../..

# Install supabase init in project root
supabase init

# First migration: extensions + helpers + tables from §8
# (Claude Code writes the migration file to supabase/migrations/)

# Push to staging
supabase link --project-ref <staging-project-ref>
supabase db push

# Deploy to Vercel staging
cd apps/web
vercel link
vercel env pull .env.local
vercel deploy
```

---

## 12. Environment Variables

### 12.1 Per-environment

| Variable | Local | Staging | Production |
|----------|-------|---------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | local Supabase | staging URL | prod URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | local anon | staging anon | prod anon |
| `SUPABASE_SERVICE_ROLE_KEY` | local service | staging service | prod service |
| `ANTHROPIC_API_KEY` | dev key (low limit) | staging | production |
| `OPENAI_API_KEY` | shared dev | staging | production |
| `TRIGGER_API_KEY` | dev | staging | production |
| `TRIGGER_SECRET_KEY` | dev | staging | production |
| `SENTRY_DSN_WEB` | dev | staging | production |
| `SENTRY_DSN_WORKER` | dev | staging | production |
| `NEXT_PUBLIC_APP_URL` | http://localhost:3000 | staging URL | prod URL |
| `RESEND_API_KEY` | dev | staging | production |
| `GOOGLE_CLIENT_ID` | dev | staging | production |
| `GOOGLE_CLIENT_SECRET` | dev | staging | production |

### 12.2 Where they live

- **Local**: `.env.local` per package, ignored by git.
- **Vercel**: in Vercel project settings → Environment Variables → mark per-environment.
- **Trigger.dev**: in Trigger.dev project settings → Secrets.
- **Supabase**: Vercel pulls them via `vercel env pull`.

### 12.3 Never in git

A `pre-commit` hook (via Husky later) scans for committed secrets. Pillar 14 adds the actual hook; for now: trust + grep before push.

---

## 13. Dev Workflow

### 13.1 Branching model

- `main` → deploys to **production** via Vercel + Supabase prod migration.
- `dev` → deploys to **staging** preview.
- `feature/*` → preview deploys on every push, separate database branch.

### 13.2 Migration workflow

```bash
# 1. Edit schema in packages/db/src/schema/*
# 2. Generate migration
pnpm db:gen

# 3. Inspect generated SQL in supabase/migrations/<timestamp>.sql
# 4. Apply locally
supabase db reset    # or: supabase db push

# 5. Test on staging
git push origin dev
# (CI runs migration on staging Supabase)

# 6. Merge dev → main
# (CI runs migration on prod Supabase)
```

### 13.3 Code quality gates (Pillar 14 adds full CI; baseline for Pillar 1)

- `pnpm type-check` must pass.
- No commits to `main` directly; always via PR.
- Branch protection enabled on GitHub.

---

## 14. Security Baseline

### 14.1 Account hardening
- 2FA on GitHub, Vercel, Supabase, Anthropic, OpenAI, Trigger.dev, Sentry, Google Cloud.
- Per-environment API keys (dev keys never touch prod).
- Service role keys server-only (never exposed to browser).

### 14.2 Database
- RLS enabled on EVERY public table.
- `system_admin` role for Mohammed + Abu Luka (when he gets a working email — flagged as decision item).
- Audit log on every important entity.
- Soft deletes on critical tables (`archived_at` column) instead of hard delete.
- Daily Supabase backup (built-in on Pro).

### 14.3 Application
- All API routes auth-checked.
- CSRF tokens on form submissions (Next.js Server Actions handle by default).
- Content Security Policy headers configured in `next.config.mjs`.
- Sentry error reporting with source maps.

### 14.4 Secrets rotation
- Quarterly rotation of API keys (calendar event added on activation).

### 14.5 Saudi PDPL compliance (KSA-specific)

Saudi Personal Data Protection Law (PDPL) is in full enforcement (SDAIA, since Sep 2024). Since Volt is NOT a critical-sector (banking/healthcare) entity, **data residency outside KSA is allowed** with conditions. Pillar 1 establishes:

- **Supabase DPA** signed (Data Processing Agreement). Vercel DPA signed.
- **Standard Contractual Clauses (SCCs)** in place for cross-border transfer of Saudi residents' data to Frankfurt.
- **Data-flow map** documented in `docs/compliance/pdpl-data-flow.md` (Pillar 14 fills it in).
- **Subject rights endpoints**: data export + deletion built into the user profile page (Pillar 12).
- **Breach notification process** documented (Pillar 14).
- **DPO designation** (Mohammed Ghareeb acts as DPO contact until / unless this changes).

Re-evaluate if a future client requires KSA-resident storage; then move Postgres to a KSA-hosted Postgres (STC Cloud or self-hosted) and keep Vercel for the stateless app.

---

## 15. Observability

### 15.1 Errors → Sentry
- `@sentry/nextjs` on web + `@sentry/node` on worker.
- Error fingerprinting + Slack/email alerts on new error types.

### 15.2 Logs → Structured (pino) → Vercel Logs / Supabase Functions logs
```typescript
import pino from "pino";
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: 'antagna-web' },
});
logger.info({ userId, action: 'sign_in' }, "User signed in");
```

### 15.3 AI cost dashboards
A simple `/admin/ai-cost` page (built in Pillar 10) reads from `ai_usage` and shows:
- Cost per day, last 30 days
- Cost per feature
- Cost per user
- Top 10 most expensive calls
- Soft cap breach events

For Pillar 1, just ensure the data is being recorded correctly.

### 15.4 Health checks
- `/api/health` returns `{ ok: true, db: 'connected', ai: 'reachable' }`.
- Vercel monitors this on each deployment.

---

## 16. Naming Conventions

### 16.1 Code
- Files: `kebab-case.ts` (e.g., `call-claude.ts`)
- Components: `PascalCase` (e.g., `ProjectCard.tsx`)
- Functions: `camelCase` (e.g., `embedAndStore`)
- Types/Interfaces: `PascalCase` (e.g., `MemoryChunk`)
- DB tables: `snake_case` plural (e.g., `ai_memory_chunks`)
- DB columns: `snake_case` (e.g., `content_lang`)
- Env vars: `SCREAMING_SNAKE_CASE`

### 16.2 Git commits
Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.
Body in English (technical); commit description can include Arabic if it adds clarity.

### 16.3 UI text
- Code identifiers / variable names: **English only**.
- UI labels: **Arabic primary + English toggle**. Stored in `messages/ar.json` + `messages/en.json` (next-intl).
- Technical industry terms in UI (brief, stage, deliverable, thread, status): **kept in English** within the Arabic UI to match how the team actually talks.

---

## 17. Initial Migration — The Selective Import

### 17.1 What gets imported on day 1

| From | Table | Approx rows | Notes |
|------|-------|-------------|-------|
| Old Supabase | `equipment` | 162 | Most valuable single asset. Pull into Antagna's `equipment` model in Pillar 6. |
| Old Supabase | `clients` (active only) | ~30-50 | "Active" = had a project in last 12 months. |
| Old Supabase | `projects` (current only) | ~5-10 | Status in `[brief, quoted, approved, shooting, editing, review]`. |
| Old Supabase | `electronics` | 57 | Office IT inventory. |
| Old Supabase | `furniture` | 11 | Office furniture. |

### 17.2 What does NOT get imported
- Historical projects (status = `delivered`, `archived`, `lost`, `cancelled`)
- Old financial entries (`audit_log`, `ai_usage`, `invoices`)
- Old briefs as data (we'll re-parse a few via AI later if useful)
- Old equipment activity / equipment reservations history
- Old discovery module data
- Old WhatsApp / email tables (we'll re-ingest from live Gmail)
- Old AR aging (Mohammed working on it separately)

### 17.3 Migration script

For Pillar 1, the script writes to a STAGING table `legacy_equipment_import` so we can verify before mapping into the final `equipment` model in Pillar 6.

```bash
# scripts/migrate-equipment.ts
# Connects to old Supabase via service role
# Reads equipment_view
# Writes to legacy_equipment_import in new Supabase
# Logs differences and any data integrity issues
```

---

## 18. PWA Foundations

Pillar 1 just wires up the manifest + service worker; offline UX comes in Pillar 12.

```bash
cd apps/web
pnpm add next-pwa
```

`next.config.mjs`:
```js
import withPWA from 'next-pwa';

const pwaConfig = withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
});

export default pwaConfig({
  // ...rest of next config
});
```

`public/manifest.json`:
```json
{
  "name": "Antagna",
  "short_name": "Antagna",
  "description": "Volt Production internal OS",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0b0d0e",
  "theme_color": "#f5d60a",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

---

## 19. Acceptance Checklist — Pillar 1 is "Done"

Claude Code (or Mohammed) must verify all of these before moving to Pillar 2.

- [ ] Ubuntu machine has Node 20, pnpm 9, Claude Code, Supabase CLI, Vercel CLI, Docker all working.
- [ ] GitHub: `antagna` (private) and `antagna-blueprint` (private) repos created and pushed.
- [ ] Vercel project `antagna` linked to GitHub repo, staging deploy succeeds and shows placeholder.
- [ ] Supabase `antagna-staging` and `antagna-prod` projects created, extensions installed, helper functions in place.
- [ ] Drizzle schemas in `packages/db/src/schema/*` define Pillar 1 tables (profiles, audit_log, ai_usage, ai_user_limits, ai_memory_chunks, system_settings).
- [ ] Migration applied to staging Supabase; tables visible in dashboard with RLS enabled.
- [ ] Google OAuth configured; Mohammed can sign in via `https://antagna-staging.vercel.app` and his profile row is auto-created.
- [ ] After sign-in, manual SQL promotes Mohammed to `system_admin`.
- [ ] Test Claude API call from `apps/worker` via Trigger.dev succeeds and writes to `ai_usage`.
- [ ] Test OpenAI embedding call: embed "hello world", insert into `ai_memory_chunks`, retrieve by similarity query → returns the row.
- [ ] pg_cron test job runs every minute and logs to a test table for 5 minutes.
- [ ] Sentry receives a test error from each app (`apps/web`, `apps/worker`).
- [ ] Selective migration script connects to old Supabase, pulls 162 equipment rows into `legacy_equipment_import`, no errors.
- [ ] Audit log records the test sign-in (via trigger).
- [ ] `pnpm type-check`, `pnpm build` both pass on Ubuntu.

---

## 20. Risks & Open Items

1. **Abu Luka's account** — old email cancelled; new account will be created later (confirmed 2026-05-14). For now: his profile row exists but is `active=false`. He'll be activated when Mohammed provisions a Workspace email for him. Approvals in the meantime can be recorded as "approved by Mohammed on behalf of Abu Luka" via an `acting_for` field on the audit log.
2. **Trigger.dev Pro tier from day 1** ($25/mo). Free tier (5K runs/month) is too small — email parser + memory chunker + insights scanner + alert scanner together hit it in the first week. Pro = ~250K runs and that's our actual scale.
3. **Resend free tier** caps emails sent; OK for testing. Production email via Resend Pro or custom SMTP later.
4. **OpenAI embedding stability** — small risk they deprecate or change pricing. We have a 6+ month runway and the embedding interface is abstracted in `packages/ai/embed.ts`.
5. **Saudi data residency (PDPL)** — Supabase Frankfurt is NOT inside KSA. Acceptable risk for MVP. Re-evaluate if a major client demands KSA-resident storage.
6. **Multi-Mohammed name confusion** — Abu Luka is "محمد المالكي" legally but UI uses "أبو لوكا". Mohammed Ghareeb is "محمد غريب". The system must NEVER confuse them. Schema will enforce a `display_name` field separate from `legal_name`.

---

## 21. Next Pillar Preview

Pillar 2 (Data Model) will build on this foundation:
- Person, Role, Capability, Skill (multi-hat model)
- Client, Brand, Agency, Contact
- Project, Brief, Deliverable, Revision, Invoice (logical model only; finance fields exist but module deferred)
- Equipment, Kit, Reservation, ActivityLog
- The relationship matrix (who can do what)

When Pillar 1 is fully checked off, we open `pillar-02-data-model.md` and continue.

---

**End of Pillar 1.**
