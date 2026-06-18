/**
 * The chief-of-staff. A tool-use loop on top of the learning spine: Claude reads
 * his full personalized context, then actually DOES things (logs an expense,
 * books an event, adds a task, recalls history) and answers as a sharp peer.
 */
import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import type Anthropic from '@anthropic-ai/sdk';
import { getAnthropic, ANTHROPIC_MODELS, assertAiBudget, recordUsage, AiBudgetError } from '@antagna/ai';
import { promptDateAnchor } from '@/lib/today';
import { todayRiyadh } from './data';
import { buildPersonalContext, PERSONA, indexToBrain, recallBrain } from './brain';

export interface AssistantAction { tool: string; summary: string; ok: boolean }
export interface AssistantResult { reply: string; actions: AssistantAction[] }

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
};
const txt = (v: unknown, max = 300): string | null => {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : null;
};

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'create_task', description: 'أضف مهمة لمحمد. استخدمها لما يطلب يفتكر/يعمل حاجة.',
    input_schema: { type: 'object', properties: {
      title: { type: 'string' }, due_date: { type: 'string', description: 'YYYY-MM-DD اختياري' },
      today: { type: 'boolean', description: 'يحطها في مهام النهارده' },
      priority: { type: 'string', enum: ['low', 'normal', 'high'] },
    }, required: ['title'] },
  },
  {
    name: 'log_expense', description: 'سجّل مصروف صرفه محمد.',
    input_schema: { type: 'object', properties: {
      amount: { type: 'number' }, category: { type: 'string' }, label: { type: 'string' },
    }, required: ['amount'] },
  },
  {
    name: 'log_income', description: 'سجّل دخل/فلوس دخلت لمحمد.',
    input_schema: { type: 'object', properties: { amount: { type: 'number' }, label: { type: 'string' } }, required: ['amount'] },
  },
  {
    name: 'add_event', description: 'احجز موعد/حدث في كالندر محمد (تصوير، اجتماع، إلخ).',
    input_schema: { type: 'object', properties: {
      title: { type: 'string' }, date: { type: 'string', description: 'YYYY-MM-DD' },
      time: { type: 'string', description: 'HH:MM 24h اختياري' }, end_time: { type: 'string', description: 'HH:MM اختياري' },
      kind: { type: 'string', enum: ['shoot', 'meeting', 'deep', 'admin', 'personal', 'event', 'block'] },
      location: { type: 'string' },
    }, required: ['title', 'date'] },
  },
  {
    name: 'set_waiting', description: 'سجّل إن محمد مستني حاجة من حد.',
    input_schema: { type: 'object', properties: { what: { type: 'string' }, who: { type: 'string' } }, required: ['what'] },
  },
  {
    name: 'add_note', description: 'احفظ ملاحظة/فكرة في مخّ محمد.',
    input_schema: { type: 'object', properties: { title: { type: 'string' }, body: { type: 'string' } }, required: ['body'] },
  },
  {
    name: 'set_money', description: 'حدّث إعدادات فلوس محمد (الدخل الشهري أو السيولة الحالية).',
    input_schema: { type: 'object', properties: { monthly_income: { type: 'number' }, liquid_balance: { type: 'number' } } },
  },
  {
    name: 'recall', description: 'دوّر في ذاكرة محمد عن حاجة قديمة (ملاحظات/قرارات/سياق سابق).',
    input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  },
];

