# Pillar 10 — AI & Memory Layer

**Status:** Planning
**Depends on:** Pillars 1-8
**Estimated effort:** 3-4 sessions (heart of "always-on AI")

The pillar that turns Antagna from a CRUD app into an AI agent loop with humans in it. Defines exactly which AI loops run, when, with which model, against what memory.

---

## 1. Goals

- **6 AI loops** running on Trigger.dev — reactive, scheduled, on-demand, memory-builder, MCP server, suggestion stream.
- **4-layer memory** (user / project / client / company) with hybrid retrieval (vector + BM25 + recency).
- **Prompt library** versioned in code — every prompt is a Git-tracked artifact.
- **Cost tracking** per feature with soft caps and alerts.
- **Quality tracking**: which AI calls produced "useful" output vs "had to be re-done by a human".

## 2. Success Criteria

1. Inbound email → within 30s → `email_messages.ai_summary` filled + memory chunk stored + assignee notified.
2. Each user gets a daily 7am brief on WhatsApp / email — pulled from real data, not generic.
3. Project insights surface automatically: "MG GT project at risk — no client reply in 7 days, deadline in 3 days".
4. "Ask Antagna" in any view streams back an answer in <3s using project-scoped memory.
5. AI cost dashboard shows spend per feature + alerts when soft caps approached.

---

## 3. The 6 AI Loops

| # | Loop | Trigger | Model | Cost ceiling/run | Output |
|---|------|---------|-------|------------------|--------|
| 1 | **Email parser** | New `email_messages` row | Sonnet 4.6 | $0.005 | summary, suggested action, parsed fields |
| 2 | **Brief parser** | New `briefs` row | Sonnet 4.6 | $0.02 | structured deliverables, missing fields, shoot date, languages, vehicles |
| 3 | **Project status analyst** | `projects.ai_analyzed_at IS NULL` (invalidated by triggers) | Sonnet 4.6 | $0.03 | status paragraph, risk level, next action |
| 4 | **Daily user brief** | Scheduled 7am Riyadh per user | Sonnet 4.6 | $0.05 | morning brief: "3 decisions needed, 2 projects at risk, 1 unread client message" |
| 5 | **Memory chunker** | Any new email/comment/meeting note | Haiku 4.5 | $0.0005 | chunked + embedded + stored in `ai_memory_chunks` |
| 6 | **Ask Antagna (chat)** | User typing in chat surface | Sonnet 4.6 + tool use | streaming | answers grounded in memory + DB |

Special / occasional:
- **Project plan generator** (Opus 4.6 — used rarely): heavy reasoning to draft full project plans from a brief.
- **Insight detector** (Haiku 4.5 — scheduled every 30 min): scans projects for risk patterns.
- **Compatibility inference** (Sonnet 4.6 — when admin requests): predict equipment compatibility from specs.

---

## 4. Memory Architecture

### 4.1 The 4 scopes

`ai_memory_chunks.scope`:
- `user` — per-person preferences, history, context
- `project` — everything happening in this project
- `client` — long-term knowledge across all projects with this client
- `company` — institutional knowledge (policies, templates, FAQ)

### 4.2 What goes into memory (source events)

| Event | Scope | Stored as |
|-------|-------|-----------|
| Inbound email | project (if anchored) + client | chunked thread |
| Outbound email | same | chunked thread |
| Meeting note (Gemini) | project | full note + extracted action items |
| Project comment | project | comment text |
| Brief received | project | full brief + parsed fields |
| Deliverable approved | project | "DLV-X approved by [contact] on [date]" |
| Invoice paid | client | "INV-X paid in N days" |
| Lead lost | client | "lost with reason: [...]" |
| Manual note typed by user | scope chosen | typed text |
| Company policy edit | company | new version |

### 4.3 Embedding

OpenAI `text-embedding-3-small` (1536 dims). Chunks 500-2000 tokens with 200-token overlap. Language detected and stored alongside.

### 4.4 Retrieval — hybrid

