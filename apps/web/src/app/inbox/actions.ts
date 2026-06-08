'use server';

import { revalidatePath } from 'next/cache';
import { isNull, sql } from 'drizzle-orm';
import { db, withActor, googleIntegrations } from '@antagna/db';
import { requirePermissionAction, canMany, getEffectiveProfileId } from '@/lib/authz';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getAnthropic, ANTHROPIC_MODELS, recordUsage, retrieveMemory, indexMemory, assertAiBudget } from '@antagna/ai';
import { ingestGmail, SYSTEM_MAILBOX } from '@/lib/gmail-ingest';

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
- اقرأ المحادثة **كاملة** (كل الرسائل) + **نص المرفقات** المرفقة + **توقيع** كل رسالة (الاسم والشركة والمسمّى الوظيفي في آخر الإيميل) لتفهم بدقة مَن العميل ومَن جهة الاتصال.
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
  id: string;
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
      SELECT id::text AS id, direction, from_email AS "fromEmail", from_name AS "fromName",
             subject, body_text AS "bodyText", snippet, sent_at AS "sentAt"
      FROM email_messages WHERE thread_id = ${threadId}::uuid
      ORDER BY sent_at ASC LIMIT 30`),
  ]);
  const t = rows<{ subject: string | null; aiSummary: string | null; clientId: string | null }>(tR)[0];
  const messages = rows<Msg>(mR);

  // Attachment text per message — the intel pipeline already parses PDFs/docs
  // into email_attachments.extracted_text. Pull it so the AI reads the
  // ATTACHMENTS too (scope/budget/contracts often live there), not just the
  // email body. One batch query for the whole thread (no N+1).
  const attachmentsByMsg = new Map<string, string>();
  if (messages.length > 0) {
    const aR = await db.execute(sql`
      SELECT a.message_id::text AS "messageId", a.filename AS "filename",
             a.extracted_text AS "text"
      FROM email_attachments a
      JOIN email_messages m ON m.id = a.message_id
      WHERE m.thread_id = ${threadId}::uuid
        AND a.extracted_text IS NOT NULL AND length(a.extracted_text) > 0
      ORDER BY m.sent_at ASC`);
    for (const r of rows<{ messageId: string; filename: string | null; text: string | null }>(aR)) {
      const piece = `[مرفق: ${r.filename ?? 'ملف'}]\n${(r.text ?? '').slice(0, 8000)}`;
      const prev = attachmentsByMsg.get(r.messageId);
      attachmentsByMsg.set(r.messageId, prev ? `${prev}\n\n${piece}` : piece);
    }
  }
  return { thread: t, messages, attachmentsByMsg };
}

function conversationText(
  subject: string | null,
  messages: Msg[],
  attachmentsByMsg?: Map<string, string>,
): string {
  const lines: string[] = [];
  if (subject) lines.push(`الموضوع: ${subject}`);
  for (const m of messages) {
    const who = m.direction === 'outbound' ? '— نحن' : `— ${m.fromName || m.fromEmail}`;
    const stamp = m.sentAt ? new Date(m.sentAt).toISOString().slice(0, 16).replace('T', ' ') : '';
    lines.push(`\n[${stamp}] ${who}:`);
    // Keep up to 4000 chars per message so the SIGNATURE block (which sits at
    // the very end of an email) survives — the AI uses it to identify the
    // sender's real name, company and role.
    lines.push((m.bodyText || m.snippet || '').slice(0, 4000));
    const att = attachmentsByMsg?.get(m.id);
    if (att) {
      lines.push('   ▼ مرفقات هذه الرسالة:');
      lines.push(att.slice(0, 10_000));
    }
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

  const { thread, messages, attachmentsByMsg } = await loadThreadForAI(threadId);
  if (!thread || messages.length === 0) return;
  const convo = conversationText(thread.subject, messages, attachmentsByMsg);

  const actorId = await getEffectiveProfileId();
  await assertAiBudget({ userId: actorId, feature: 'email_thread_summary' });

  // Brain: pull client history so the summary reflects the relationship.
  let memNote = '';
  if (thread.clientId) {
    try {
      const hits = await retrieveMemory({ query: thread.subject ?? '', scope: 'client', scopeId: thread.clientId, limit: 3, minSimilarity: 0.2 });
      if (hits.length) memNote = `\n\n[ذاكرة العميل]\n${hits.map((h) => `• ${h.content.slice(0, 200)}`).join('\n')}`;
    } catch {
      /* brain optional */
    }
  }

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
        { role: 'user', content: `هذه المحادثة:\n\n${convo}${memNote}\n\nأخرج الـ JSON فقط.` },
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
  // Brain write-back: store the thread summary scoped to the client.
  if (thread.clientId) {
    indexMemory({
      scope: 'client',
      scopeId: thread.clientId,
      source: 'email_thread_summary',
      sourceId: threadId,
      content: `${thread.subject ? thread.subject + ': ' : ''}${summary}`,
      contentLang: 'ar',
    }).catch(() => {});
  }
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

  const { thread, messages, attachmentsByMsg } = await loadThreadForAI(threadId);
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

  const convo = conversationText(thread.subject, messages, attachmentsByMsg);

  const actorId = await getEffectiveProfileId();
  await assertAiBudget({ userId: actorId, feature: 'email_thread_next_actions' });

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
- إذا وُجدت إشارة أن المحادثة مربوطة بعميل معروف أو أننا رددنا عليها من قبل → فهي محادثة حقيقية، صنِّفها actionable ولا تعتبرها ضجيجاً أبداً.
- عند الشك بين actionable وأي فئة ضجيج (marketing/newsletter/spam) → اختر actionable (الأسوأ أن نخفي بريد عميل حقيقي).
- importance: high لو فيه عميل غاضب أو deadline قريب أو مبلغ كبير، medium لو متابعة عادية مهمة، low للباقي.
- لغير الـ actionable اجعل importance = low غالباً.
- دقّة المرسِل: لو المُرسِل no-reply@ / noreply@ / notifications@ / mailer@ / bounce@ أو نطاق منصّة إرسال جماعي (mailchimp, sendgrid, substack, hubspot, mailerlite) → غالباً notification أو newsletter أو marketing وليس actionable — إلا إذا كان واضحاً أنه متعلق بمشروع/عميل حقيقي.
- لا تجعل البريد actionable إلا إذا كان فيه طلب أو سؤال أو متابعة حقيقية من إنسان تخصّ عمل Volt. التهاني العامة والاشتراكات والترويج ليست actionable.
- الإجابة JSON فقط، بدون أي نص خارج البنية.`;

