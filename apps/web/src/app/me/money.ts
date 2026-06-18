/**
 * Simple personal money — but a deep read. Runway, cashflow, category mix,
 * subscription waste, savings progress. Computed live; an AI insight layered on.
 */
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { getAnthropic, ANTHROPIC_MODELS, assertAiBudget, recordUsage, AiBudgetError } from '@antagna/ai';

export interface MoneySnapshot {
  currency: string;
  liquid: number;
  monthlyIncome: number;
  incomeMtd: number;
  expenseMtd: number;
  cashflowMtd: number;
  burn90: number;            // avg monthly expense over 90d
  runwayMonths: number | null;
  categories: Array<{ category: string; total: number; pct: number }>;
  subsMonthly: number;
  subsUnused: number;
  recent: Array<{ id: string; kind: string; amount: number; category: string | null; label: string | null; date: string }>;
}

export interface SubRow { id: string; name: string; amount: number; cadence: string; category: string | null; nextCharge: string | null; lastUsed: string | null; unused: boolean }
export interface GoalRow { id: string; title: string; target: number; saved: number; targetDate: string | null; pct: number }

export async function computeMoney(ownerId: string): Promise<MoneySnapshot> {
  const [fin, mtd, burn, cats, subs, recent] = (await Promise.all([
    db.execute(sql`SELECT currency, liquid_balance::float AS liquid, monthly_income::float AS income FROM me_finance WHERE owner_id=${ownerId}::uuid`),
    db.execute(sql`
      SELECT
        COALESCE(sum(amount) FILTER (WHERE kind='income'),0)::float AS income,
        COALESCE(sum(amount) FILTER (WHERE kind='expense'),0)::float AS expense
      FROM me_transactions WHERE owner_id=${ownerId}::uuid AND date_trunc('month',txn_date)=date_trunc('month',current_date)`),
    db.execute(sql`SELECT COALESCE(sum(amount),0)::float AS total FROM me_transactions WHERE owner_id=${ownerId}::uuid AND kind='expense' AND txn_date >= current_date-90`),
    db.execute(sql`
      SELECT COALESCE(category,'غير مصنّف') AS category, sum(amount)::float AS total
      FROM me_transactions WHERE owner_id=${ownerId}::uuid AND kind='expense' AND txn_date >= current_date-90
      GROUP BY 1 ORDER BY 2 DESC LIMIT 6`),
    db.execute(sql`
      SELECT
        COALESCE(sum(CASE WHEN cadence='yearly' THEN amount/12 ELSE amount END),0)::float AS monthly,
        count(*) FILTER (WHERE last_used IS NOT NULL AND last_used < current_date-45)::int AS unused
      FROM me_subscriptions WHERE owner_id=${ownerId}::uuid AND active=true`),
    db.execute(sql`
      SELECT id::text, kind, amount::float AS amount, category, label, to_char(txn_date,'YYYY-MM-DD') AS date
      FROM me_transactions WHERE owner_id=${ownerId}::uuid ORDER BY txn_date DESC, created_at DESC LIMIT 12`),
  ])) as unknown as [
    Array<{ currency: string; liquid: number; income: number }>,
    Array<{ income: number; expense: number }>,
    Array<{ total: number }>,
    Array<{ category: string; total: number }>,
    Array<{ monthly: number; unused: number }>,
    Array<{ id: string; kind: string; amount: number; category: string | null; label: string | null; date: string }>,
  ];

  const f = fin[0] ?? { currency: 'SAR', liquid: 0, income: 0 };
  const m = mtd[0] ?? { income: 0, expense: 0 };
  const burn90 = Math.round((burn[0]?.total ?? 0) / 3);
  const catTotal = cats.reduce((a, c) => a + c.total, 0) || 1;

  return {
    currency: f.currency ?? 'SAR',
    liquid: Math.round(f.liquid ?? 0),
    monthlyIncome: Math.round(f.income ?? 0),
    incomeMtd: Math.round(m.income),
    expenseMtd: Math.round(m.expense),
    cashflowMtd: Math.round(m.income - m.expense),
    burn90,
    runwayMonths: burn90 > 0 ? Math.round((f.liquid ?? 0) / burn90 * 10) / 10 : null,
    categories: cats.map((c) => ({ category: c.category, total: Math.round(c.total), pct: Math.round(c.total / catTotal * 100) })),
    subsMonthly: Math.round(subs[0]?.monthly ?? 0),
    subsUnused: subs[0]?.unused ?? 0,
    recent: recent.map((r) => ({ ...r, amount: Math.round(r.amount) })),
  };
}

