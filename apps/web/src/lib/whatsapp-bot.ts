/**
 * WhatsApp team chat-ops bot.
 *
 * Identifies the sender by matching their WhatsApp number against
 * profiles.whatsapp_e164, then runs Claude Sonnet with a small set of
 * tools that query / mutate Antagna data scoped to that profile's
 * permissions. The reply is sent via WPPConnect's sendText.
 *
 * Hybrid mode: high-confidence direct replies go out immediately; low
 * confidence becomes a draft Mohammed reviews from /admin/integrations/whatsapp.
 *
 * This is an INTERNAL tool — only team members listed in profiles can
 * use it. Unknown numbers are silently ignored (no auto-reply leaks
 * anything to outsiders).
 */
import { db, whatsappMessages, profiles, projects, projectTasks, dailyTasks } from '@antagna/db';
import { eq, and, or, desc, sql, isNull, gte, gt } from 'drizzle-orm';
import {
  getAnthropic,
  getOpenAI,
  ANTHROPIC_MODELS,
  retrieveMemory,
  assertAiBudget,
  recordUsage,
  AiBudgetError,
} from '@antagna/ai';
import { sendText, setTyping } from './whatsapp';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

const BOT_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://antagna.me';

// Provider switch. Default to OpenAI — gpt-4o-mini follows tone + language
// switch rules more strictly than Haiku in our prompt. Override via env.
const BOT_PROVIDER = (process.env.WHATSAPP_BOT_PROVIDER ?? 'openai') as
  | 'openai'
  | 'anthropic';
const OPENAI_MODEL = process.env.WHATSAPP_BOT_OPENAI_MODEL ?? 'gpt-4o-mini';

// ── tool surface ──────────────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'my_open_tasks',
    description:
      "اجلب المهام المفتوحة (pending أو in_progress) المسندة للمستخدم الحالي. " +
      "يدعم الفلترة حسب الـ scope: 'today' / 'overdue' / 'week' / 'all'.",
    input_schema: {
      type: 'object',
      properties: {
        scope: {
          type: 'string',
          enum: ['today', 'overdue', 'week', 'all'],
          default: 'today',
        },
      },
    },
  },
  {
    name: 'project_status',
    description:
      "اجلب حالة مشروع معين بالـ code (PRJ-0001) أو بجزء من اسمه. " +
      "يرجع stage + dates + assigned PM + recent activity.",
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'project code or name fragment' },
      },
      required: ['query'],
    },
  },
  {
    name: 'lookup_colleague',
    description:
      "ابحث عن زميل في الفريق بإسمه (عربي أو إنجليزي). يرجع رقم تليفونه + الدور.",
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
      },
      required: ['name'],
    },
  },
  {
    name: 'antagna_link',
    description:
      "رجّع رابط مباشر لصفحة في Antagna. الـ entity: 'project' | 'task' | 'inbox' | 'crm' | 'equipment' | 'dashboard'. " +
      "للـ project + task: مرّر الـ id. لباقي الـ entities: لا حاجة إلى id.",
    input_schema: {
      type: 'object',
      properties: {
        entity: {
          type: 'string',
          enum: ['project', 'task', 'inbox', 'crm', 'equipment', 'dashboard', 'kpis', 'team'],
        },
        id: { type: 'string', description: 'uuid; required for project + task only' },
      },
      required: ['entity'],
    },
  },
  {
    name: 'recent_activity',
    description:
      "آخر نشاط على Antagna (آخر مشاريع متحرّكة، آخر مهام منزلّة، آخر leads). " +
      "scope='mine' للأنشطة المسندة للمستخدم فقط، 'team' لكل الفريق.",
    input_schema: {
      type: 'object',
      properties: {
        scope: { type: 'string', enum: ['mine', 'team'], default: 'mine' },
        hours: { type: 'integer', default: 24 },
      },
    },
  },
];

