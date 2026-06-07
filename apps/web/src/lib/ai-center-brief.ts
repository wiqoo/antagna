/**
 * AI Center narrative brief — a short, plain-Arabic paragraph that explains what
 * the system is doing overall, what the AI has learned (the brain), and the
 * state of the caches. Cached in system_settings(key='ai_center_brief') and
 * regenerated on demand or when older than the TTL, so it stays fresh without
 * an AI call on every page load.
 */
import { db } from '@antagna/db';
import { sql } from 'drizzle-orm';
import { getAnthropic, ANTHROPIC_MODELS, recordUsage, assertAiBudget } from '@antagna/ai';

const KEY = 'ai_center_brief';
const TTL_MS = 6 * 60 * 60 * 1000; // 6h

const BRIEF_SYSTEM = `أنت مساعد ذكي لشركة إنتاج فيديو سعودية اسمها "Volt Production". اكتب فقرة واحدة (4-6 جُمل) بالعربية الفصحى البسيطة تشرح للمستخدم بشكل عام:
1) ما الذي يجري في النظام الآن (المشاريع، العملاء، البريد).
2) ما الذي تعلّمه الذكاء الاصطناعي وخزّنه في ذاكرته (البرين)، وما الذي تحتويه.
3) حالة الكاشات والحوسبة المسبقة (هل محدّثة؟).
قواعد صارمة:
- استخدم الأرقام الحقيقية المعطاة فقط، ولا تخترع أي رقم.
- فقرة واحدة متصلة، ودّية ومباشرة، بلا عناوين ولا تعداد نقطي. ابدأ مباشرة بالمحتوى.`;

type Brief = { content: string | null; generatedAt: string | null };

async function readCached(): Promise<Brief> {
  const r = (await db.execute(sql`
    SELECT value FROM system_settings WHERE key = ${KEY} LIMIT 1
  `)) as unknown as Array<{ value: { content?: string; generated_at?: string } | null }>;
  const v = r[0]?.value ?? null;
  return { content: v?.content ?? null, generatedAt: v?.generated_at ?? null };
}

async function gatherStats(): Promise<string> {
  const sRes = (await db.execute(sql`
    SELECT
      (SELECT count(*) FROM projects WHERE archived_at IS NULL AND stage NOT IN ('delivered','archived','lost','cancelled'))::int AS active_projects,
      (SELECT count(*) FROM clients WHERE archived_at IS NULL)::int AS clients,
      (SELECT count(*) FROM clients WHERE is_agency AND archived_at IS NULL)::int AS agencies,
      (SELECT count(*) FROM email_threads WHERE status IN ('open','waiting_client'))::int AS open_threads,
      (SELECT count(*) FROM ai_suggestions WHERE status='pending')::int AS pending_suggestions,
      (SELECT count(*) FROM ai_memory_chunks)::int AS memory_total,
      (SELECT count(*) FROM email_extractions)::int AS extractions,
      (SELECT count(*) FROM clients WHERE custom_fields ? 'enrichment')::int AS enriched,
      (SELECT COALESCE(SUM(cost_usd),0) FROM ai_usage WHERE created_at >= date_trunc('month', now()))::text AS cost_mtd,
      (SELECT max(computed_at) FROM dashboard_board_cache)::text AS cache_last,
      (SELECT count(*) FROM dashboard_board_cache)::int AS cache_rows,
      (SELECT count(*) FROM daily_tasks WHERE source_key LIKE 'ai_routine:%')::int AS routine_tasks
  `)) as unknown as Array<Record<string, unknown>>;
  const s = sRes[0] ?? {};

  const scopeRes = (await db.execute(sql`
    SELECT scope, count(*)::int AS cnt FROM ai_memory_chunks GROUP BY scope ORDER BY cnt DESC LIMIT 6
  `)) as unknown as Array<{ scope: string; cnt: number }>;
  const scopes = scopeRes.map((x) => `${x.scope}:${x.cnt}`).join('، ') || 'لا شيء بعد';

  const num = (k: string) => Number(s[k] ?? 0);
  const cacheLast = s.cache_last ? String(s.cache_last).slice(0, 16).replace('T', ' ') : 'لم يُحسب';

  return [
    'أرقام النظام الحقيقية الآن (لا تتجاوزها):',
    `- مشاريع نشطة: ${num('active_projects')}`,
    `- عملاء: ${num('clients')} (منهم ${num('agencies')} وكالة)`,
    `- محادثات بريد مفتوحة: ${num('open_threads')}`,
    `- اقتراحات معلّقة من البريد: ${num('pending_suggestions')}`,
    `- استخراجات ذكية من الإيميلات: ${num('extractions')}`,
    `- عملاء أُثروا بالبحث: ${num('enriched')}`,
    `- مهام روتين خطّطها الـ AI: ${num('routine_tasks')}`,
    `- حجم الذاكرة (البرين): ${num('memory_total')} مقطع، موزّعة على النطاقات: ${scopes}`,
    `- تكلفة الـ AI هذا الشهر: $${Number(s.cost_mtd ?? 0).toFixed(2)}`,
    `- كاش الداشبورد: ${num('cache_rows')} ملف، آخر حساب ${cacheLast}`,
    '',
    'اكتب الفقرة الآن.',
  ].join('\n');
}

async function generate(): Promise<string | null> {
  await assertAiBudget({ userId: null, feature: 'ai_center_brief' });
  const userMsg = await gatherStats();
  const client = getAnthropic();
  const resp = await client.messages.create({
    model: ANTHROPIC_MODELS.haiku,
    max_tokens: 500,
    system: BRIEF_SYSTEM,
    messages: [{ role: 'user', content: userMsg }],
  });
  await recordUsage({
    feature: 'ai_center_brief',
    model: ANTHROPIC_MODELS.haiku,
    inputTokens: resp.usage.input_tokens ?? 0,
    outputTokens: resp.usage.output_tokens ?? 0,
    userId: null,
  });
  const txt = resp.content.find((b) => b.type === 'text');
  const content = (txt && txt.type === 'text' ? txt.text : '').trim().slice(0, 1200);
  if (!content) return null;

  await db.execute(sql`
    INSERT INTO system_settings (key, value, updated_at)
    VALUES (${KEY}, ${JSON.stringify({ content, generated_at: new Date().toISOString() })}::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `);
  return content;
}

/**
 * Return the brief, regenerating it when forced, missing, or stale (>6h).
 * Best-effort: on any generation failure it falls back to the cached copy so the
 * page never breaks.
 */
export async function getOrRefreshBrief(opts: { force?: boolean } = {}): Promise<Brief> {
  const cached = await readCached();
  const ageMs = cached.generatedAt ? Date.now() - new Date(cached.generatedAt).getTime() : Infinity;
  const stale = !cached.content || ageMs > TTL_MS;
  if (!opts.force && !stale) return cached;

  try {
    const content = await generate();
    if (content) return { content, generatedAt: new Date().toISOString() };
  } catch (err) {
    console.error('[ai-center-brief] generate failed', err);
  }
  return cached;
}
