/**
 * The learning spine of the Life OS.
 *
 * Not a trained model — a personalization layer every AI feature routes through:
 *   1. an evolving PROFILE of him (me_profile.traits + summary), distilled by an
 *      LLM from his real activity + corrections (learnProfile, runs daily);
 *   2. statistical PATTERNS computed live from his own data (productive hours,
 *      completion rates, spending baselines) — cheap, exact, no AI;
 *   3. a semantic BRAIN (ai_memory_chunks, scope='me') for recall of his history;
 *   4. a FEEDBACK loop — corrections become stored preferences fed back in.
 *
 * buildPersonalContext() assembles all of it into the rich, peer-level context
 * that the assistant / planner / insight engine condition on. Capture is cheap;
 * the intelligence is deep.
 */
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import {
  getAnthropic, ANTHROPIC_MODELS, assertAiBudget, recordUsage,
  indexMemory, retrieveMemory,
} from '@antagna/ai';
import { todayRiyadh } from './data';
import { promptDateAnchor } from '@/lib/today';

const ME_SCOPE = 'me';

// ── profile ──────────────────────────────────────────────────────────────────
export interface Profile {
  traits: Record<string, unknown>;
  summary: string | null;
  learnedAt: string | null;
}

export async function getProfile(ownerId: string): Promise<Profile> {
  const rows = (await db.execute(sql`
    SELECT traits, summary, learned_at AS "learnedAt" FROM me_profile WHERE owner_id = ${ownerId}::uuid
  `)) as unknown as Array<{ traits: Record<string, unknown>; summary: string | null; learnedAt: string | null }>;
  const p = rows[0];
  if (!p) {
    await db.execute(sql`INSERT INTO me_profile (owner_id) VALUES (${ownerId}::uuid) ON CONFLICT DO NOTHING`);
    return { traits: {}, summary: null, learnedAt: null };
  }
  return { traits: p.traits ?? {}, summary: p.summary, learnedAt: p.learnedAt };
}

// ── statistical patterns (no AI — exact, from his own data) ───────────────────
export interface Patterns {
  productiveWindow: string | null;   // e.g. "العصر (4–8م)"
  productiveHours: number[];         // top hours-of-day he completes work
  doneThisWeek: number;
  done30: number;
  completionNote: string | null;
  busiestDay: string | null;
  topCategories: Array<{ category: string; total: number }>;
  monthlyBurn: number | null;        // avg monthly expense over 90d
  habitBest: { title: string; streak: number } | null;
}

const WD_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function windowLabel(hours: number[]): string | null {
  if (!hours.length) return null;
  const avg = hours.reduce((a, b) => a + b, 0) / hours.length;
  if (avg < 11) return 'الصبح (6–11ص)';
  if (avg < 16) return 'الضهر (11ص–4م)';
  if (avg < 20) return 'العصر (4–8م)';
  return 'بالليل (8م–فجر)';
}