const SYSTEM_PROMPT = `You are Volt Bot — the internal assistant for Volt Production's team on WhatsApp.

## Voice & tone
- Professional first, lightly warm. Concise. Confident. Not jokey.
- No emojis except a single "✓" when confirming an action completed. Never use 👋 🙂 📋 🚀 or similar.
- Replies are short — 1-2 lines is ideal, 3 lines max. WhatsApp short, not chatty.
- Don't introduce yourself or sign off unless asked.

## Language mirroring (critical)
- Default: match the language the user is currently writing in.
- If user writes Arabic → reply in clean MSA Arabic (light, not flowery).
- If user writes English → reply in English. Do not switch back to Arabic.
- If user EXPLICITLY says "كلمني بالإنجليزي" / "speak English" / "in English" → from then on reply only in English until they switch back.
- If user EXPLICITLY says "بالعربي" / "Arabic" → switch to Arabic.
- Same for dialect: mirror Egyptian / Khaleeji / MSA based on what they write.

## What you can do (tools)
- my_open_tasks — get the user's open tasks (today / overdue / week / all)
- project_status — look up a project by code or name
- lookup_colleague — find a teammate's contact info
- antagna_link — return a deep link to a page in Antagna
- recent_activity — recent activity events (mine or team)

## Rules
- Greetings (salam, hi, good morning) → return a brief, professional greeting + offer help. One short line.
- Thanks ("شكراً" / "thanks") → brief acknowledgement ("Any time" / "أي وقت"). One short line.
- Specific question about Antagna → use the right tool. Reply concisely with the answer + a link if useful.
- Action requests that aren't in your tool set (create / edit / send / approve) → "That needs Antagna" + the appropriate antagna_link.
- Unclear request → ask exactly ONE clarifying question, not multiple.
- Never fabricate data. If a tool returns nothing, say so plainly + suggest opening Antagna.

## Multi-message handling
- If the user sent several messages in a row without a reply between them, treat them as ONE query and answer all of them in a single tidy reply — not one message per item.
- Older messages (above the current batch in your context) have already been answered. Don't re-answer them.

## Capability boundary
- You ARE NOT a customer-facing concierge. You serve internal team only. Stay focused on Antagna info + workflows.
- If asked about things outside Antagna (jokes, news, opinions), give a short polite line and pivot back: "I focus on Antagna info. Anything I can look up for you?"`;

// ── public entry point ────────────────────────────────────────────────────

export interface BotReplyResult {
  ok: boolean;
  skipped?:
    | 'no_profile'
    | 'no_inbound'
    | 'already_replied'
    | 'duplicate_processing'
    | 'superseded';
  profileId?: string;
  reply?: string;
  confidence?: 'high' | 'low';
  sentMessageId?: string;
  error?: string;
}

/**
 * Process one inbound message: identify sender → call Claude with tools →
 * send reply if confidence high. Idempotent on the message id.
 */