```typescript
// packages/ai/src/recall.ts
export async function recall(opts: {
  query: string;
  scopes: Array<{ scope: 'user' | 'project' | 'client' | 'company'; scopeId?: string }>;
  limit?: number;          // default 8
  recencyDays?: number;    // boost docs newer than this
}): Promise<MemoryChunk[]> {
  const queryEmbedding = await embed(opts.query);
  const limit = opts.limit ?? 8;

  // Hybrid: 70% weight on cosine, 30% on recency
  // SQL:
  //   SELECT *,
  //     0.7 * (1 - (embedding <=> $1)) AS sim_score,
  //     0.3 * EXP(-AGE(now(), created_at) / interval '30 days') AS recency_score,
  //     (0.7 * (1 - (embedding <=> $1)) + 0.3 * EXP(-AGE(...))) AS final_score
  //   FROM ai_memory_chunks
  //   WHERE (scope, scope_id) IN (...)
  //   ORDER BY final_score DESC
  //   LIMIT $2
  // ...
}
```

For company-wide knowledge (policies, FAQs), retrieval falls back to BM25 over `tsvector` indexed text — vector alone misses exact-keyword queries.

### 4.5 Memory hygiene

Trigger.dev weekly task `memory-prune`:
- Delete chunks tagged `transient` older than 90 days.
- Re-summarize project memory when project moves to `delivered` (collapse 1000 chunks into 30 high-signal ones).
- Mark chunks as "outdated" when entity is archived.

---

## 5. The Prompt Library

`packages/ai/src/prompts/*.ts`. Each prompt is a module exporting:

```typescript
export const PARSE_BRIEF_PROMPT = {
  key: "parse-brief",
  version: "v1.2",
  model: "sonnet-4-6" as const,
  systemPrompt: `You are an expert at parsing automotive content production briefs from Saudi Arabia... [4KB]`,
  // System prompt is cached — 90% cost reduction on repeat calls
  systemCacheControl: { type: "ephemeral" as const },
  schema: z.object({
    deliverables: z.array(z.object({ type: z.string(), count: z.number() })),
    shootDate: z.string().nullable(),
    locations: z.array(z.string()),
    languages: z.array(z.enum(["ar", "en"])),
    vehicles: z.array(z.string()),
    budgetSar: z.number().nullable(),
    usageRights: z.string().nullable(),
    completeness: z.number().min(0).max(100),
    missingFields: z.array(z.string()),
  }),
  example: { /* one-shot example */ },
};
```

Version is bumped on any prompt change. Code review enforces: new version = comment in PR explaining what changed.

---

## 6. Reactive Loop — Implementation

`apps/worker/src/trigger/ai-email-summary.ts`:

```typescript
import { task } from "@trigger.dev/sdk/v3";
import { callClaude } from "@antagna/ai";
import { db, emailMessages, aiMemoryChunks } from "@antagna/db";

export const summarizeEmail = task({
  id: "ai-email-summary",
  run: async (payload: { emailMessageId: string }) => {
    const msg = await db.query.emailMessages.findFirst({
      where: eq(emailMessages.id, payload.emailMessageId),
      with: { thread: { with: { project: true, client: true } } },
    });
    if (!msg) return { skipped: "not found" };

    // 1. Retrieve relevant memory
    const memory = await recall({
      query: msg.subject + "\n" + msg.snippet,
      scopes: [
        msg.thread.projectId && { scope: "project", scopeId: msg.thread.projectId },
        msg.thread.clientId && { scope: "client", scopeId: msg.thread.clientId },
      ].filter(Boolean),
      limit: 5,
    });

    // 2. Build prompt with memory context
    const result = await callClaude({
      userId: msg.sentByProfileId ?? null,
      feature: "email_summary",
      prompt: SUMMARIZE_EMAIL_PROMPT,
      variables: {
        message: msg.bodyText,
        thread_context: msg.thread.aiSummary ?? "(new thread)",
        memory_chunks: memory.map(m => m.content).join("\n\n"),
      },
    });

    // 3. Update message + thread
    await db.update(emailMessages).set({
      aiSummary: result.summary,
      aiSuggestedActions: result.actions,
    }).where(eq(emailMessages.id, msg.id));

    // 4. Add to memory
    await embedAndStore({
      scope: msg.thread.projectId ? "project" : "client",
      scopeId: msg.thread.projectId ?? msg.thread.clientId,
      source: "email",
      sourceId: msg.id,
      content: `[${msg.direction}] ${msg.subject}\n${msg.bodyText.slice(0, 4000)}`,
    });

    // 5. Update thread summary if old
    if (msg.thread.aiSummaryUpdatedAt < Date.now() - 24 * 3600 * 1000) {
      await summarizeThread.trigger({ threadId: msg.threadId });
    }

    return { summarized: true };
  },
});
```

