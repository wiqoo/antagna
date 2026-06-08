/**
 * Smart, brain-connected, cached analysis for one quotation.
 *
 * Reads the AI brain (semantic client memory + durable project_learnings +
 * the thread's conversation summary) to judge whether a quote will convert and
 * what to do next, then caches the result keyed by an input hash (recomputed
 * only when the quote/email state changes or the row goes stale) and indexes a
 * short conclusion back into the brain.
 */
import crypto from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import {
  getAnthropic,
  ANTHROPIC_MODELS,
  recordUsage,
  assertAiBudget,
  retrieveMemory,
  indexMemory,
} from '@antagna/ai';

export type QuoteStatus =
  | 'on_track'
  | 'stalled'
  | 'at_risk'
  | 'no_client_response'
  | 'ready_to_invoice';

export interface QuotationAnalysis {
  status: QuoteStatus;
  likelihood: 'high' | 'medium' | 'low';
  headlineAr: string;
  actionAr: string;
  reasoningAr: string;
  brainUsed: boolean;
}

export interface QuoteState {
  projectId: string;
  clientId: string | null;
  title: string;
  clientName: string | null;
  stage: string;
  quoteNo: string | null;
  invoiceNo: string | null;
  valueSar: string | null;
  quotedAt: string | null;
  lastEmailAt: string | null;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
}

const CACHE_TTL_HOURS = 24;

const STATUS_AR: Record<QuoteStatus, string> = {
  on_track: 'على المسار',
  stalled: 'متوقّف',
  at_risk: 'في خطر التعثّر',
  no_client_response: 'بدون رد من العميل',
  ready_to_invoice: 'جاهز للفوترة',
};
export const QUOTE_STATUS_LABEL_AR = STATUS_AR;