export async function handleInboundForBot(
  messageDbId: string,
): Promise<BotReplyResult> {
  const [msg] = await db
    .select()
    .from(whatsappMessages)
    .where(eq(whatsappMessages.id, messageDbId))
    .limit(1);
  if (!msg) return { ok: false, error: 'message_not_found' };
  if (msg.direction !== 'inbound') return { ok: true, skipped: 'no_inbound' };
  if (msg.aiClassification) {
    // already processed
    return { ok: true, skipped: 'duplicate_processing' };
  }

  // Debounce — collapse rapid-fire messages from the same person into one
  // reply. If a newer inbound arrives in the same thread during the wait,
  // this run aborts (the newer one will reply for the whole batch).
  await new Promise((r) => setTimeout(r, 4500));
  if (msg.threadKey) {
    const [latest] = await db
      .select({ id: whatsappMessages.id })
      .from(whatsappMessages)
      .where(
        and(
          eq(whatsappMessages.threadKey, msg.threadKey),
          eq(whatsappMessages.direction, 'inbound'),
        ),
      )
      .orderBy(desc(whatsappMessages.receivedAt))
      .limit(1);
    if (latest && latest.id !== msg.id) {
      await db
        .update(whatsappMessages)
        .set({ aiClassification: 'superseded' })
        .where(eq(whatsappMessages.id, msg.id));
      return { ok: true, skipped: 'superseded' };
    }
  }

  // Identify sender. The from_e164 is either a real +E.164 or 'lid:NNN'
  // (WhatsApp privacy rollout). Try both lookup paths:
  //   - 'lid:NNN'    → match profiles.whatsapp_lid = 'NNN'
  //   - '+E.164'     → match profiles.whatsapp_e164 directly
  const lidValue = msg.fromE164.startsWith('lid:')
    ? msg.fromE164.slice(4)
    : null;
  const [senderRow] = await db
    .select({
      id: profiles.id,
      displayName: profiles.displayName,
      role: profiles.role,
      whatsappE164: profiles.whatsappE164,
    })
    .from(profiles)
    .where(
      lidValue
        ? eq(profiles.whatsappLid, lidValue)
        : eq(profiles.whatsappE164, msg.fromE164),
    )
    .limit(1);
  let senderProfile = senderRow ?? null;

  // No match? Maybe this is a verification code (2-digit body) from a user
  // mid-onboarding. Match against active codes; if hit, link the sender
  // and reply with confirmation via the user's pre-registered phone.
  if (!senderProfile) {
    const linkResult = await tryVerificationCodeLink(
      msg.id,
      msg.bodyText,
      lidValue,
      msg.fromE164.startsWith('+') ? msg.fromE164 : null,
    );
    if (linkResult.linked && linkResult.replyToE164) {
      await sendText(
        linkResult.replyToE164,
        `تم الربط ✓\nأهلاً ${linkResult.displayName} 👋`,
      );
      return {
        ok: true,
        profileId: linkResult.profileId,
        reply: 'verified',
        confidence: 'high',
      };
    }
  }

  // Mark processed even if we don't reply, so the scanner doesn't loop.
  await db
    .update(whatsappMessages)
    .set({ aiClassification: senderProfile ? 'authorized' : 'unauthorized' })
    .where(eq(whatsappMessages.id, msg.id));

  if (!senderProfile) {
    return { ok: true, skipped: 'no_profile' };
  }

  // Dedupe rapid-fire: if a NEWER inbound already exists in this thread, skip —
  // the newest message's own invocation answers the whole batch as ONE reply.
  // Without this, sending 2-3 quick messages triggers 2-3 separate bot replies.
  if (msg.threadKey) {
    const newer = await db
      .select({ id: whatsappMessages.id })
      .from(whatsappMessages)
      .where(
        and(
          eq(whatsappMessages.threadKey, msg.threadKey),
          eq(whatsappMessages.direction, 'inbound'),
          gt(whatsappMessages.receivedAt, msg.receivedAt),
        ),
      )
      .limit(1);
    if (newer.length > 0) {
      return { ok: true, skipped: 'superseded' };
    }
  }

  // Gather ALL unanswered inbound messages since the last outbound — the
  // user may have typed 2-3 messages rapid-fire and we want to reply to
  // the batch as ONE message. Plus the most recent assistant/user pair
  // for tone context.
  const recent = msg.threadKey
    ? await db
        .select({
          direction: whatsappMessages.direction,
          bodyText: whatsappMessages.bodyText,
          receivedAt: whatsappMessages.receivedAt,
        })
        .from(whatsappMessages)
        .where(eq(whatsappMessages.threadKey, msg.threadKey))
        .orderBy(desc(whatsappMessages.receivedAt))
        .limit(10)
    : [
        {
          direction: msg.direction,
          bodyText: msg.bodyText,
          receivedAt: msg.receivedAt,
        },
      ];

  // Walk newest → oldest, collect consecutive INBOUND messages until we
  // hit an outbound. That batch is what the bot answers RIGHT NOW (joined
  // into a single user turn). Stop there and keep the prior pair for tone.
  const unansweredInbound: string[] = [];
  const priorContext: typeof recent = [];
  let crossedAnOutbound = false;
  for (const h of recent) {
    if (!crossedAnOutbound && h.direction === 'inbound') {
      if (h.bodyText) unansweredInbound.push(h.bodyText);
      continue;
    }
    crossedAnOutbound = true;
    priorContext.push(h);
    if (priorContext.length >= 2) break;
  }

  const messages: Anthropic.MessageParam[] = [];
  // Prior pair (oldest → newest) for tone/topic continuity.
  for (const h of [...priorContext].reverse()) {
    if (!h.bodyText) continue;
    messages.push({
      role: h.direction === 'inbound' ? 'user' : 'assistant',
      content: h.bodyText,
    });
  }
  // Unanswered batch joined as one user turn (oldest → newest).
  if (unansweredInbound.length > 0) {
    messages.push({
      role: 'user',
      content: [...unansweredInbound].reverse().join('\n\n'),
    });
  }

  // Show "typing..." while we think. Best-effort — fire-and-forget so a
  // slow typing call doesn't add to overall latency.
  if (senderProfile.whatsappE164) {
    void setTyping(senderProfile.whatsappE164, true);
  }

  // RAG: recall relevant company memory (recent activity/audit) so the bot can
  // answer from what actually happened — not only the chat window. Best-effort.
  let memoryContext = '';
  const queryText =
    unansweredInbound.length > 0
      ? [...unansweredInbound].reverse().join('\n')
      : (priorContext[0]?.bodyText ?? '');
  if (queryText.trim()) {
    try {
      const recalled = await retrieveMemory({
        query: queryText,
        limit: 5,
        minSimilarity: 0.3,
      });
      if (recalled.length > 0) {
        memoryContext =
          '\n\n## Relevant company memory (recent — use only if it helps)\n' +
          recalled.map((m) => `- ${m.content}`).join('\n');
      }
    } catch (e) {
      console.error('[whatsapp-bot] memory recall failed', e);
    }
  }

  const systemFull =
    SYSTEM_PROMPT +
    `\n\n## Current user\n${senderProfile.displayName} — role: ${senderProfile.role} — profile_id: ${senderProfile.id}` +
    memoryContext;

  // Hard cost cap — the bot runs with no session actor, so only the
  // company-wide monthly budget applies (userId: null). When it's hit we
  // degrade gracefully instead of crashing the webhook: stop typing and
  // return a short "busy" line at low confidence (no paid call, not sent).
  try {
    await assertAiBudget({ userId: null, feature: 'whatsapp_bot' });
  } catch (err) {
    if (err instanceof AiBudgetError) {
      if (senderProfile.whatsappE164) {
        void setTyping(senderProfile.whatsappE164, false);
      }
      return {
        ok: true,
        profileId: senderProfile.id,
        reply: 'النظام مشغول مؤقتًا، جرّب بعد قليل.',
        confidence: 'low',
      };
    }
    throw err;
  }

  let reply = '';
  let confidence: 'high' | 'low' = 'high';

  if (BOT_PROVIDER === 'openai') {
    const r = await runOpenAiTurn(systemFull, messages, senderProfile);
    reply = r.reply;
    confidence = r.confidence;
  } else {
    const r = await runAnthropicTurn(systemFull, messages, senderProfile);
    reply = r.reply;
    confidence = r.confidence;
  }

  if (!reply) {
    reply = `No ready reply. Open Antagna for details: ${BOT_BASE_URL}`;
    confidence = 'low';
  }

  // Send if high confidence. ALWAYS send to whatsappE164 (the real phone),
  // never to a LID — WPPConnect can't deliver to LIDs.
  if (confidence === 'high') {
    if (!senderProfile.whatsappE164) {
      return {
        ok: false,
        profileId: senderProfile.id,
        reply,
        confidence,
        error: 'no_send_target',
      };
    }
    // Stop the typing indicator before sending the actual message.
    void setTyping(senderProfile.whatsappE164, false);
    const sendRes = await sendText(senderProfile.whatsappE164, reply);
    // Persist our reply as an outbound row so the next inbound's history
    // has the full back-and-forth (and Claude doesn't re-answer old
    // questions it already handled). WPPConnect's onSelfMessage webhook
    // is disabled so we'd otherwise have no record of our own replies.
    if (sendRes.ok && sendRes.messageId) {
      try {
        await db.insert(whatsappMessages).values({
          baileysMessageId: sendRes.messageId,
          direction: 'outbound',
          fromE164: process.env.WHATSAPP_OUR_E164 ?? 'volt-bot',
          toE164: senderProfile.whatsappE164,
          messageType: 'text',
          bodyText: reply,
          rawPayload: { generated_by: 'volt-bot', provider: BOT_PROVIDER },
          threadKey: msg.threadKey,
          receivedAt: new Date(),
        });
      } catch {
        // duplicate / race — ignore
      }
    }
    return {
      ok: sendRes.ok,
      profileId: senderProfile.id,
      reply,
      confidence,
      sentMessageId: sendRes.messageId,
      error: sendRes.ok ? undefined : 'send_failed',
    };
  }
  // Low confidence — stop typing too.
  if (senderProfile.whatsappE164) {
    void setTyping(senderProfile.whatsappE164, false);
  }
  // Low confidence: save as DRAFT (not sent), Mohammed reviews from admin UI later.
  // For now we just return — a future iteration adds the draft store.
  return {
    ok: true,
    profileId: senderProfile.id,
    reply,
    confidence,
  };
}