export async function computePatterns(ownerId: string): Promise<Patterns> {
  const [hours, weekly, days, cats, burnRows, habit] = (await Promise.all([
    db.execute(sql`
      SELECT extract(hour FROM completed_at AT TIME ZONE 'Asia/Riyadh')::int AS hr, count(*)::int AS n
      FROM me_tasks WHERE owner_id=${ownerId}::uuid AND status='done' AND completed_at IS NOT NULL
        AND completed_at >= now() - interval '60 days'
      GROUP BY 1 ORDER BY 2 DESC LIMIT 3`),
    db.execute(sql`
      SELECT
        (SELECT count(*)::int FROM me_tasks WHERE owner_id=${ownerId}::uuid AND status='done' AND completed_at >= now() - interval '7 days') AS "doneThisWeek",
        (SELECT count(*)::int FROM me_tasks WHERE owner_id=${ownerId}::uuid AND status='done' AND completed_at >= now() - interval '30 days') AS "done30"`),
    db.execute(sql`
      SELECT extract(dow FROM completed_at AT TIME ZONE 'Asia/Riyadh')::int AS dow, count(*)::int AS n
      FROM me_tasks WHERE owner_id=${ownerId}::uuid AND status='done' AND completed_at IS NOT NULL
        AND completed_at >= now() - interval '60 days'
      GROUP BY 1 ORDER BY 2 DESC LIMIT 1`),
    db.execute(sql`
      SELECT COALESCE(category,'غير مصنّف') AS category, sum(amount)::float AS total
      FROM me_transactions WHERE owner_id=${ownerId}::uuid AND kind='expense'
        AND txn_date >= current_date - 90
      GROUP BY 1 ORDER BY 2 DESC LIMIT 4`),
    db.execute(sql`
      SELECT sum(amount)::float AS total FROM me_transactions
      WHERE owner_id=${ownerId}::uuid AND kind='expense' AND txn_date >= current_date - 90`),
    db.execute(sql`
      SELECT h.title,
        (SELECT count(*)::int FROM me_habit_logs l WHERE l.habit_id=h.id AND l.log_date >= current_date - 30) AS streak
      FROM me_habits h WHERE h.owner_id=${ownerId}::uuid AND h.active=true
      ORDER BY streak DESC LIMIT 1`),
  ])) as unknown as [
    Array<{ hr: number; n: number }>,
    Array<{ doneThisWeek: number; done30: number }>,
    Array<{ dow: number; n: number }>,
    Array<{ category: string; total: number }>,
    Array<{ total: number | null }>,
    Array<{ title: string; streak: number }>,
  ];

  const productiveHours = hours.map((h) => h.hr);
  const w = weekly[0] ?? { doneThisWeek: 0, done30: 0 };
  const burn = burnRows[0]?.total != null ? Math.round((burnRows[0].total / 3)) : null;
  const hb = habit[0];

  return {
    productiveWindow: windowLabel(productiveHours),
    productiveHours,
    doneThisWeek: w.doneThisWeek,
    done30: w.done30,
    completionNote: w.done30 > 0 ? `خلّص ${w.doneThisWeek} هذا الأسبوع و${w.done30} في ٣٠ يوم` : null,
    busiestDay: days[0] ? (WD_AR[days[0].dow] ?? null) : null,
    topCategories: cats.map((c) => ({ category: c.category, total: Math.round(c.total) })),
    monthlyBurn: burn,
    habitBest: hb && hb.streak > 0 ? { title: hb.title, streak: hb.streak } : null,
  };
}

export function patternsText(p: Patterns): string {
  const lines: string[] = [];
  if (p.productiveWindow) lines.push(`- نافذة إنتاجيتك الأعلى: ${p.productiveWindow} (من أوقات إنجازه الفعلية).`);
  if (p.completionNote) lines.push(`- الإنجاز: ${p.completionNote}.`);
  if (p.busiestDay) lines.push(`- أكثر يوم بينجز فيه: ${p.busiestDay}.`);
  if (p.monthlyBurn != null) lines.push(`- متوسط مصروفه الشهري ≈ ${p.monthlyBurn} ر.س.`);
  if (p.topCategories.length) lines.push(`- أعلى بنود صرفه: ${p.topCategories.map((c) => `${c.category} (${c.total})`).join('، ')}.`);
  if (p.habitBest) lines.push(`- أقوى عادة: ${p.habitBest.title} (${p.habitBest.streak} يوم/٣٠).`);
  return lines.join('\n');
}

// ── feedback loop ─────────────────────────────────────────────────────────────
export async function recordFeedback(ownerId: string, fb: {
  scope: string; refId?: string | null; signal: string; note?: string | null;
}): Promise<void> {
  await db.execute(sql`
    INSERT INTO me_feedback (owner_id, scope, ref_id, signal, note)
    VALUES (${ownerId}::uuid, ${fb.scope}, ${fb.refId ?? null}, ${fb.signal}, ${fb.note ?? null})
  `);
}

async function recentPreferences(ownerId: string): Promise<string[]> {
  const rows = (await db.execute(sql`
    SELECT note FROM me_feedback
    WHERE owner_id=${ownerId}::uuid AND note IS NOT NULL AND signal IN ('edit','down','note')
    ORDER BY created_at DESC LIMIT 12
  `)) as unknown as Array<{ note: string }>;
  return rows.map((r) => r.note);
}

// ── semantic brain (recall of his history) ────────────────────────────────────
export async function indexToBrain(ownerId: string, content: string, source: string, sourceId: string, metadata?: unknown): Promise<void> {
  try {
    await indexMemory({ scope: ME_SCOPE, scopeId: ownerId, source, sourceId, content, metadata });
  } catch { /* best-effort */ }
}

export async function recallBrain(ownerId: string, query: string, limit = 6): Promise<string[]> {
  try {
    const hits = await retrieveMemory({ query, scope: ME_SCOPE, scopeId: ownerId, limit, minSimilarity: 0.25 });
    return hits.map((h) => h.content);
  } catch { return []; }
}