/** A thread is "noise" (hidden by default) when classified as one of these. */
const NOISE_CATEGORIES: Category[] = ['marketing', 'newsletter', 'spam'];

/**
 * Hard safety net: a thread linked to a known client OR one we've already
 * replied to is a real conversation — never let the model bury it as noise.
 * Promotes any noise verdict back to 'actionable' (importance kept).
 */
function guardRealConversation(
  result: { category: Category; importance: Importance },
  clientId: string | null,
  hasOutbound: boolean,
): { category: Category; importance: Importance } {
  if ((clientId || hasOutbound) && NOISE_CATEGORIES.includes(result.category)) {
    return { category: 'actionable', importance: result.importance };
  }
  return result;
}

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
           et.client_id::text AS "clientId",
           EXISTS (
             SELECT 1 FROM email_messages om
             WHERE om.thread_id = et.id AND om.direction = 'outbound'
           ) AS "hasOutbound",
           m.from_email AS "fromEmail", m.from_name AS "fromName",
           COALESCE(left(m.body_text, 1500), m.snippet) AS "snippet"
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
    clientId: string | null;
    hasOutbound: boolean;
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
  linkedToClient?: boolean;
  repliedBefore?: boolean;
}): Promise<{ category: Category; importance: Importance } | null> {
  // Strong real-conversation signals the model should weigh heavily.
  const signals: string[] = [];
  if (input.linkedToClient) signals.push('هذه المحادثة مربوطة بعميل معروف لدينا.');
  if (input.repliedBefore) signals.push('سبق أن رددنا في هذه المحادثة.');

  const userMsg =
    `المُرسِل: ${input.fromName || ''} <${input.fromEmail || 'unknown'}>\n` +
    `الموضوع: ${input.subject || '(بدون عنوان)'}\n` +
    `نص الرسالة (مع التوقيع): ${(input.snippet || '').slice(0, 1500)}\n` +
    (signals.length ? `إشارات: ${signals.join(' ')}\n` : '') +
    `\nصنِّف البريد. أخرج JSON فقط.`;

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
  await assertAiBudget({ userId: actorId, feature: 'email_thread_classify' });
  const header = await loadThreadHeaderForClassify(threadId);
  if (!header) return null;

  let result: { category: Category; importance: Importance } | null = null;
  try {
    result = await runClassifier({
      ...header,
      linkedToClient: !!header.clientId,
      repliedBefore: header.hasOutbound,
    });
  } catch (e) {
    console.error('[classifyThread]', e);
    return null;
  }
  if (!result) return null;
  result = guardRealConversation(result, header.clientId, header.hasOutbound);

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
  await assertAiBudget({ userId: actorId, feature: 'email_thread_classify' });
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
      result = await runClassifier({
        ...header,
        linkedToClient: !!header.clientId,
        repliedBefore: header.hasOutbound,
      });
    } catch (e) {
      console.error('[classifyInboxAction]', t.id, e);
      continue;
    }
    if (!result) continue;
    result = guardRealConversation(result, header.clientId, header.hasOutbound);
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