// ── verification code linking ─────────────────────────────────────────────

async function tryVerificationCodeLink(
  messageDbId: string,
  body: string | null,
  lidValue: string | null,
  realPhoneE164: string | null,
): Promise<{
  linked: boolean;
  profileId?: string;
  displayName?: string;
  replyToE164?: string;
}> {
  if (!body) return { linked: false };
  const code = body.trim().match(/^(\d{2})$/)?.[1];
  if (!code) return { linked: false };

  // The user pre-registered their phone in /settings/whatsapp BEFORE
  // generating the code — that's the whatsapp_e164 on their profile.
  // We only allow profiles that have that phone set (otherwise we'd link
  // a LID with no way to reply).
  const [match] = await db.execute<{
    id: string;
    display_name: string;
    whatsapp_e164: string;
  }>(sql`
    SELECT id::text AS id, display_name, whatsapp_e164
    FROM profiles
    WHERE whatsapp_verification_code = ${code}
      AND whatsapp_verification_expires_at > now()
      AND whatsapp_lid IS NULL
      AND whatsapp_e164 IS NOT NULL
    LIMIT 1
  `) as unknown as Array<{ id: string; display_name: string; whatsapp_e164: string }>;

  if (!match) return { linked: false };

  // Link the LID (or +E.164 if WhatsApp gave us a real number) and clear
  // the verification code. The pre-registered whatsapp_e164 stays — it's
  // the send target.
  await db.execute(sql`
    UPDATE profiles
    SET whatsapp_lid = ${lidValue},
        whatsapp_verification_code = NULL,
        whatsapp_verification_expires_at = NULL,
        updated_at = now()
    WHERE id = ${match.id}::uuid
  `);

  await db
    .update(whatsappMessages)
    .set({ aiClassification: 'verification' })
    .where(eq(whatsappMessages.id, messageDbId));

  return {
    linked: true,
    profileId: match.id,
    displayName: match.display_name,
    replyToE164: match.whatsapp_e164,
  };
}