// ── current-state snapshot (live, no AI) ──────────────────────────────────────
async function currentState(ownerId: string): Promise<string> {
  const today = todayRiyadh();
  const [tasks, projects, events, waiting, money] = (await Promise.all([
    db.execute(sql`
      SELECT t.title, t.due_date AS due, p.title AS proj FROM me_tasks t
      LEFT JOIN me_projects p ON p.id=t.project_id
      WHERE t.owner_id=${ownerId}::uuid AND t.status<>'done'
        AND (t.is_today OR (t.due_date IS NOT NULL AND t.due_date <= ${today}::date + 7))
      ORDER BY t.due_date NULLS LAST LIMIT 40`),
    db.execute(sql`SELECT title, type, stage, deadline FROM me_projects WHERE owner_id=${ownerId}::uuid AND status='active' LIMIT 30`),
    db.execute(sql`
      SELECT title, kind, to_char(start_at AT TIME ZONE 'Asia/Riyadh','YYYY-MM-DD HH24:MI') AS at
      FROM me_events WHERE owner_id=${ownerId}::uuid AND status<>'cancelled'
        AND start_at >= now() AND start_at <= now() + interval '7 days'
      ORDER BY start_at LIMIT 30`),
    db.execute(sql`SELECT what, who FROM me_waiting WHERE owner_id=${ownerId}::uuid AND resolved=false LIMIT 20`),
    db.execute(sql`
      SELECT
        (SELECT liquid_balance::float FROM me_finance WHERE owner_id=${ownerId}::uuid) AS liquid,
        (SELECT monthly_income::float FROM me_finance WHERE owner_id=${ownerId}::uuid) AS income,
        (SELECT COALESCE(sum(amount),0)::float FROM me_transactions WHERE owner_id=${ownerId}::uuid AND kind='expense' AND date_trunc('month',txn_date)=date_trunc('month',current_date)) AS spent_mtd`),
  ])) as unknown as [
    Array<{ title: string; due: string | null; proj: string | null }>,
    Array<{ title: string; type: string; stage: string | null; deadline: string | null }>,
    Array<{ title: string; kind: string; at: string }>,
    Array<{ what: string; who: string | null }>,
    Array<{ liquid: number | null; income: number | null; spent_mtd: number | null }>,
  ];

  const lines: string[] = [];
  if (projects.length) { lines.push('## مشاريعه الفعّالة'); projects.forEach((p) => lines.push(`- ${p.title} (${p.type}${p.stage ? '/' + p.stage : ''}${p.deadline ? '، ديدلاين ' + p.deadline : ''})`)); }
  if (tasks.length) { lines.push('## مهام مفتوحة (قريبة)'); tasks.forEach((t) => lines.push(`- ${t.title}${t.proj ? ' [' + t.proj + ']' : ''}${t.due ? ' (موعد ' + t.due + ')' : ''}`)); }
  if (events.length) { lines.push('## مواعيد جاية'); events.forEach((e) => lines.push(`- ${e.at} — ${e.title} (${e.kind})`)); }
  if (waiting.length) { lines.push('## معلّق عليه'); waiting.forEach((w) => lines.push(`- ${w.what}${w.who ? ' (من ' + w.who + ')' : ''}`)); }
  const m = money[0];
  if (m && (m.liquid != null || m.income != null || m.spent_mtd)) {
    lines.push('## الفلوس');
    if (m.liquid != null) lines.push(`- السيولة الحالية: ${Math.round(m.liquid)} ر.س`);
    if (m.income != null) lines.push(`- الدخل الشهري المتوقّع: ${Math.round(m.income)} ر.س`);
    if (m.spent_mtd) lines.push(`- مصروف الشهر لحد دلوقتي: ${Math.round(m.spent_mtd)} ر.س`);
  }
  return lines.join('\n');
}

/**
 * The full personalized context every AI feature conditions on.
 * `query` (optional) pulls the most relevant slices of his history from the brain.
 */