// ── manual Gmail sync (pull new mail into the inbox) ─────────────────────────

export type InboxSyncResult =
  | {
      ok: true;
      mailbox: string;
      threadsFetched: number;
      messagesInserted: number;
      messagesSkipped: number;
    }
  | { ok: false; error: string; notConnected: boolean };

/**
 * Manually pull new Gmail threads/messages into the inbox — the same ingestion
 * the worker cron runs, but on-demand from a button on /inbox. Resolves the
 * connected mailbox (first active google_integrations row, else SYSTEM_MAILBOX)
 * so it works regardless of which alias is linked. Returns a structured result
 * (never throws to the client) so the UI can show a friendly "Gmail not
 * connected" message with a link to the integration settings instead of a 500.
 */
export async function syncInboxAction(): Promise<InboxSyncResult> {
  // Same OR-gate as the rest of the inbox triage actions (read.all | read.assigned).
  await requireInboxActor();

  // Pick the connected mailbox; fall back to the system alias (which will yield
  // the clear "No active Google integration" error → notConnected hint).
  let mailbox = SYSTEM_MAILBOX;
  try {
    const [row] = await db
      .select({ email: googleIntegrations.email })
      .from(googleIntegrations)
      .where(isNull(googleIntegrations.disconnectedAt))
      .orderBy(googleIntegrations.email)
      .limit(1);
    if (row?.email) mailbox = row.email;
  } catch {
    // best-effort: stick with the default mailbox
  }

  try {
    // Last 7 days, capped at 50 threads — same window the admin panel uses, so a
    // manual click is bounded and cheap. The worker's scheduled run handles the
    // wider backfill window.
    const report = await ingestGmail(mailbox, { sinceDays: 7, maxThreads: 50 });
    revalidatePath('/inbox');
    return {
      ok: true,
      mailbox,
      threadsFetched: report.threadsFetched,
      messagesInserted: report.messagesInserted,
      messagesSkipped: report.messagesSkipped,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    const notConnected = /no active google integration|refresh failed|GOOGLE_CLIENT/i.test(error);
    return { ok: false, error, notConnected };
  }
}
