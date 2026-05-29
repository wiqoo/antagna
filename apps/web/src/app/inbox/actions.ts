'use server';

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { db, withActor } from '@antagna/db';
import { requirePermissionAction, canMany } from '@/lib/authz';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getAnthropic, ANTHROPIC_MODELS, recordUsage, retrieveMemory } from '@antagna/ai';

const rows = <T,>(r: unknown): T[] => r as unknown as T[];

/** Either inbox read permission lets you triage/manage threads. */
const INBOX_PERMS = ['email_threads.read.all', 'email_threads.read.assigned'] as const;

async function requireInboxActor(): Promise<string> {
  // Gate on read.all OR read.assigned (the two seeded comms perms) in ONE
  // round-trip, then resolve the actor id via the key that actually passed.
  // requirePermissionAction throws the standard ForbiddenError when neither holds.
  const perms = await canMany([...INBOX_PERMS]);
  const grantedKey = perms['email_threads.read.all']
    ? 'email_threads.read.all'
    : perms['email_threads.read.assigned']
      ? 'email_threads.read.assigned'
      : 'email_threads.read.all'; // none granted → triggers ForbiddenError below
  return requirePermissionAction(grantedKey);
}

// Long system prompts go behind Anthropic prompt-caching breakpoints — first
// call pays full input, every subsequent call within 5 min reads the cached
// block at 10% the cost (per the public pricing). This is the FIRST place
// in Antagna to actually use prompt caching, addressing Mohammed's audit.
const SUMMARIZE_SYSTEM = `أنت محلِّل بريد إلكتروني لشركة إنتاج فيديو سعودية اسمها "Volt Production".
تقرأ سلسلة رسائل (محادثة كاملة) وتُخرج JSON صارم بالشكل:
{
  "summary_ar": "ملخص سردي قصير 2-4 جُمل بالعربية الفصحى البسيطة، يلتقط: مَن، ماذا يريد، أين وقفنا، أهم رقم/تاريخ ذُكر",
  "topic_tags": ["تاج1", "تاج2", "تاج3"],
  "needs_reply": true,
  "urgency": "low" | "medium" | "high"
}
قواعد:
- اكتب بالعربية الفصحى. لا عامية، لا إيموجي.
- لا تختلق معلومات: لو لا تعرف، اتركها.
- topic_tags: 2-5 كلمات قصيرة (مثل: "اعتماد"، "تسعير"، "موعد تصوير"، "متابعة").
- urgency: high لو فيه deadline خلال 24-48 ساعة أو غضب من العميل، medium لو متوسط، low افتراضي.`;

const NEXT_ACTIONS_SYSTEM = `أنت مساعد عمليات في شركة إنتاج فيديو "Volt Production".
بناءً على المحادثة + ذاكرة الشركة، تُخرج JSON صارم:
{ "actions": ["خطوة 1 موجَّهة وملموسة بصيغة الأمر", "خطوة 2", "خطوة 3"] }
قواعد:
- الإجابة JSON فقط، بدون أي نص خارج البنية.
- 3-5 خطوات فقط.
- كل خطوة جملة فعلية واضحة (مثلاً: "أرسل عرض سعر مبدئي بـ 35,000 ر.س للموعد المقترح").
- لا تكرّر شيئاً قاله الشخص فعلاً؛ اقترح الخطوة التالية الذكية.
- اعتمد على ذاكرة الشركة إن وُجدت لتقديم خطوة مخصَّصة.`;

type Msg = {
  direction: string;
  fromEmail: string;
  fromName: string | null;
  subject: string | null;
  bodyText: string | null;
  snippet: string | null;
  sentAt: string;
};

async function loadThreadForAI(threadId: string) {
  const [tR, mR] = await Promise.all([
    db.execute(sql`
      SELECT subject, ai_summary AS "aiSummary", client_id::text AS "clientId"
      FROM email_threads WHERE id = ${threadId}::uuid LIMIT 1`),
    db.execute(sql`
      SELECT direction, from_email AS "fromEmail", from_name AS "fromName",
             subject, body_text AS "bodyText", snippet, sent_at AS "sentAt"
      FROM email_messages WHERE thread_id = ${threadId}::uuid
      ORDER BY sent_at ASC LIMIT 30`),
  ]);
  const t = rows<{ subject: string | null; aiSummary: string | null; clientId: string | null }>(tR)[0];
  const messages = rows<Msg>(mR);
  return { thread: t, messages };
}