export async function buildPersonalContext(ownerId: string, opts?: { query?: string; brain?: boolean }): Promise<string> {
  const [profile, patterns, state, prefs, recall] = await Promise.all([
    getProfile(ownerId),
    computePatterns(ownerId),
    currentState(ownerId),
    recentPreferences(ownerId),
    opts?.brain !== false && opts?.query ? recallBrain(ownerId, opts.query) : Promise.resolve<string[]>([]),
  ]);

  const parts: string[] = [];
  if (profile.summary) parts.push(`# مين هو\n${profile.summary}`);
  const traitKeys = Object.keys(profile.traits ?? {});
  if (traitKeys.length) parts.push(`# اللي اتعلمته عنه\n${JSON.stringify(profile.traits)}`);
  const pt = patternsText(patterns);
  if (pt) parts.push(`# أنماط من سلوكه الفعلي\n${pt}`);
  if (prefs.length) parts.push(`# تفضيلاته (من تصحيحاته — احترمها)\n${prefs.map((p) => `- ${p}`).join('\n')}`);
  if (state) parts.push(`# وضعه الحالي\n${state}`);
  if (recall.length) parts.push(`# من ذاكرته (ذو صلة بالسؤال)\n${recall.map((r) => `- ${r}`).join('\n')}`);
  return parts.join('\n\n').slice(0, 16000);
}

/** The shared peer-tone persona. */
export const PERSONA = `أنت "المساعد" — الـChief-of-Staff الشخصي لمحمد غريب، مدير إنتاج وفوتوجرافر بيدير فريق في شركة فولت بالسعودية.
اتكلم بالعربي المصري/الخليجي الطبيعي، كنِدّ ومحترف — هو خبير في شغله، ماتشرحلوش البديهيات وماتعاملوش كأنه مبتدئ.
كن مباشر، حاد، وعملي. لما تحلّل، اربط بأنماطه الفعلية وأرقامه، مش كلام عام. قصّر في الكلام، طوّل في القيمة.`;

// ── the learn loop (the "gets smarter about him" part) ────────────────────────
/**
 * Distill his recent activity + corrections into an updated profile (traits +
 * one-paragraph summary). Statistical patterns are injected so the LLM grounds
 * its description in fact. Cheap model, runs daily from the cron.
 */
export async function learnProfile(ownerId: string): Promise<boolean> {
  try {
    await assertAiBudget({ userId: ownerId, feature: 'me_learn' });
    const [profile, patterns, state, prefs] = await Promise.all([
      getProfile(ownerId), computePatterns(ownerId), currentState(ownerId), recentPreferences(ownerId),
    ]);
    const client = getAnthropic();
    const resp = await client.messages.create({
      model: ANTHROPIC_MODELS.haiku,
      max_tokens: 700,
      system: `${promptDateAnchor()}
انت بتبني بروفايل بيتطوّر عن محمد عشان مساعده الشخصي يفهمه أكتر مع الوقت.
عندك: البروفايل الحالي، أنماط إحصائية من سلوكه الفعلي، وضعه الحالي، وتصحيحاته.
حدّث البروفايل: ادمج الجديد، احذف اللي اتغيّر، خليه دقيق ومبني على دليل (مش تخمين).
رجّع JSON بس بالشكل ده:
{"summary":"فقرة واحدة (≤٥ أسطر) تصف مين هو، إزاي بيشتغل، إيه اللي يهمّه دلوقتي","traits":{"energy_windows":"...","working_style":"...","people":"...","spending":"...","priorities":"...","preferences":"...","vocabulary":"..."}}
أي مفتاح في traits لو مفيش دليل كفاية، شيله. كله بالعربي.`,
      messages: [{ role: 'user', content:
        `البروفايل الحالي:\n${JSON.stringify({ summary: profile.summary, traits: profile.traits })}\n\nأنماط إحصائية:\n${patternsText(patterns)}\n\nوضعه الحالي:\n${state}\n\nتصحيحاته الأخيرة:\n${prefs.join('\n') || '(لا يوجد)'}` }],
    });
    await recordUsage({ feature: 'me_learn', model: ANTHROPIC_MODELS.haiku, inputTokens: resp.usage.input_tokens, outputTokens: resp.usage.output_tokens });
    const txt = resp.content.find((b) => b.type === 'text');
    const raw = txt && txt.type === 'text' ? txt.text : '{}';
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return false;
    const parsed = JSON.parse(m[0]) as { summary?: string; traits?: Record<string, unknown> };
    await db.execute(sql`
      INSERT INTO me_profile (owner_id, traits, summary, learned_at, updated_at)
      VALUES (${ownerId}::uuid, ${JSON.stringify(parsed.traits ?? {})}::jsonb, ${parsed.summary ?? null}, now(), now())
      ON CONFLICT (owner_id) DO UPDATE SET
        traits = EXCLUDED.traits, summary = EXCLUDED.summary, learned_at = now(), updated_at = now()
    `);
    return true;
  } catch (e) {
    console.error('[me_learn]', e);
    return false;
  }
}