// ── provider runners ──────────────────────────────────────────────────────

interface TurnResult {
  reply: string;
  confidence: 'high' | 'low';
}

/** OpenAI tool-calling loop. */
async function runOpenAiTurn(
  system: string,
  initialMessages: Anthropic.MessageParam[],
  user: { id: string; displayName: string; role: string },
): Promise<TurnResult> {
  const client = getOpenAI();
  // Translate Anthropic-style messages into OpenAI chat messages. Our
  // messages only contain string content (no tool_use blocks at this point),
  // so the mapping is direct.
  const oaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: system },
    ...initialMessages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: typeof m.content === 'string' ? m.content : '',
    })),
  ];

  const oaiTools: OpenAI.Chat.ChatCompletionTool[] = TOOLS.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description ?? '',
      parameters: t.input_schema as Record<string, unknown>,
    },
  }));

  const maxTurns = 3;
  for (let turn = 0; turn < maxTurns; turn++) {
    const resp = await client.chat.completions.create({
      model: OPENAI_MODEL,
      max_tokens: 400,
      messages: oaiMessages,
      tools: oaiTools,
      tool_choice: 'auto',
    });
    // Track cost of this paid call. Bot has no session actor → user_id NULL
    // (company-wide budget still accounts for it). Best-effort: a ledger
    // write must never break the reply.
    try {
      await recordUsage({
        feature: 'whatsapp_bot',
        model: OPENAI_MODEL,
        inputTokens: resp.usage?.prompt_tokens ?? 0,
        outputTokens: resp.usage?.completion_tokens ?? 0,
        userId: null,
      });
    } catch (e) {
      console.error('[whatsapp-bot] recordUsage failed', e);
    }
    const choice = resp.choices[0];
    if (!choice) break;
    const msg = choice.message;

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      const reply = (msg.content ?? '').trim();
      const confidence: 'high' | 'low' = /not sure|لست متأكد|ما لقيت|i don't have/i.test(reply)
        ? 'low'
        : 'high';
      return { reply, confidence };
    }

    oaiMessages.push({
      role: 'assistant',
      content: msg.content ?? '',
      tool_calls: msg.tool_calls,
    });

    for (const call of msg.tool_calls) {
      if (call.type !== 'function') continue;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || '{}');
      } catch {
        args = {};
      }
      const result = await runTool(call.function.name, args, user);
      oaiMessages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }
  return { reply: '', confidence: 'low' };
}