function conversationText(subject: string | null, messages: Msg[]): string {
  const lines: string[] = [];
  if (subject) lines.push(`الموضوع: ${subject}`);
  for (const m of messages) {
    const who = m.direction === 'outbound' ? '— نحن' : `— ${m.fromName || m.fromEmail}`;
    const stamp = m.sentAt ? new Date(m.sentAt).toISOString().slice(0, 16).replace('T', ' ') : '';
    lines.push(`\n[${stamp}] ${who}:`);
    lines.push((m.bodyText || m.snippet || '').slice(0, 2000));
  }
  return lines.join('\n');
}

/** Summarize a single email thread. Updates ai_summary + ai_topic_tags. */
export async function summarizeThreadAction(threadId: string): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { thread, messages } = await loadThreadForAI(threadId);
  if (!thread || messages.length === 0) return;
  const convo = conversationText(thread.subject, messages);

  let parsed: { summary_ar?: string; topic_tags?: string[]; urgency?: string } = {};
  try {
    const client = getAnthropic();
    const resp = await client.messages.create({
      model: ANTHROPIC_MODELS.sonnet,
      max_tokens: 600,
      // System block split: stable preamble (long) gets cached; the dynamic
      // conversation slot is the user message.
      // `cache_control` is accepted by the API but the 0.32 SDK type defs
      // don't expose it yet — `as any` keeps us on the prompt-caching path.
      system: [
        {
          type: 'text',
          text: SUMMARIZE_SYSTEM,
          cache_control: { type: 'ephemeral' },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any,
      messages: [
        { role: 'user', content: `هذه المحادثة:\n\n${convo}\n\nأخرج الـ JSON فقط.` },
      ],
    });
    await recordUsage({ feature: 'email_thread_summary', model: ANTHROPIC_MODELS.sonnet, inputTokens: resp.usage.input_tokens ?? 0, outputTokens: resp.usage.output_tokens ?? 0, cacheReadTokens: (resp.usage as { cache_read_input_tokens?: number }).cache_read_input_tokens ?? 0, cacheWriteTokens: (resp.usage as { cache_creation_input_tokens?: number }).cache_creation_input_tokens ?? 0 });
    const txt = resp.content.find((b) => b.type === 'text');
    if (txt && txt.type === 'text') {
      const raw = txt.text
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
      parsed = JSON.parse(raw);
    }
  } catch (e) {
    console.error('[summarizeThreadAction]', e);
    return;
  }

  const summary = String(parsed.summary_ar ?? '').slice(0, 1200);
  const tags = Array.isArray(parsed.topic_tags)
    ? parsed.topic_tags.map((t) => String(t).slice(0, 40)).slice(0, 6)
    : [];

  if (!summary) return;
  await db.execute(sql`
    UPDATE email_threads
    SET ai_summary = ${summary},
        ai_summary_updated_at = now(),
        ai_topic_tags = ${tags}::text[]
    WHERE id = ${threadId}::uuid
  `);
  revalidatePath(`/inbox/${threadId}`);
  revalidatePath('/inbox');
}

/** Generate "what should we do next" suggestions for the latest inbound. */
export async function generateNextActionsAction(threadId: string): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { thread, messages } = await loadThreadForAI(threadId);
  if (!thread || messages.length === 0) return;

  // Pull related memory (past similar threads with this client / topic).
  let memoryContext = '';
  try {
    const queryStr =
      `${thread.subject ?? ''}\n${messages[messages.length - 1]?.bodyText?.slice(0, 200) ?? ''}`;
    const chunks = await retrieveMemory({
      query: queryStr,
      scope: thread.clientId ? 'client' : undefined,
      scopeId: thread.clientId ?? undefined,
      limit: 5,
    });
    if (chunks.length > 0) {
      memoryContext = chunks
        .map((c, i) => `${i + 1}. ${(c.content ?? '').slice(0, 300)}`)
        .join('\n');
    }
  } catch (e) {
    // Memory retrieval is best-effort.
    console.error('[generateNextActionsAction memory]', e);
  }

  const convo = conversationText(thread.subject, messages);

  let actions: string[] = [];
  try {
    const client = getAnthropic();
    const resp = await client.messages.create({
      model: ANTHROPIC_MODELS.sonnet,
      max_tokens: 500,
      system: [
        {
          type: 'text',
          text: NEXT_ACTIONS_SYSTEM,
          cache_control: { type: 'ephemeral' },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any,
      messages: [
        {
          role: 'user',
          content:
            `المحادثة:\n${convo}\n\n` +
            (memoryContext
              ? `ذاكرة ذات صلة من تعاملاتنا السابقة:\n${memoryContext}\n\n`
              : '') +
            `أخرج JSON فقط.`,
        },
      ],
    });
    await recordUsage({ feature: 'email_thread_next_actions', model: ANTHROPIC_MODELS.sonnet, inputTokens: resp.usage.input_tokens ?? 0, outputTokens: resp.usage.output_tokens ?? 0, cacheReadTokens: (resp.usage as { cache_read_input_tokens?: number }).cache_read_input_tokens ?? 0, cacheWriteTokens: (resp.usage as { cache_creation_input_tokens?: number }).cache_creation_input_tokens ?? 0 });
    const txt = resp.content.find((b) => b.type === 'text');
    if (txt && txt.type === 'text') {
      const raw = txt.text
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
      const parsed = JSON.parse(raw) as { actions?: unknown };
      if (Array.isArray(parsed.actions)) {
        actions = parsed.actions.map((s) => String(s).slice(0, 240)).slice(0, 6);
      }
    }
  } catch (e) {
    console.error('[generateNextActionsAction]', e);
    return;
  }

  if (actions.length === 0) return;
  // Attach actions to the LATEST message so the thread page can surface them.
  await db.execute(sql`
    UPDATE email_messages
    SET ai_suggested_actions = ${JSON.stringify(actions)}::jsonb
    WHERE id = (
      SELECT id FROM email_messages
      WHERE thread_id = ${threadId}::uuid
      ORDER BY sent_at DESC LIMIT 1
    )
  `);
  revalidatePath(`/inbox/${threadId}`);
}

// ── AI triage / classification ───────────────────────────────────────────────

const CATEGORIES = ['actionable', 'marketing', 'newsletter', 'spam', 'notification'] as const;
const IMPORTANCES = ['low', 'medium', 'high'] as const;
type Category = (typeof CATEGORIES)[number];
type Importance = (typeof IMPORTANCES)[number];

// Classification runs on the cheap/fast model (Haiku) — it's a high-volume
// background-ish task and the system prompt is the bulk of the input, so it
// sits behind a prompt-cache breakpoint (10% cost on every call within 5 min).
const CLASSIFY_SYSTEM = `أنت مُصنِّف بريد إلكتروني لشركة إنتاج فيديو سعودية اسمها "Volt Production".
تقرأ بريداً (المُرسِل + الموضوع + مقتطف) وتُصنِّفه لتنظيف صندوق الوارد من الضجيج.
أخرج JSON صارم فقط بالشكل:
{ "category": "actionable" | "marketing" | "newsletter" | "spam" | "notification",
  "importance": "low" | "medium" | "high",
  "reason_ar": "سبب قصير جداً بالعربية (أقل من ١٠ كلمات)" }

تعريف الفئات:
- actionable: بريد حقيقي من عميل/مورّد/زميل يحتاج قراءة أو ردّاً أو متابعة (طلب، اعتماد، تسعير، موعد، استفسار، عقد).
- marketing: عروض ترويجية، إعلانات، حملات بيع، رسائل تسويقية من شركات.
- newsletter: نشرات بريدية دورية، تحديثات منتجات، مدوّنات، اشتراكات إخبارية.
- notification: إشعارات آلية لا تحتاج ردّاً (تنبيهات أنظمة، إيصالات، تأكيدات تلقائية، فواتير أنظمة، Google/GitHub/Slack).
- spam: بريد مزعج، احتيال، تصيّد، رسائل غير مرغوبة بالكامل.

قواعد:
- إن كان البريد من شخص حقيقي يطلب شيئاً متعلقاً بالعمل → actionable.
- importance: high لو فيه عميل غاضب أو deadline قريب أو مبلغ كبير، medium لو متابعة عادية مهمة، low للباقي.
- لغير الـ actionable اجعل importance = low غالباً.
- الإجابة JSON فقط، بدون أي نص خارج البنية.`;

/** A thread is "noise" (hidden by default) when classified as one of these. */
const NOISE_CATEGORIES: Category[] = ['marketing', 'newsletter', 'spam'];

function coerceCategory(v: unknown): Category {
  const s = String(v ?? '').toLowerCase().trim();
  return (CATEGORIES as readonly string[]).includes(s) ? (s as Category) : 'actionable';
}
function coerceImportance(v: unknown): Importance {
  const s = String(v ?? '').toLowerCase().trim();
  return (IMPORTANCES as readonly string[]).includes(s) ? (s as Importance) : 'low';
}

async function loadThreadHeaderForClassify(threadId: string) {
  const r = await db.execute(sql`
    SELECT et.subject AS "subject", et.status::text AS "status",
           m.from_email AS "fromEmail", m.from_name AS "fromName",
           COALESCE(m.snippet, left(m.body_text, 600)) AS "snippet"
    FROM email_threads et
    LEFT JOIN LATERAL (
      SELECT from_email, from_name, snippet, body_text
      FROM email_messages
      WHERE thread_id = et.id AND direction = 'inbound'
      ORDER BY sent_at DESC LIMIT 1
    ) m ON true
    WHERE et.id = ${threadId}::uuid
    LIMIT 1`);
  return rows<{
    subject: string | null;
    status: string;
    fromEmail: string | null;
    fromName: string | null;
    snippet: string | null;
  }>(r)[0];
}

async function runClassifier(input: {
  subject: string | null;
  fromEmail: string | null;
  fromName: string | null;
  snippet: string | null;
}): Promise<{ category: Category; importance: Importance } | null> {
  const userMsg =
    `المُرسِل: ${input.fromName || ''} <${input.fromEmail || 'unknown'}>\n` +
    `الموضوع: ${input.subject || '(بدون عنوان)'}\n` +
    `مقتطف: ${(input.snippet || '').slice(0, 600)}\n\n` +
    `صنِّف البريد. أخرج JSON فقط.`;

  const client = getAnthropic();
  const resp = await client.messages.create({
    model: ANTHROPIC_MODELS.haiku,
    max_tokens: 150,
    system: [
      {
        type: 'text',
        text: CLASSIFY_SYSTEM,
        cache_control: { type: 'ephemeral' },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any,
    messages: [{ role: 'user', content: userMsg }],
  });
  await recordUsage({
    feature: 'email_thread_classify',
    model: ANTHROPIC_MODELS.haiku,
    inputTokens: resp.usage.input_tokens ?? 0,
    outputTokens: resp.usage.output_tokens ?? 0,
    cacheReadTokens: (resp.usage as { cache_read_input_tokens?: number }).cache_read_input_tokens ?? 0,
    cacheWriteTokens:
      (resp.usage as { cache_creation_input_tokens?: number }).cache_creation_input_tokens ?? 0,
  });
  const txt = resp.content.find((b) => b.type === 'text');
  if (!txt || txt.type !== 'text') return null;
  const raw = txt.text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  const parsed = JSON.parse(raw) as { category?: unknown; importance?: unknown };
  return {
    category: coerceCategory(parsed.category),
    importance: coerceImportance(parsed.importance),
  };
}

/**
 * Persist a classification. For noise (spam/marketing/newsletter) we ALSO set
 * status='spam' so the existing status filters hide it; but we keep the precise
 * `category` so the inbox can show "marketing" vs "spam" distinctly. We never
 * downgrade a human-set terminal status (closed) on re-classify.
 */
async function persistClassification(
  actorId: string,
  threadId: string,
  category: Category,
  importance: Importance,
  status: string,
): Promise<void> {
  const shouldSpamStatus = NOISE_CATEGORIES.includes(category);
  await withActor(actorId, (tx) =>
    tx.execute(sql`
      UPDATE email_threads
      SET category = ${category},
          importance = ${importance},
          ai_classified_at = now(),
          status = CASE
            WHEN ${shouldSpamStatus} AND status NOT IN ('closed') THEN 'spam'
            ELSE status
          END,
          updated_at = now()
      WHERE id = ${threadId}::uuid
    `),
  );
}

/** Classify a single thread. Returns the result (or null on failure). */
export async function classifyThread(
  threadId: string,
): Promise<{ category: Category; importance: Importance } | null> {
  const actorId = await requireInboxActor();
  const header = await loadThreadHeaderForClassify(threadId);
  if (!header) return null;

  let result: { category: Category; importance: Importance } | null = null;
  try {
    result = await runClassifier(header);
  } catch (e) {
    console.error('[classifyThread]', e);
    return null;
  }
  if (!result) return null;

  await persistClassification(actorId, threadId, result.category, result.importance, header.status);
  revalidatePath('/inbox');
  revalidatePath(`/inbox/${threadId}`);
  return result;
}

/** Void-returning wrapper so the thread detail page can bind it to `<form action>`. */
export async function classifyThreadFormAction(threadId: string): Promise<void> {
  await classifyThread(threadId);
}

/**
 * Batch-classify the inbox. Picks the N most recent UN-classified threads
 * (ai_classified_at IS NULL), classifies each, and persists. Bounded + sequential
 * to stay inside the cost guard; the shared prompt cache makes the per-call input
 * cheap. Returns a small summary for the toast.
 */
export async function classifyInboxAction(
  limit = 25,
): Promise<{ classified: number; hidden: number }> {
  const actorId = await requireInboxActor();
  const safeLimit = Math.min(Math.max(1, limit), 40);

  const pending = rows<{ id: string; status: string }>(
    await db.execute(sql`
      SELECT id::text AS id, status::text AS status
      FROM email_threads
      WHERE ai_classified_at IS NULL AND status <> 'closed'
      ORDER BY last_message_at DESC NULLS LAST
      LIMIT ${safeLimit}
    `),
  );

  let classified = 0;
  let hidden = 0;
  for (const t of pending) {
    const header = await loadThreadHeaderForClassify(t.id);
    if (!header) continue;
    let result: { category: Category; importance: Importance } | null = null;
    try {
      result = await runClassifier(header);
    } catch (e) {
      console.error('[classifyInboxAction]', t.id, e);
      continue;
    }
    if (!result) continue;
    await persistClassification(actorId, t.id, result.category, result.importance, header.status);
    classified += 1;
    if (NOISE_CATEGORIES.includes(result.category)) hidden += 1;
  }

  revalidatePath('/inbox');
  return { classified, hidden };
}

// ── bulk thread actions (gated via withActor) ────────────────────────────────

function uuidArray(ids: string[]) {
  // Per repo convention: build an array literal from per-id sql fragments,
  // never a raw JS array + ::uuid[] (drizzle would expand it into a comma list).
  return sql`ARRAY[${sql.join(
    ids.map((id) => sql`${id}::uuid`),
    sql`, `,
  )}]::uuid[]`;
}

/** Mark the given threads as spam (category=spam, status=spam). */
export async function markThreadsSpam(threadIds: string[]): Promise<{ updated: number }> {
  const actorId = await requireInboxActor();
  const ids = threadIds.filter(Boolean);
  if (ids.length === 0) return { updated: 0 };
  await withActor(actorId, (tx) =>
    tx.execute(sql`
      UPDATE email_threads
      SET status = 'spam',
          category = 'spam',
          ai_classified_at = COALESCE(ai_classified_at, now()),
          updated_at = now()
      WHERE id = ANY(${uuidArray(ids)})
    `),
  );
  revalidatePath('/inbox');
  return { updated: ids.length };
}

/** Archive (close) the given threads. */
export async function archiveThreads(threadIds: string[]): Promise<{ updated: number }> {
  const actorId = await requireInboxActor();
  const ids = threadIds.filter(Boolean);
  if (ids.length === 0) return { updated: 0 };
  await withActor(actorId, (tx) =>
    tx.execute(sql`
      UPDATE email_threads
      SET status = 'closed', updated_at = now()
      WHERE id = ANY(${uuidArray(ids)})
    `),
  );
  revalidatePath('/inbox');
  return { updated: ids.length };
}

/**
 * "Mark read" → move open/in_progress threads to waiting_client (the closest
 * existing status that means "I've seen it, ball is in their court"). No
 * dedicated read flag exists on the schema, so this is the pragmatic mapping.
 */
export async function markThreadsRead(threadIds: string[]): Promise<{ updated: number }> {
  const actorId = await requireInboxActor();
  const ids = threadIds.filter(Boolean);
  if (ids.length === 0) return { updated: 0 };
  await withActor(actorId, (tx) =>
    tx.execute(sql`
      UPDATE email_threads
      SET status = 'waiting_client', updated_at = now()
      WHERE id = ANY(${uuidArray(ids)})
        AND status IN ('open', 'in_progress')
    `),
  );
  revalidatePath('/inbox');
  return { updated: ids.length };
}

/** Re-open (un-spam / un-archive) the given threads → status='open'. */
export async function reopenThreads(threadIds: string[]): Promise<{ updated: number }> {
  const actorId = await requireInboxActor();
  const ids = threadIds.filter(Boolean);
  if (ids.length === 0) return { updated: 0 };
  await withActor(actorId, (tx) =>
    tx.execute(sql`
      UPDATE email_threads
      SET status = 'open',
          category = CASE WHEN category IN ('spam','marketing','newsletter') THEN 'actionable' ELSE category END,
          updated_at = now()
      WHERE id = ANY(${uuidArray(ids)})
    `),
  );
  revalidatePath('/inbox');
  return { updated: ids.length };
}