async function exec(ownerId: string, name: string, input: Record<string, unknown>): Promise<{ result: string; action: AssistantAction }> {
  const today = todayRiyadh();
  try {
    switch (name) {
      case 'create_task': {
        const title = txt(input.title, 200);
        if (!title) throw new Error('عنوان فاضي');
        const due = txt(input.due_date, 12);
        const pr = ['low', 'normal', 'high'].includes(String(input.priority)) ? String(input.priority) : 'normal';
        await db.execute(sql`
          INSERT INTO me_tasks (owner_id, title, priority, is_today, due_date)
          VALUES (${ownerId}::uuid, ${title}, ${pr}, ${input.today === true}, ${due ? sql`${due}::date` : sql`NULL`})`);
        return { result: `تمت إضافة المهمة: ${title}`, action: { tool: 'create_task', summary: `مهمة: ${title}`, ok: true } };
      }
      case 'log_expense': {
        const amount = num(input.amount);
        if (amount == null || amount <= 0) throw new Error('مبلغ غير صالح');
        const cat = txt(input.category, 40); const label = txt(input.label, 120);
        await db.execute(sql`
          INSERT INTO me_transactions (owner_id, kind, amount, category, label)
          VALUES (${ownerId}::uuid, 'expense', ${amount}, ${cat}, ${label})`);
        return { result: `تم تسجيل مصروف ${amount} ر.س${cat ? ' (' + cat + ')' : ''}`, action: { tool: 'log_expense', summary: `مصروف ${amount} ر.س${cat ? ' · ' + cat : ''}`, ok: true } };
      }
      case 'log_income': {
        const amount = num(input.amount);
        if (amount == null || amount <= 0) throw new Error('مبلغ غير صالح');
        const label = txt(input.label, 120);
        await db.execute(sql`
          INSERT INTO me_transactions (owner_id, kind, amount, label) VALUES (${ownerId}::uuid, 'income', ${amount}, ${label})`);
        return { result: `تم تسجيل دخل ${amount} ر.س`, action: { tool: 'log_income', summary: `دخل ${amount} ر.س`, ok: true } };
      }
      case 'add_event': {
        const title = txt(input.title, 160); const date = txt(input.date, 12);
        if (!title || !date) throw new Error('بيانات ناقصة');
        const time = txt(input.time, 5); const endTime = txt(input.end_time, 5);
        const kind = ['shoot', 'meeting', 'deep', 'admin', 'personal', 'event', 'block'].includes(String(input.kind)) ? String(input.kind) : 'event';
        const loc = txt(input.location, 160);
        const startTs = time ? sql`(${date + ' ' + time})::timestamp AT TIME ZONE 'Asia/Riyadh'` : sql`(${date})::date AT TIME ZONE 'Asia/Riyadh'`;
        const endTs = endTime ? sql`(${date + ' ' + endTime})::timestamp AT TIME ZONE 'Asia/Riyadh'` : sql`NULL`;
        await db.execute(sql`
          INSERT INTO me_events (owner_id, title, kind, start_at, end_at, all_day, location, source)
          VALUES (${ownerId}::uuid, ${title}, ${kind}, ${startTs}, ${endTs}, ${!time}, ${loc}, 'manual')`);
        return { result: `تم حجز "${title}" يوم ${date}${time ? ' الساعة ' + time : ''}`, action: { tool: 'add_event', summary: `موعد: ${title} · ${date}${time ? ' ' + time : ''}`, ok: true } };
      }
      case 'set_waiting': {
        const what = txt(input.what, 200);
        if (!what) throw new Error('فاضي');
        const who = txt(input.who, 80);
        await db.execute(sql`INSERT INTO me_waiting (owner_id, what, who) VALUES (${ownerId}::uuid, ${what}, ${who})`);
        return { result: `سجّلت إنك مستني: ${what}`, action: { tool: 'set_waiting', summary: `مستني: ${what}`, ok: true } };
      }
      case 'add_note': {
        const body = txt(input.body, 2000);
        if (!body) throw new Error('فاضي');
        const title = txt(input.title, 160);
        const rows = (await db.execute(sql`
          INSERT INTO me_notes (owner_id, title, body) VALUES (${ownerId}::uuid, ${title}, ${body}) RETURNING id::text AS id`)) as unknown as Array<{ id: string }>;
        if (rows[0]) await indexToBrain(ownerId, `${title ? title + ': ' : ''}${body}`, 'me_note', rows[0].id);
        return { result: 'تم حفظ الملاحظة', action: { tool: 'add_note', summary: `ملاحظة: ${title ?? body.slice(0, 40)}`, ok: true } };
      }
      case 'set_money': {
        const inc = num(input.monthly_income); const liq = num(input.liquid_balance);
        await db.execute(sql`
          INSERT INTO me_finance (owner_id, monthly_income, liquid_balance, updated_at)
          VALUES (${ownerId}::uuid, ${inc ?? 0}, ${liq ?? 0}, now())
          ON CONFLICT (owner_id) DO UPDATE SET
            monthly_income = ${inc != null ? sql`${inc}` : sql`me_finance.monthly_income`},
            liquid_balance = ${liq != null ? sql`${liq}` : sql`me_finance.liquid_balance`},
            updated_at = now()`);
        return { result: 'تم تحديث إعدادات الفلوس', action: { tool: 'set_money', summary: 'تحديث الفلوس', ok: true } };
      }
      case 'recall': {
        const q = txt(input.query, 200) ?? '';
        const hits = await recallBrain(ownerId, q, 6);
        return { result: hits.length ? hits.map((h) => `- ${h}`).join('\n') : 'مفيش حاجة في الذاكرة عن ده.', action: { tool: 'recall', summary: `بحث: ${q}`, ok: true } };
      }
      default:
        return { result: 'أداة غير معروفة', action: { tool: name, summary: name, ok: false } };
    }
  } catch (e) {
    return { result: `فشل: ${e instanceof Error ? e.message : 'خطأ'}`, action: { tool: name, summary: `${name} (فشل)`, ok: false } };
  }
}