/** Anthropic tool-calling loop (kept as a fallback). */
async function runAnthropicTurn(
  system: string,
  initialMessages: Anthropic.MessageParam[],
  user: { id: string; displayName: string; role: string },
): Promise<TurnResult> {
  const anthropic = getAnthropic();
  const messages = [...initialMessages];
  const maxTurns = 3;

  for (let turn = 0; turn < maxTurns; turn++) {
    const resp = await anthropic.messages.create({
      model: ANTHROPIC_MODELS.haiku,
      max_tokens: 400,
      system,
      tools: TOOLS,
      messages,
    });
    // Track cost of this paid call. Bot has no session actor → user_id NULL.
    // Best-effort: never let a ledger write break the reply.
    try {
      await recordUsage({
        feature: 'whatsapp_bot',
        model: ANTHROPIC_MODELS.haiku,
        inputTokens: resp.usage?.input_tokens ?? 0,
        outputTokens: resp.usage?.output_tokens ?? 0,
        cacheReadTokens: (resp.usage as { cache_read_input_tokens?: number })?.cache_read_input_tokens ?? 0,
        cacheWriteTokens: (resp.usage as { cache_creation_input_tokens?: number })?.cache_creation_input_tokens ?? 0,
        userId: null,
      });
    } catch (e) {
      console.error('[whatsapp-bot] recordUsage failed', e);
    }
    const toolUseBlocks = resp.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );
    const textBlocks = resp.content.filter(
      (b): b is Anthropic.TextBlock => b.type === 'text',
    );

    if (toolUseBlocks.length === 0) {
      const reply = textBlocks.map((t) => t.text).join('\n').trim();
      const confidence: 'high' | 'low' = /ما لقيت|لست متأكد|not sure/i.test(reply)
        ? 'low'
        : 'high';
      return { reply, confidence };
    }

    messages.push({ role: 'assistant', content: resp.content });
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUseBlocks) {
      const result = await runTool(tu.name, tu.input as Record<string, unknown>, user);
      toolResults.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: JSON.stringify(result),
      });
    }
    messages.push({ role: 'user', content: toolResults });
  }
  return { reply: '', confidence: 'low' };
}

