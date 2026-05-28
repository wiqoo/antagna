'use server';

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getAnthropic, ANTHROPIC_MODELS, recordUsage, retrieveMemory } from '@antagna/ai';

const rows = <T,>(r: unknown): T[] => r as unknown as T[];

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
