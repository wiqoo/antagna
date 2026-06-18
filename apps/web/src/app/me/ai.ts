import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { getAnthropic, ANTHROPIC_MODELS, assertAiBudget, recordUsage } from '@antagna/ai';
import { todayRiyadh } from './data';
import { promptDateAnchor } from '@/lib/today';

async function gatherContext(ownerId: string): Promise<string> {
  const [tasks, projects, notes, waiting] = (await Promise.all([
    db.execute(sql`SELECT t.title, t.status, t.due_date, p.title AS proj FROM me_tasks t LEFT JOIN me_projects p ON p.id=t.project_id WHERE t.owner_id=${ownerId}::uuid AND t.status<>'done' ORDER BY t.created_at DESC LIMIT 60`),
    db.execute(sql`SELECT title, type, stage, status, deadline FROM me_projects WHERE owner_id=${ownerId}::uuid AND status='active' LIMIT 40`),
    db.execute(sql`SELECT title, left(body,400) AS body FROM me_notes WHERE owner_id=${ownerId}::uuid ORDER BY updated_at DESC LIMIT 40`),
    db.execute(sql`SELECT what, who, since FROM me_waiting WHERE owner_id=${ownerId}::uuid AND resolved=false LIMIT 30`),
  ])) as unknown as [
    Array<{ title: string; status: string; due_date: string | null; proj: string | null }>,
    Array<{ title: string; type: string; stage: string | null; status: string; deadline: string | null }>,
    Array<{ title: string | null; body: string }>,
    Array<{ what: string; who: string | null; since: string }>,
  ];
  const lines: string[] = [];
  lines.push('# المشاريع'); projects.forEach((p) => lines.push(`- ${p.title} (${p.type}${p.stage ? '/' + p.stage : ''}${p.deadline ? ', ديدلاين ' + p.deadline : ''})`));
  lines.push('\n# المهام المفتوحة'); tasks.forEach((t) => lines.push(`- ${t.title}${t.proj ? ' [' + t.proj + ']' : ''}${t.due_date ? ' (موعد ' + t.due_date + ')' : ''}`));
  lines.push('\n# معلّق عليه'); waiting.forEach((w) => lines.push(`- ${w.what}${w.who ? ' (من ' + w.who + ')' : ''} منذ ${w.since}`));
  lines.push('\n# ملاحظات'); notes.forEach((n) => lines.push(`- ${n.title ? n.title + ': ' : ''}${n.body}`));
  return lines.join('\n').slice(0, 14000);
}

/** Ask your second brain — AI Q&A grounded in your own tasks/projects/notes/waiting. */
export async function askMyBrain(ownerId: string, question: string): Promise<string> {
  try {
    await assertAiBudget({ userId: ownerId, feature: 'me_ask' });
    const ctx = await gatherContext(ownerId);
    const client = getAnthropic();
    const resp = await client.messages.create({
      model: ANTHROPIC_MODELS.sonnet,
      max_tokens: 700,
      system: `${promptDateAnchor()}\nأنت المساعد الشخصي لمحمد (مدير إنتاج/فوتوجرافر). أجب بالعربي باختصار ودقّة بناءً على بياناته فقط (تحت). لو المعلومة مش موجودة قُل كده بصراحة. اربط بالمشاريع/المهام عند الحاجة.`,
      messages: [{ role: 'user', content: `بياناتي:\n${ctx}\n\nسؤالي: ${question}` }],
    });
    await recordUsage({ feature: 'me_ask', model: ANTHROPIC_MODELS.sonnet, inputTokens: resp.usage.input_tokens, outputTokens: resp.usage.output_tokens });
    const txt = resp.content.find((b) => b.type === 'text');
    return txt && txt.type === 'text' ? txt.text : 'لم أتمكن من الإجابة.';
  } catch (e) {
    console.error('[me_ask]', e);
    if (e instanceof Error && e.name === 'AiBudgetError') return 'تجاوزت حد تكلفة الـAI لهذا الشهر.';
    if (e instanceof Error && /credit balance|low to access/i.test(e.message)) return 'خدمة الـAI غير متاحة مؤقتاً — رصيد Anthropic محتاج شحن.';
    return 'تعذّرت الإجابة — جرّب تاني.';
  }
}

export interface WeeklyStats { doneThisWeek: number; openTasks: number; overdue: number; waiting: number; activeProjects: number }

/** Numbers + an AI prose summary to prep the weekly review. */
export async function buildWeeklySummary(ownerId: string): Promise<{ stats: WeeklyStats; ai: string }> {
  const today = todayRiyadh();
  const rows = (await db.execute(sql`
    SELECT
      (SELECT count(*)::int FROM me_tasks WHERE owner_id=${ownerId}::uuid AND status='done' AND completed_at >= now() - interval '7 days') AS "doneThisWeek",
      (SELECT count(*)::int FROM me_tasks WHERE owner_id=${ownerId}::uuid AND status<>'done') AS "openTasks",
      (SELECT count(*)::int FROM me_tasks WHERE owner_id=${ownerId}::uuid AND status<>'done' AND due_date < ${today}::date) AS "overdue",
      (SELECT count(*)::int FROM me_waiting WHERE owner_id=${ownerId}::uuid AND resolved=false) AS "waiting",
      (SELECT count(*)::int FROM me_projects WHERE owner_id=${ownerId}::uuid AND status='active') AS "activeProjects"
  `)) as unknown as WeeklyStats[];
  const stats = rows[0] ?? { doneThisWeek: 0, openTasks: 0, overdue: 0, waiting: 0, activeProjects: 0 };

  let ai = '';
  try {
    await assertAiBudget({ userId: ownerId, feature: 'me_weekly' });
    const ctx = await gatherContext(ownerId);
    const client = getAnthropic();
    const resp = await client.messages.create({
      model: ANTHROPIC_MODELS.haiku,
      max_tokens: 350,
      system: `أنت تجهّز مراجعة أسبوعية لمحمد. من بياناته، اكتب ٣-٤ أسطر عربية: أهم ما يستحق الانتباه، أكبر عنق زجاجة، واقتراح تركيز الأسبوع الجاي. مباشر وعملي.`,
      messages: [{ role: 'user', content: `الأرقام: خلّص ${stats.doneThisWeek} هذا الأسبوع، ${stats.openTasks} مفتوحة (${stats.overdue} متأخرة)، ${stats.waiting} معلّق، ${stats.activeProjects} مشاريع.\n\n${ctx}` }],
    });
    await recordUsage({ feature: 'me_weekly', model: ANTHROPIC_MODELS.haiku, inputTokens: resp.usage.input_tokens, outputTokens: resp.usage.output_tokens });
    const txt = resp.content.find((b) => b.type === 'text');
    ai = txt && txt.type === 'text' ? txt.text : '';
  } catch {
    ai = '';
  }
  return { stats, ai };
}