// ── tool implementations ──────────────────────────────────────────────────

interface ProfileCtx {
  id: string;
  displayName: string;
  role: string;
}

async function runTool(
  name: string,
  input: Record<string, unknown>,
  user: ProfileCtx,
): Promise<unknown> {
  try {
    switch (name) {
      case 'my_open_tasks':
        return await myOpenTasks(user.id, (input.scope as string) ?? 'today');
      case 'project_status':
        return await projectStatus(input.query as string);
      case 'lookup_colleague':
        return await lookupColleague(input.name as string);
      case 'antagna_link':
        return antagnaLink(input.entity as string, input.id as string | undefined);
      case 'recent_activity':
        return await recentActivity(user.id, (input.scope as string) ?? 'mine', (input.hours as number) ?? 24);
      default:
        return { error: `unknown_tool:${name}` };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

async function myOpenTasks(profileId: string, scope: string) {
  // Union project_tasks (assignee_id) + daily_tasks (owner_id)
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const weekEnd = new Date(today.getTime() + 7 * 86_400_000);

  const rows = await db.execute<{
    kind: string;
    id: string;
    title: string;
    status: string;
    due_at: Date | null;
    project_code: string | null;
  }>(sql`
    SELECT 'project' AS kind, pt.id::text AS id, pt.title, pt.status::text AS status,
           pt.due_at, p.code AS project_code
    FROM project_tasks pt
    JOIN projects p ON p.id = pt.project_id
    WHERE pt.assignee_id = ${profileId}::uuid
      AND pt.status IN ('pending','in_progress')
    UNION ALL
    SELECT 'daily' AS kind, dt.id::text, dt.title, dt.status::text,
           dt.due_at, NULL
    FROM daily_tasks dt
    WHERE dt.owner_id = ${profileId}::uuid
      AND dt.status IN ('pending','in_progress')
    ORDER BY due_at NULLS LAST
  `);
  const arr = rows as unknown as Array<{
    kind: string;
    id: string;
    title: string;
    status: string;
    due_at: Date | null;
    project_code: string | null;
  }>;

  let filtered = arr;
  if (scope === 'today') {
    filtered = arr.filter((t) => t.due_at && new Date(t.due_at) < tomorrow);
  } else if (scope === 'overdue') {
    filtered = arr.filter((t) => t.due_at && new Date(t.due_at) < today);
  } else if (scope === 'week') {
    filtered = arr.filter((t) => t.due_at && new Date(t.due_at) < weekEnd);
  }
  return {
    count: filtered.length,
    tasks: filtered.slice(0, 15).map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      due: t.due_at ? new Date(t.due_at).toISOString().slice(0, 10) : null,
      project: t.project_code,
    })),
  };
}