export async function listSubscriptions(ownerId: string): Promise<SubRow[]> {
  return (await db.execute(sql`
    SELECT id::text, name, amount::float AS amount, cadence, category,
           to_char(next_charge,'YYYY-MM-DD') AS "nextCharge", to_char(last_used,'YYYY-MM-DD') AS "lastUsed",
           (last_used IS NOT NULL AND last_used < current_date-45) AS unused
    FROM me_subscriptions WHERE owner_id=${ownerId}::uuid AND active=true ORDER BY amount DESC
  `)) as unknown as SubRow[];
}

export async function listGoals(ownerId: string): Promise<GoalRow[]> {
  const rows = (await db.execute(sql`
    SELECT id::text, title, target_amount::float AS target, saved_amount::float AS saved, to_char(target_date,'YYYY-MM-DD') AS "targetDate"
    FROM me_savings_goals WHERE owner_id=${ownerId}::uuid AND status='active' ORDER BY created_at
  `)) as unknown as Array<Omit<GoalRow, 'pct'>>;
  return rows.map((g) => ({ ...g, target: Math.round(g.target), saved: Math.round(g.saved), pct: g.target > 0 ? Math.min(100, Math.round(g.saved / g.target * 100)) : 0 }));
}

/** A sharp AI read on his money — cached as the latest me_insights money row. */
export async function refreshMoneyInsight(ownerId: string): Promise<{ ok: boolean; reason?: string }> {
  try {
    await assertAiBudget({ userId: ownerId, feature: 'me_money' });
  } catch (e) {
    return { ok: false, reason: e instanceof AiBudgetError ? 'تجاوزت حد الـAI لهذا الشهر.' : 'رصيد Anthropic محتاج شحن.' };
  }
  const [snap, subs] = await Promise.all([computeMoney(ownerId), listSubscriptions(ownerId)]);
  const subsText = subs.map((s) => `${s.name}: ${s.amount} ${s.cadence}${s.unused ? ' (مش مستخدم من ٤٥+ يوم)' : ''}`).join('، ') || '(لا اشتراكات)';
  try {
    const client = getAnthropic();
    const resp = await client.messages.create({
      model: ANTHROPIC_MODELS.haiku, max_tokens: 280,
      system: `انت محلل مالي شخصي لمحمد. من أرقامه، اطلع بملاحظة واحدة حادّة وعملية (٢-٣ أسطر) — أهم حاجة يعملها دلوقتي. مباشر، مبني على الأرقام، من غير كلام عام أو وعظ.`,
      messages: [{ role: 'user', content:
        `السيولة: ${snap.liquid} ${snap.currency}. الدخل الشهري: ${snap.monthlyIncome}. مصروف الشهر: ${snap.expenseMtd}. متوسط الحرق الشهري: ${snap.burn90}. Runway: ${snap.runwayMonths ?? '؟'} شهر.\nأعلى البنود: ${snap.categories.map((c) => `${c.category} ${c.total}`).join('، ')}.\nالاشتراكات (${snap.subsMonthly}/شهر): ${subsText}.` }],
    });
    await recordUsage({ feature: 'me_money', model: ANTHROPIC_MODELS.haiku, inputTokens: resp.usage.input_tokens, outputTokens: resp.usage.output_tokens });
    const t = resp.content.find((b) => b.type === 'text');
    const body = t && t.type === 'text' ? t.text.trim() : '';
    if (body) {
      await db.execute(sql`DELETE FROM me_insights WHERE owner_id=${ownerId}::uuid AND kind='money' AND dismissed=false`);
      await db.execute(sql`
        INSERT INTO me_insights (owner_id, kind, title, body, severity)
        VALUES (${ownerId}::uuid, 'money', 'قراءة فلوسك', ${body}, ${snap.runwayMonths != null && snap.runwayMonths < 3 ? 'warn' : 'info'})`);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: /credit balance|low to access/i.test(e instanceof Error ? e.message : '') ? 'رصيد Anthropic محتاج شحن.' : 'تعذّر التحليل.' };
  }
}

export async function latestMoneyInsight(ownerId: string): Promise<string | null> {
  const rows = (await db.execute(sql`
    SELECT body FROM me_insights WHERE owner_id=${ownerId}::uuid AND kind='money' AND dismissed=false
    ORDER BY created_at DESC LIMIT 1`)) as unknown as Array<{ body: string | null }>;
  return rows[0]?.body ?? null;
}