/** Run one assistant turn (with short conversation history) and persist it. */
export async function runAssistant(ownerId: string, userText: string): Promise<AssistantResult> {
  const message = userText.trim().slice(0, 2000);
  if (!message) return { reply: '', actions: [] };

  // persist the user turn immediately
  await db.execute(sql`INSERT INTO me_messages (owner_id, role, content) VALUES (${ownerId}::uuid, 'user', ${message})`);

  try {
    await assertAiBudget({ userId: ownerId, feature: 'me_assistant' });
  } catch (e) {
    const reply = e instanceof AiBudgetError ? 'تجاوزت حد تكلفة الـAI لهذا الشهر.' : 'خدمة المساعد مش متاحة دلوقتي — رصيد Anthropic محتاج شحن.';
    await db.execute(sql`INSERT INTO me_messages (owner_id, role, content) VALUES (${ownerId}::uuid, 'assistant', ${reply})`);
    return { reply, actions: [] };
  }

  const [ctx, history] = await Promise.all([
    buildPersonalContext(ownerId, { query: message }),
    db.execute(sql`SELECT role, content FROM me_messages WHERE owner_id=${ownerId}::uuid ORDER BY created_at DESC LIMIT 9`) as unknown as Promise<Array<{ role: string; content: string }>>,
  ]);

  const system = `${promptDateAnchor()}\n${PERSONA}

عندك سياق كامل عن محمد تحت — اتكلم بناءً عليه، اربط بأرقامه وأنماطه الفعلية.
لو طلب منك تعمل حاجة (مهمة، مصروف، موعد، ملاحظة...) استخدم الأدوات فعلاً — متقولش "هعملها" من غير ما تنفّذ.
لو سأل سؤال تحليلي، جاوب كخبير: رؤية حادّة مبنية على بياناته، مش نصايح عامة. لو محتاج معلومة من ذاكرته استخدم recall.
بعد ما تنفّذ، ردّ بسطر-سطرين بالعربي: إيه اللي عملته + أي ملاحظة ذكية مختصرة.

# سياق محمد
${ctx}`;

  const msgs: Anthropic.MessageParam[] = (history.reverse() as Array<{ role: string; content: string }>)
    .map((h) => ({ role: h.role === 'assistant' ? 'assistant' as const : 'user' as const, content: h.content }));
  // ensure the last turn is the current user message (it is, from history)
  if (!msgs.length || msgs[msgs.length - 1]?.role !== 'user') msgs.push({ role: 'user', content: message });

  const client = getAnthropic();
  const actions: AssistantAction[] = [];
  let reply = '';

  try {
    for (let hop = 0; hop < 5; hop++) {
      const resp = await client.messages.create({
        model: ANTHROPIC_MODELS.sonnet, max_tokens: 1024, system, tools: TOOLS, messages: msgs,
      });
      await recordUsage({ feature: 'me_assistant', model: ANTHROPIC_MODELS.sonnet, inputTokens: resp.usage.input_tokens, outputTokens: resp.usage.output_tokens });

      const textBlocks = resp.content.filter((b): b is Anthropic.TextBlock => b.type === 'text');
      if (textBlocks.length) reply = textBlocks.map((b) => b.text).join('\n').trim();

      const toolUses = resp.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
      if (resp.stop_reason !== 'tool_use' || !toolUses.length) break;

      msgs.push({ role: 'assistant', content: resp.content as unknown as Anthropic.MessageParam['content'] });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        const { result, action } = await exec(ownerId, tu.name, (tu.input ?? {}) as Record<string, unknown>);
        actions.push(action);
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: result });
      }
      msgs.push({ role: 'user', content: results });
    }
  } catch (e) {
    console.error('[me_assistant]', e);
    const credit = /credit balance|low to access/i.test(e instanceof Error ? e.message : '');
    if (!reply) reply = credit ? 'نفّذت اللي قدرت عليه، بس خدمة المساعد مش متاحة دلوقتي — رصيد Anthropic محتاج شحن.' : 'حصل خطأ مؤقت — جرّب تاني.';
  }

  if (!reply) reply = actions.length ? 'تمام، عملتها ✅' : 'مش متأكد فهمت — وضّحلي أكتر؟';

  await db.execute(sql`
    INSERT INTO me_messages (owner_id, role, content, actions)
    VALUES (${ownerId}::uuid, 'assistant', ${reply}, ${JSON.stringify(actions)}::jsonb)`);
  // learn from the exchange (best-effort, semantic)
  if (message.length > 12) await indexToBrain(ownerId, message, 'me_msg', `msg:${Date.now()}`);

  return { reply, actions };
}