async function projectStatus(query: string) {
  const q = query.trim();
  const isCode = /^PRJ-\d+$/i.test(q);
  const [proj] = await db.execute<{
    id: string;
    code: string;
    title: string;
    stage: string;
    delivery_due_at: Date | null;
    shoot_starts_at: Date | null;
    pm: string | null;
  }>(sql`
    SELECT p.id::text AS id, p.code, p.title, p.stage::text AS stage,
           p.delivery_due_at, p.shoot_starts_at,
           pm.display_name AS pm
    FROM projects p
    LEFT JOIN profiles pm ON pm.id = p.project_manager_id
    WHERE p.archived_at IS NULL
      AND (
        ${isCode ? sql`p.code = ${q.toUpperCase()}` : sql`(p.title ILIKE ${'%' + q + '%'} OR p.title_ar ILIKE ${'%' + q + '%'})`}
      )
    LIMIT 1
  `) as unknown as Array<{
    id: string;
    code: string;
    title: string;
    stage: string;
    delivery_due_at: Date | null;
    shoot_starts_at: Date | null;
    pm: string | null;
  }>;

  if (!proj) return { found: false, query };
  return {
    found: true,
    project: {
      id: proj.id,
      code: proj.code,
      title: proj.title,
      stage: proj.stage,
      pm: proj.pm,
      delivery_due: proj.delivery_due_at?.toISOString().slice(0, 10) ?? null,
      shoot_starts: proj.shoot_starts_at?.toISOString().slice(0, 10) ?? null,
    },
  };
}

async function lookupColleague(name: string) {
  const q = name.trim();
  const matches = await db
    .select({
      id: profiles.id,
      displayName: profiles.displayName,
      displayNameEn: profiles.displayNameEn,
      role: profiles.role,
      whatsappE164: profiles.whatsappE164,
      phoneE164: profiles.phoneE164,
      email: profiles.email,
    })
    .from(profiles)
    .where(
      and(
        isNull(profiles.archivedAt),
        or(
          sql`${profiles.displayName} ILIKE ${'%' + q + '%'}`,
          sql`${profiles.displayNameEn} ILIKE ${'%' + q + '%'}`,
        ),
      ),
    )
    .limit(5);
  return {
    count: matches.length,
    profiles: matches.map((p) => ({
      name: p.displayName,
      role: p.role,
      whatsapp: p.whatsappE164,
      phone: p.phoneE164,
      email: p.email,
    })),
  };
}

function antagnaLink(entity: string, id?: string) {
  const paths: Record<string, string> = {
    dashboard: '/dashboard',
    inbox: '/inbox',
    crm: '/crm',
    equipment: '/equipment',
    kpis: '/kpis',
    team: '/team',
  };
  if (entity === 'project' && id) return { url: `${BOT_BASE_URL}/projects/${id}` };
  if (entity === 'task' && id) return { url: `${BOT_BASE_URL}/tasks#${id}` };
  if (entity in paths) return { url: `${BOT_BASE_URL}${paths[entity]}` };
  return { url: BOT_BASE_URL };
}

async function recentActivity(profileId: string, scope: string, hours: number) {
  const since = new Date(Date.now() - hours * 3_600_000);
  const filter =
    scope === 'mine'
      ? sql`AND (a.actor_id = ${profileId}::uuid OR a.entity_id IN (
            SELECT project_id FROM project_assignments WHERE profile_id = ${profileId}::uuid
          ))`
      : sql``;
  const rows = await db.execute<{
    action: string;
    entity_type: string;
    entity_id: string;
    summary: string | null;
    created_at: Date;
  }>(sql`
    SELECT a.action::text AS action, a.entity_type::text AS entity_type,
           a.entity_id::text AS entity_id,
           COALESCE(a.summary_ar, a.summary_en) AS summary,
           a.created_at
    FROM activity_events a
    WHERE a.created_at >= ${since}
    ${filter}
    ORDER BY a.created_at DESC
    LIMIT 10
  `);
  const arr = rows as unknown as Array<{
    action: string;
    entity_type: string;
    entity_id: string;
    summary: string | null;
    created_at: Date;
  }>;
  return {
    count: arr.length,
    events: arr.map((e) => ({
      action: e.action,
      entity_type: e.entity_type,
      entity_id: e.entity_id,
      summary: e.summary,
      at: new Date(e.created_at).toISOString(),
    })),
  };
}
