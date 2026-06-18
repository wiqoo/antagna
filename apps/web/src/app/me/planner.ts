/**
 * The AI day-planner. Takes his fixed commitments (calendar) + open tasks +
 * his real energy windows, and lays out a time-blocked day — deep work in his
 * peak hours, admin batched, buffer between blocks, conflicts surfaced. Premium
 * planning, one tap.
 */
import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { getAnthropic, ANTHROPIC_MODELS, assertAiBudget, recordUsage, AiBudgetError } from '@antagna/ai';
import { promptDateAnchor } from '@/lib/today';
import { computePatterns, getProfile } from './brain';
import { getCalItems, kindMeta } from './calendar';

export interface PlanBlock {
  start: string; end: string; kind: string; title: string; why?: string; fixed?: boolean;
}
export interface DayPlan { theme: string | null; note: string | null; blocks: PlanBlock[]; generatedAt: string | null }

export async function getDayPlan(ownerId: string, date: string): Promise<DayPlan | null> {
  const rows = (await db.execute(sql`
    SELECT theme, note, blocks, generated_at AS "generatedAt"
    FROM me_day_plans WHERE owner_id = ${ownerId}::uuid AND plan_date = ${date}::date
  `)) as unknown as Array<{ theme: string | null; note: string | null; blocks: PlanBlock[]; generatedAt: string }>;
  const r = rows[0];
  if (!r) return null;
  return { theme: r.theme, note: r.note, blocks: Array.isArray(r.blocks) ? r.blocks : [], generatedAt: r.generatedAt };
}

export async function generateDayPlan(ownerId: string, date: string): Promise<{ ok: boolean; reason?: string }> {
  try {
    await assertAiBudget({ userId: ownerId, feature: 'me_planner' });
  } catch (e) {
    return { ok: false, reason: e instanceof AiBudgetError ? 'تجاوزت حد تكلفة الـAI لهذا الشهر.' : 'رصيد Anthropic محتاج شحن.' };
  }

  const [patterns, profile, events, tasks] = await Promise.all([
    computePatterns(ownerId),
    getProfile(ownerId),
    getCalItems(ownerId, date, date),
    db.execute(sql`
      SELECT t.title, t.priority, t.due_date AS due, p.title AS proj
      FROM me_tasks t LEFT JOIN me_projects p ON p.id = t.project_id
      WHERE t.owner_id = ${ownerId}::uuid AND t.status <> 'done'
        AND (t.is_today OR (t.due_date IS NOT NULL AND t.due_date <= ${date}::date))
      ORDER BY t.priority='high' DESC, t.due_date NULLS LAST LIMIT 25
    `) as unknown as Promise<Array<{ title: string; priority: string; due: string | null; proj: string | null }>>,
  ]);

  const fixed = events.map((e) => `${e.startHm || 'طوال اليوم'}${e.endHm ? '–' + e.endHm : ''} · ${kindMeta(e.kind).label}: ${e.title}${e.location ? ' @' + e.location : ''}`).join('\n') || '(لا مواعيد ثابتة)';
  const todo = (tasks as Array<{ title: string; priority: string; proj: string | null }>).map((t) => `- ${t.title}${t.proj ? ' [' + t.proj + ']' : ''}${t.priority === 'high' ? ' (مهم)' : ''}`).join('\n') || '(لا مهام)';
  const energy = patterns.productiveWindow ? `نافذة تركيزه الأعلى: ${patterns.productiveWindow}.` : 'مفيش بيانات كافية عن نافذة تركيزه — افترض العصر.';

  try {
    const client = getAnthropic();
    const resp = await client.messages.create({
      model: ANTHROPIC_MODELS.sonnet,
      max_tokens: 1100,
      system: `${promptDateAnchor()}
انت مخطّط يوم لمحمد (مدير إنتاج/فوتوجرافر). رتّبله يوم ${date} في بلوكات زمنية واقعية.
قواعد:
- المواعيد الثابتة لازم تتحط زي ما هي (fixed=true) ومتتعارضش.
- حُط أصعب/أهم شغل (مونتاج، deep work) في نافذة تركيزه. ${energy}
- جمّع المهام الإدارية الصغيرة في بلوك واحد (batch).
- سيب buffer بين البلوكات الثقيلة، ووقت أكل/راحة.
- متزحمش اليوم — جودة مش كمية. لو فيه تعارض بين المواعيد، اذكره في note.
- اقترح "تيمة" لليوم لو منطقي (مثلاً "يوم تركيز" لو أغلبه مونتاج).
رجّع JSON بس:
{"theme":"... أو null","note":"سطر واحد يأطّر اليوم أو ينبّه على تعارض","blocks":[{"start":"HH:MM","end":"HH:MM","kind":"deep|shoot|meeting|admin|personal|block","title":"...","why":"سبب مختصر اختياري","fixed":true|false}]}
الأوقات 24 ساعة. كله بالعربي.`,
      messages: [{ role: 'user', content:
        `# مواعيده الثابتة يوم ${date}\n${fixed}\n\n# مهامه المفتوحة\n${todo}\n\n# عنه\n${profile.summary ?? '(لسه بيتعلمه)'}` }],
    });
    await recordUsage({ feature: 'me_planner', model: ANTHROPIC_MODELS.sonnet, inputTokens: resp.usage.input_tokens, outputTokens: resp.usage.output_tokens });
    const t = resp.content.find((b) => b.type === 'text');
    const raw = t && t.type === 'text' ? t.text : '{}';
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return { ok: false, reason: 'تعذّر التخطيط.' };
    const parsed = JSON.parse(m[0]) as { theme?: string | null; note?: string | null; blocks?: PlanBlock[] };
    const blocks = Array.isArray(parsed.blocks) ? parsed.blocks.filter((b) => b && b.start && b.title).slice(0, 20) : [];
    await db.execute(sql`
      INSERT INTO me_day_plans (owner_id, plan_date, theme, note, blocks, generated_at)
      VALUES (${ownerId}::uuid, ${date}::date, ${parsed.theme ?? null}, ${parsed.note ?? null}, ${JSON.stringify(blocks)}::jsonb, now())
      ON CONFLICT (owner_id, plan_date) DO UPDATE SET
        theme = EXCLUDED.theme, note = EXCLUDED.note, blocks = EXCLUDED.blocks, generated_at = now()
    `);
    return { ok: true };
  } catch (e) {
    console.error('[me_planner]', e);
    return { ok: false, reason: /credit balance|low to access/i.test(e instanceof Error ? e.message : '') ? 'رصيد Anthropic محتاج شحن.' : 'تعذّر التخطيط — جرّب تاني.' };
  }
}