---

## 7. Daily User Brief — Implementation

`apps/worker/src/trigger/ai-daily-brief.ts`:

```typescript
export const dailyUserBrief = task({
  id: "ai-daily-brief",
  run: async (payload: { profileId: string }) => {
    const profile = await db.query.profiles.findFirst({ where: eq(profiles.id, payload.profileId) });

    // Gather user-relevant data — last 24h activity
    const data = await Promise.all([
      db.query.projectAssignments.findMany({ where: eq(projectAssignments.profileId, profile.id), with: { project: true } }),
      db.query.projectTasks.findMany({
        where: and(
          eq(projectTasks.assigneeId, profile.id),
          inArray(projectTasks.status, ["pending", "in_progress"])
        ),
      }),
      db.query.emailMessages.findMany({
        where: and(eq(emailMessages.sentByProfileId, null), gt(emailMessages.sentAt, subDays(new Date(), 1))),
      }),
      // ... etc
    ]);

    const result = await callClaude({
      userId: profile.id,
      feature: "daily_brief",
      prompt: DAILY_BRIEF_PROMPT,
      variables: {
        user_name: profile.displayName,
        assigned_projects: data[0],
        open_tasks: data[1],
        recent_emails: data[2],
        current_date: new Date().toISOString(),
        memory_pull: await recall({ query: "today's priorities", scopes: [{ scope: "user", scopeId: profile.id }], limit: 5 }),
      },
    });

    await db.insert(dailyBriefs).values({
      profileId: profile.id,
      briefDate: today(),
      content: result.brief,
      highlights: result.highlights,
    });

    // Notify via in_app + email
    await notify({ profileId: profile.id, eventKey: "ai.daily_brief_ready", title: "Your daily brief is ready", linkUrl: "/app/me/brief" });
  },
  schedules: [{ cron: "0 7 * * *", timezone: "Asia/Riyadh" }],
  // Note: actual implementation fans out per active profile
});
```

### `daily_briefs` table

```typescript
export const dailyBriefs = pgTable("daily_briefs", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id").notNull().references(() => profiles.id),
  briefDate: text("brief_date").notNull(),
  content: text("content").notNull(),
  highlights: jsonb("highlights"),                          // structured: { decisions_needed, at_risk_projects, ... }
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  readAt: timestamp("read_at", { withTimezone: true }),
}, (t) => ({ uniqueDaily: unique().on(t.profileId, t.briefDate) }));
```

---

## 8. Project Insights — Pattern Detection

`apps/worker/src/trigger/ai-insights-scanner.ts` (runs every 30 min):