function stateHash(s: QuoteState): string {
  return crypto
    .createHash('sha256')
    .update(
      [s.stage, s.invoiceNo ?? '', s.quoteNo ?? '', s.valueSar ?? '', s.quotedAt ?? '', s.lastEmailAt ?? '', s.lastInboundAt ?? '', s.lastOutboundAt ?? ''].join('|'),
    )
    .digest('hex');
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

/** Read cached analyses for a set of projects in one query (page-fast path). */
export async function readCachedAnalyses(
  projectIds: string[],
): Promise<Map<string, { analysis: QuotationAnalysis; inputHash: string; computedAt: string }>> {
  const out = new Map<string, { analysis: QuotationAnalysis; inputHash: string; computedAt: string }>();
  if (!projectIds.length) return out;
  const rows = (await db.execute(sql`
    SELECT project_id::text AS pid, input_hash, payload, computed_at::text AS computed_at
    FROM quotation_analysis_cache
    WHERE project_id IN (${sql.join(projectIds.map((id) => sql`${id}::uuid`), sql`, `)})
  `)) as unknown as Array<{ pid: string; input_hash: string; payload: QuotationAnalysis; computed_at: string }>;
  for (const r of rows) out.set(r.pid, { analysis: r.payload, inputHash: r.input_hash, computedAt: r.computed_at });
  return out;
}

function isFresh(inputHash: string, computedAt: string, state: QuoteState): boolean {
  if (inputHash !== stateHash(state)) return false;
  const ageH = (Date.now() - new Date(computedAt).getTime()) / 3_600_000;
  return ageH < CACHE_TTL_HOURS;
}

/** Get the analysis for one quote — cache-first; computes (and caches) on miss/stale. */
export async function analyzeQuotation(
  state: QuoteState,
  opts: { force?: boolean; userId?: string | null; cached?: { inputHash: string; computedAt: string; analysis: QuotationAnalysis } } = {},
): Promise<QuotationAnalysis & { cached: boolean }> {
  const pre = opts.cached;
  if (!opts.force && pre && isFresh(pre.inputHash, pre.computedAt, state)) {
    return { ...pre.analysis, cached: true };
  }

  const brain = await gatherBrainContext(state);
  const analysis = await runAnalysis(state, brain.text, opts.userId ?? null);
  analysis.brainUsed = brain.used;

  // Persist cache (best-effort).
  try {
    await db.execute(sql`
      INSERT INTO quotation_analysis_cache (project_id, input_hash, payload, model, computed_at)
      VALUES (${state.projectId}::uuid, ${stateHash(state)}, ${JSON.stringify(analysis)}::jsonb, ${ANTHROPIC_MODELS.haiku}, now())
      ON CONFLICT (project_id) DO UPDATE
        SET input_hash = EXCLUDED.input_hash, payload = EXCLUDED.payload, model = EXCLUDED.model, computed_at = now()
    `);
  } catch (e) {
    console.error('[quotation-analysis cache]', e);
  }

  // Close the loop — index the conclusion back into the brain (best-effort).
  indexMemory({
    scope: 'project',
    scopeId: state.projectId,
    source: 'quotation_analysis',
    sourceId: state.projectId,
    content: `عرض سعر ${state.quoteNo ?? ''} للعميل ${state.clientName ?? ''}: ${analysis.headlineAr} — الإجراء: ${analysis.actionAr}`,
    contentLang: 'ar',
    metadata: { status: analysis.status, likelihood: analysis.likelihood },
  }).catch(() => {});

  return { ...analysis, cached: false };
}

async function gatherBrainContext(s: QuoteState): Promise<{ text: string; used: boolean }> {
  const parts: string[] = [];

  if (s.clientId) {
    try {
      const hits = await retrieveMemory({
        query: `عرض سعر متابعة ${s.title} ${s.clientName ?? ''}`,
        scope: 'client',
        scopeId: s.clientId,
        limit: 4,
        minSimilarity: 0.15,
      });
      for (const h of hits) parts.push(`• ${h.content.slice(0, 280)}`);
    } catch {
      /* brain optional */
    }
    try {
      const learnings = (await db.execute(sql`
        SELECT insight_ar FROM project_learnings
        WHERE scope = 'client' AND scope_id = ${s.clientId}::uuid AND active = true
        ORDER BY confidence DESC NULLS LAST LIMIT 4
      `)) as unknown as Array<{ insight_ar: string }>;
      for (const l of learnings) parts.push(`• درس: ${l.insight_ar}`);
    } catch {
      /* table optional */
    }
  }

  try {
    const conv = (await db.execute(sql`
      SELECT cs.summary_ar, cs.sentiment_trajectory, cs.outcome_status
      FROM conversation_summaries cs
      JOIN email_threads t ON t.id = cs.thread_id
      WHERE t.project_id = ${s.projectId}::uuid
      ORDER BY cs.summarized_at DESC LIMIT 1
    `)) as unknown as Array<{ summary_ar: string; sentiment_trajectory: string | null; outcome_status: string | null }>;
    if (conv[0]) {
      parts.push(`• ملخص المحادثة: ${conv[0].summary_ar} (الاتجاه: ${conv[0].sentiment_trajectory ?? '—'}، الحالة: ${conv[0].outcome_status ?? '—'})`);
    }
  } catch {
    /* optional */
  }

  return { text: parts.join('\n'), used: parts.length > 0 };
}

async function runAnalysis(s: QuoteState, brainText: string, userId: string | null): Promise<QuotationAnalysis> {
  const fallback: QuotationAnalysis = deterministicAnalysis(s);
  try {
    await assertAiBudget({ userId, feature: 'quotation_analysis' });
    const client = getAnthropic();
    const facts = [
      `العميل: ${s.clientName ?? '—'}`,
      `المشروع: ${s.title}`,
      `المرحلة: ${s.stage}`,
      `رقم العرض: ${s.quoteNo ?? '—'} · رقم الفاتورة: ${s.invoiceNo ?? 'لا يوجد (لم يتحوّل)'}`,
      `القيمة: ${s.valueSar ?? '—'} ر.س`,
      `أُرسل العرض: ${rel(s.quotedAt)} · آخر إيميل: ${rel(s.lastEmailAt)} · آخر رد من العميل: ${rel(s.lastInboundAt)} · آخر صادر مننا: ${rel(s.lastOutboundAt)}`,
    ].join('\n');

    const resp = await client.messages.create({
      model: ANTHROPIC_MODELS.haiku,
      max_tokens: 400,
      system: `أنت محلّل مبيعات في شركة إنتاج سعودية (Volt). تحلّل حالة عرض سعر بدقّة وتقترح خطوة عملية. استخدم سياق "الذاكرة" لو متاح ليكون تحليلك أدق. أخرج JSON صارم فقط:
{"status":"on_track|stalled|at_risk|no_client_response|ready_to_invoice","likelihood":"high|medium|low","headlineAr":"سطر واحد عن الحالة","actionAr":"خطوة متابعة عملية واحدة أو إلغاء","reasoningAr":"سبب قصير سطر واحد"}
status=ready_to_invoice لو المرحلة موافَق عليه/approved. status=no_client_response لو إحنا بعتنا وملوش رد. status=stalled لو مفيش حركة من فترة. لا تكتب أي شيء خارج الـ JSON.`,
      messages: [
        {
          role: 'user',
          content: `بيانات العرض:\n${facts}\n\n${brainText ? `سياق من الذاكرة عن العميل/المشروع:\n${brainText}` : 'لا يوجد سياق إضافي من الذاكرة.'}`,
        },
      ],
    });
    await recordUsage({ feature: 'quotation_analysis', model: ANTHROPIC_MODELS.haiku, inputTokens: resp.usage.input_tokens ?? 0, outputTokens: resp.usage.output_tokens ?? 0, userId });

    const block = resp.content.find((b) => b.type === 'text');
    let raw = (block && block.type === 'text' ? block.text : '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    const braced = raw.match(/\{[\s\S]*\}/);
    if (braced) raw = braced[0];
    const parsed = JSON.parse(raw) as Partial<QuotationAnalysis>;
    const status = (['on_track', 'stalled', 'at_risk', 'no_client_response', 'ready_to_invoice'] as const).includes(parsed.status as QuoteStatus)
      ? (parsed.status as QuoteStatus)
      : fallback.status;
    const likelihood = (['high', 'medium', 'low'] as const).includes(parsed.likelihood as 'high')
      ? (parsed.likelihood as 'high' | 'medium' | 'low')
      : fallback.likelihood;
    return {
      status,
      likelihood,
      headlineAr: (parsed.headlineAr || fallback.headlineAr).toString().slice(0, 160),
      actionAr: (parsed.actionAr || fallback.actionAr).toString().slice(0, 200),
      reasoningAr: (parsed.reasoningAr || fallback.reasoningAr).toString().slice(0, 200),
      brainUsed: false,
    };
  } catch {
    return fallback;
  }
}

/** Deterministic fallback when AI is unavailable / over-budget — still useful. */
function deterministicAnalysis(s: QuoteState): QuotationAnalysis {
  const stalledD = daysSince(s.lastEmailAt);
  const noInbound = daysSince(s.lastInboundAt);
  if (s.stage === 'approved') {
    return { status: 'ready_to_invoice', likelihood: 'high', headlineAr: 'موافَق عليه — جاهز لإصدار الفاتورة', actionAr: 'أصدر الفاتورة وحدّث رقمها', reasoningAr: 'المرحلة موافَق عليه ولم يُسجَّل رقم فاتورة بعد', brainUsed: false };
  }
  if (noInbound !== null && noInbound >= 7) {
    return { status: 'no_client_response', likelihood: 'low', headlineAr: `بدون رد من العميل منذ ${noInbound} يوم`, actionAr: 'تواصل مباشر، ولو مفيش رد فكّر في الإلغاء', reasoningAr: 'العميل لم يردّ منذ فترة طويلة', brainUsed: false };
  }
  if (stalledD !== null && stalledD >= 3) {
    return { status: 'stalled', likelihood: 'medium', headlineAr: `متوقّف منذ ${stalledD} يوم`, actionAr: 'أرسل متابعة للعميل لتأكيد العرض', reasoningAr: 'لا توجد حركة إيميل منذ ٣ أيام أو أكثر', brainUsed: false };
  }
  return { status: 'on_track', likelihood: 'medium', headlineAr: 'العرض حديث وعلى المسار', actionAr: 'تابِع طبيعي وانتظر رد العميل', reasoningAr: 'يوجد نشاط حديث على العرض', brainUsed: false };
}

function rel(iso: string | null): string {
  const d = daysSince(iso);
  if (d === null) return 'لا يوجد';
  if (d <= 0) return 'اليوم';
  if (d === 1) return 'أمس';
  return `منذ ${d} يوم`;
}
