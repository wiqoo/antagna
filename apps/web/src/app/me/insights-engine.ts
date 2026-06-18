/**
 * The insight engine: turns his patterns + balance into a short list of sharp,
 * actionable observations (rules + AI), and computes the wheel-of-life from his
 * self-ratings blended with real activity per area.
 */
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { getAnthropic, ANTHROPIC_MODELS, assertAiBudget, recordUsage, AiBudgetError } from '@antagna/ai';
import { computePatterns, patternsText, getProfile } from './brain';
import { listAreas } from './areas';

export function currentPeriod(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7);
}

export interface WheelSlice { areaId: string; key: string; name: string; icon: string; color: string; self: number | null; activity: number }

export async function computeWheel(ownerId: string): Promise<WheelSlice[]> {
  const areas = await listAreas(ownerId);
  if (!areas.length) return [];
  const period = currentPeriod();
  const [scores, activity] = (await Promise.all([
    db.execute(sql`SELECT area_id::text AS "areaId", score FROM me_area_scores WHERE owner_id=${ownerId}::uuid AND period=${period} AND source='self'`),
    db.execute(sql`
      SELECT area_id::text AS "areaId", count(*)::int AS n FROM (
        SELECT area_id FROM me_tasks WHERE owner_id=${ownerId}::uuid AND area_id IS NOT NULL AND created_at >= now()-interval '30 days'
        UNION ALL SELECT area_id FROM me_events WHERE owner_id=${ownerId}::uuid AND area_id IS NOT NULL AND start_at >= now()-interval '30 days'
        UNION ALL SELECT area_id FROM me_projects WHERE owner_id=${ownerId}::uuid AND area_id IS NOT NULL
        UNION ALL SELECT area_id FROM me_transactions WHERE owner_id=${ownerId}::uuid AND area_id IS NOT NULL AND txn_date >= current_date-30
      ) x WHERE area_id IS NOT NULL GROUP BY area_id`),
  ])) as unknown as [Array<{ areaId: string; score: number }>, Array<{ areaId: string; n: number }>];

  const selfMap = new Map(scores.map((s) => [s.areaId, s.score]));
  const actMap = new Map(activity.map((a) => [a.areaId, a.n]));
  return areas.map((a) => ({ areaId: a.id, key: a.key, name: a.name, icon: a.icon, color: a.color, self: selfMap.get(a.id) ?? null, activity: actMap.get(a.id) ?? 0 }));
}

export interface InsightRow { id: string; kind: string; title: string; body: string | null; severity: string }

export async function listInsights(ownerId: string): Promise<InsightRow[]> {
  return (await db.execute(sql`
    SELECT id::text, kind, title, body, severity FROM me_insights
    WHERE owner_id=${ownerId}::uuid AND dismissed=false AND kind <> 'money'
    ORDER BY CASE severity WHEN 'warn' THEN 0 WHEN 'good' THEN 2 ELSE 1 END, created_at DESC LIMIT 12
  `)) as unknown as InsightRow[];
}

/** Rule-based signals (no AI) — cheap, always-on. */
async function ruleInsights(ownerId: string): Promise<Array<{ kind: string; title: string; body: string; severity: string }>> {
  const out: Array<{ kind: string; title: string; body: string; severity: string }> = [];
  const rows = (await db.execute(sql`
    SELECT
      (SELECT count(*)::int FROM me_tasks WHERE owner_id=${ownerId}::uuid AND status<>'done' AND due_date < current_date) AS overdue,
      (SELECT count(*)::int FROM me_waiting WHERE owner_id=${ownerId}::uuid AND resolved=false AND since < current_date-7) AS stale_waiting,
      (SELECT count(*)::int FROM me_inbox WHERE owner_id=${ownerId}::uuid AND processed=false) AS inbox
  `)) as unknown as Array<{ overdue: number; stale_waiting: number; inbox: number }>;
  const r = rows[0];
  if (r) {
    if (r.overdue >= 3) out.push({ kind: 'nudge', title: `${r.overdue} مهام متأخرة`, body: 'تراكم بسيط — رتّبهم أو أجّل اللي مش ضروري النهارده.', severity: 'warn' });
    if (r.stale_waiting >= 1) out.push({ kind: 'nudge', title: `${r.stale_waiting} حاجة مستني عليها من أكتر من أسبوع`, body: 'حان وقت متابعة — افتح "معلّق عليه".', severity: 'warn' });
    if (r.inbox >= 8) out.push({ kind: 'nudge', title: `الوارد متكدّس (${r.inbox})`, body: 'خصّص ٥ دقايق ترتيب — صفاء الذهن أهم.', severity: 'info' });
  }
  return out;
}