```typescript
export const insightsScanner = task({
  id: "ai-insights-scanner",
  schedules: [{ cron: "*/30 * * * *" }],
  run: async () => {
    const projects = await db.query.projects.findMany({
      where: and(notInArray(projects.stage, ["delivered", "archived", "lost", "cancelled"])),
    });

    for (const project of projects) {
      // Cheap pre-checks (no AI):
      const stalled = isStalled(project);                                       // no activity 7+ days
      const dueSoon = project.deliveryDueAt < addDays(new Date(), 3);
      const clientNoReply = await daysSinceLastClientReply(project.id) > 5;

      if (!stalled && !dueSoon && !clientNoReply) continue;                       // skip happy path

      // Pre-detected → ask AI for human-readable insight
      const insight = await callClaude({
        userId: null,
        feature: "project_insight",
        prompt: PROJECT_INSIGHT_PROMPT,
        variables: { project, signals: { stalled, dueSoon, clientNoReply } },
      });

      await db.insert(projectInsights).values({
        projectId: project.id,
        insightType: insight.type,
        severity: insight.severity,
        titleAr: insight.titleAr,
        bodyAr: insight.bodyAr,
        suggestedActions: insight.actions,
      });
    }
  },
});
```

### `project_insights` table

```typescript
export const projectInsights = pgTable("project_insights", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  insightType: text("insight_type").notNull(),               // 'stalled', 'due_soon', 'no_client_reply', 'budget_risk'
  severity: text("severity").notNull(),                      // 'low' | 'medium' | 'high'
  titleAr: text("title_ar").notNull(),
  bodyAr: text("body_ar"),
  suggestedActions: jsonb("suggested_actions"),
  dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
  dismissedById: uuid("dismissed_by_id").references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

---

## 9. Ask Antagna — Conversational Surface

A floating chat button (Cmd+K) in every view. User types: "what's the status of MG GT?" — UI calls `/api/ask` with streaming response.

Server:
1. Detect scope from current page context (current project? client?).
2. Retrieve memory (top 10 chunks).
3. Build prompt with tools available (MCP-style):
   - `get_project_status(project_id)`
   - `get_client_summary(client_id)`
   - `list_recent_emails(thread_id)`
4. Stream Sonnet 4.6 response with tool use.
5. Render in UI with tool calls visible.

---

## 10. Cost Tracking & Quality

### 10.1 Cost ledger (extends Pillar 1's `ai_usage`)

Already in place. Pillar 10 adds:
- `cost_per_feature_view` (materialized view, refreshed hourly).
- `cost_per_user_view` (same).
- Soft cap warnings via `task("ai-cost-monitor")` (hourly).

### 10.2 Quality signal

When the AI's suggested action is taken vs ignored, log it:

```typescript
export const aiActionLog = pgTable("ai_action_log", {
  id: bigserial("id").primaryKey(),
  aiUsageId: bigint("ai_usage_id"),                          // optional FK to original AI call
  feature: text("feature").notNull(),
  outcome: text("outcome").notNull(),                        // 'accepted', 'rejected', 'edited', 'ignored'
  userId: uuid("user_id").references(() => profiles.id),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

Lets us measure: "AI brief parser had 87% acceptance rate last month" → know which prompts to improve.

---

## 11. Acceptance Checklist

- [ ] All Pillar 10 schemas + RLS.
- [ ] Prompt library scaffolded with at least 6 prompts (one per loop in §3).
- [ ] `recall()` function implemented + tested with sample memory.
- [ ] Email summarization task end-to-end: insert email → summary populated within 30s.
- [ ] Daily brief task: triggers manually for 1 user → row in `daily_briefs` + notification.
- [ ] Insights scanner: insert a stalled test project → insight row appears.
- [ ] Ask Antagna: send test question, streamed response returned with at least one tool call.
- [ ] Cost dashboard query returns per-feature breakdown.
- [ ] Quality log: simulate accept + reject events; views compute acceptance rate.
- [ ] Memory hygiene: chunks tagged transient + older than 90d → pruned by weekly task.

---

## 12. Deferred

- **Voice input** (whisper transcription) → Phase 2.
- **Multi-modal (image-in-brief parsing)** → Phase 2.
- **Fine-tuning** (we won't; prompt caching + memory + Sonnet is enough).
- **AI agent for full project execution** (the next horizon — Antagna runs projects itself with human approvals).

---

## 13. Next: Pillar 11 — Automation & Alerts Engine