/** Refresh the insight list: clears old AI/rule insights (keeps money), regenerates. */
export async function refreshInsights(ownerId: string): Promise<{ ok: boolean; reason?: string }> {
  // rules first (always)
  await db.execute(sql`DELETE FROM me_insights WHERE owner_id=${ownerId}::uuid AND kind IN ('nudge','pattern','balance','win') AND dismissed=false`);
  for (const ins of await ruleInsights(ownerId)) {
    await db.execute(sql`INSERT INTO me_insights (owner_id, kind, title, body, severity) VALUES (${ownerId}::uuid, ${ins.kind}, ${ins.title}, ${ins.body}, ${ins.severity})`);
  }

  // AI layer (best-effort)
  try {
    await assertAiBudget({ userId: ownerId, feature: 'me_insights' });
  } catch (e) {
    return { ok: false, reason: e instanceof AiBudgetError ? 'تجاوزت حد الـAI لهذا الشهر.' : 'رصيد Anthropic محتاج شحن.' };
  }
  const [patterns, profile, wheel] = await Promise.all([computePatterns(ownerId), getProfile(ownerId), computeWheel(ownerId)]);
  const wheelText = wheel.filter((w) => w.self != null).map((w) => `${w.name}: ${w.self}/10`).join('، ') || '(لسه ما قيّمش مجالاته)';
  try {
    const client = getAnthropic();
    const resp = await client.messages.create({
      model: ANTHROPIC_MODELS.haiku, max_tokens: 500,
      system: `انت بتطلّع رؤى شخصية لمحمد من أنماطه. اطلع ٢-٣ رؤى حادّة ومحددة (مش عامة)، كل واحدة عنوان قصير + سطر شرح عملي.
ركّز على: اختلال التوازن بين مجالات حياته، وأنماط إنتاجيته، وأي فرصة واضحة. رجّع JSON بس:
{"insights":[{"kind":"pattern|balance|win","title":"...","body":"...","severity":"info|good|warn"}]}`,
      messages: [{ role: 'user', content: `أنماطه:\n${patternsText(patterns)}\n\nعجلة الحياة (تقييمه): ${wheelText}\n\nعنه: ${profile.summary ?? '(لسه بيتعلمه)'}` }],
    });
    await recordUsage({ feature: 'me_insights', model: ANTHROPIC_MODELS.haiku, inputTokens: resp.usage.input_tokens, outputTokens: resp.usage.output_tokens });
    const t = resp.content.find((b) => b.type === 'text');
    const raw = t && t.type === 'text' ? t.text : '{}';
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      const parsed = JSON.parse(m[0]) as { insights?: Array<{ kind?: string; title?: string; body?: string; severity?: string }> };
      for (const ins of (parsed.insights ?? []).slice(0, 4)) {
        if (!ins.title) continue;
        const kind = ['pattern', 'balance', 'win'].includes(String(ins.kind)) ? String(ins.kind) : 'pattern';
        const sev = ['info', 'good', 'warn'].includes(String(ins.severity)) ? String(ins.severity) : 'info';
        await db.execute(sql`INSERT INTO me_insights (owner_id, kind, title, body, severity) VALUES (${ownerId}::uuid, ${kind}, ${String(ins.title).slice(0, 120)}, ${ins.body ? String(ins.body).slice(0, 400) : null}, ${sev})`);
      }
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: /credit balance|low to access/i.test(e instanceof Error ? e.message : '') ? 'رصيد Anthropic محتاج شحن.' : 'تعذّر توليد الرؤى.' };
  }
}
