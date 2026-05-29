/**
 * /admin/ai-insights — the AI learning-loop dashboard.
 *
 * Surfaces the feedback signals that are otherwise invisible: how often AI
 * suggestions are accepted (over time + per feature), the confidence
 * adjustments the system has learned (project_learnings), the most recent
 * decision outcomes (was the AI right?), and illegal state-transition attempts
 * that the state machine blocked.
 *
 * Read-only analytics. Gated `access.manage`. volt-os parity for
 * /admin/ai-test/feedback. All six source tables are empty on a clean DB, so
 * every section degrades to an EmptyState until the loop starts producing
 * signal.
 */
import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import {
  PageHeader,
  Card,
  CardHeader,
  StatBox,
  StatusPill,
  EmptyState,
} from '@antagna/ui';
import {
  Brain,
  ThumbsUp,
  TrendingUp,
  Lightbulb,
  ShieldAlert,
  Target,
  FileEdit,
  Sparkles,
} from 'lucide-react';
import { Shell } from '@/components/Shell';
import { requirePermission } from '@/lib/authz';
import { getCurrentProfile } from '@/lib/view-as';

export const dynamic = 'force-dynamic';

const rows = <T,>(r: unknown): T[] => r as unknown as T[];

// ── row shapes ────────────────────────────────────────────────────────────

interface OutcomeTotals {
  total: number;
  accepted: number;
  rejected: number;
  edited: number;
  ignored: number;
}

interface WeekRow {
  week: string; // YYYY-MM-DD (week start)
  total: number;
  accepted: number;
  edited: number;
}

interface FeatureRow {
  feature: string;
  total: number;
  accepted: number;
  edited: number;
  rejected: number;
  ignored: number;
}

interface LearningTypeRow {
  learningType: string;
  count: number;
  activeCount: number;
  validatedCount: number;
  rejectedCount: number;
  avgConfidence: number;
  avgSampleSize: number;
}

interface LearningRow {
  id: string;
  scope: string;
  learningType: string;
  insightAr: string;
  confidence: number;
  sampleSize: number;
  active: boolean;
  validatedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
}

interface DecisionRow {
  id: string;
  decisionType: string;
  decisionBy: string;
  decisionMadeAt: string;
  outcomeMeasuredAt: string | null;
  outcomeLabel: string | null;
}

interface IllegalTypeRow {
  entityType: string;
  total: number;
  illegal: number;
}

interface TransitionRow {
  id: string;
  entityType: string;
  fromState: string | null;
  toState: string;
  reason: string | null;
  illegalTransition: boolean;
  createdAt: string;
  actor: string | null;
}

interface TemplateEditRow {
  templateKey: string;
  fieldEdited: string | null;
  edits: number;
}

// ── helpers ─────────────────────────────────────────────────────────────

const pct = (num: number, den: number) =>
  den > 0 ? Math.round((num / den) * 100) : 0;

const fmtDate = (ts: string | null) =>
  ts ? new Date(ts).toISOString().slice(0, 10) : '—';

function acceptanceTone(rate: number): 'success' | 'warning' | 'danger' | 'default' {
  if (rate >= 75) return 'success';
  if (rate >= 50) return 'warning';
  if (rate > 0) return 'danger';
  return 'default';
}

const OUTCOME_LABEL_AR: Record<string, string> = {
  accepted: 'مقبول',
  rejected: 'مرفوض',
  edited: 'مُعدّل',
  ignored: 'متجاهَل',
};

const OUTCOME_TONE: Record<string, 'success' | 'danger' | 'info' | 'neutral'> = {
  accepted: 'success',
  rejected: 'danger',
  edited: 'info',
  ignored: 'neutral',
};

function outcomeTone(label: string | null): 'success' | 'danger' | 'warning' | 'neutral' {
  if (!label) return 'neutral';
  const l = label.toLowerCase();
  if (/(good|success|correct|right|win|positive|نجاح|صحيح|إيجابي)/.test(l)) return 'success';
  if (/(bad|fail|wrong|miss|loss|negative|فشل|خطأ|سلبي)/.test(l)) return 'danger';
  if (/(partial|mixed|neutral|جزئي|محايد)/.test(l)) return 'warning';
  return 'neutral';
}

export default async function AiInsightsPage() {
  await requirePermission('access.manage');
  const me = await getCurrentProfile();

  const [
    totalsR,
    weeklyR,
    byFeatureR,
    learningTypesR,
    recentLearningsR,
    decisionStatsR,
    recentDecisionsR,
    illegalByTypeR,
    recentTransitionsR,
    templateEditsR,
  ] = await Promise.all([
    // 1. Overall outcome totals (all time).
    db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE outcome = 'accepted')::int AS accepted,
        COUNT(*) FILTER (WHERE outcome = 'rejected')::int AS rejected,
        COUNT(*) FILTER (WHERE outcome = 'edited')::int   AS edited,
        COUNT(*) FILTER (WHERE outcome = 'ignored')::int  AS ignored
      FROM ai_action_log
    `),
    // 2. Acceptance over time — last 12 weeks.
    db.execute(sql`
      SELECT
        to_char(date_trunc('week', created_at), 'YYYY-MM-DD') AS week,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE outcome = 'accepted')::int AS accepted,
        COUNT(*) FILTER (WHERE outcome = 'edited')::int   AS edited
      FROM ai_action_log
      WHERE created_at >= now() - interval '12 weeks'
      GROUP BY 1
      ORDER BY 1
    `),
    // 3. Acceptance per feature.
    db.execute(sql`
      SELECT
        feature,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE outcome = 'accepted')::int AS accepted,
        COUNT(*) FILTER (WHERE outcome = 'edited')::int   AS edited,
        COUNT(*) FILTER (WHERE outcome = 'rejected')::int AS rejected,
        COUNT(*) FILTER (WHERE outcome = 'ignored')::int  AS ignored
      FROM ai_action_log
      GROUP BY feature
      ORDER BY total DESC
    `),
    // 4. Learned confidence adjustments — per learning_type.
    db.execute(sql`
      SELECT
        learning_type AS "learningType",
        COUNT(*)::int AS count,
        COUNT(*) FILTER (WHERE active)::int AS "activeCount",
        COUNT(*) FILTER (WHERE validated_at IS NOT NULL)::int AS "validatedCount",
        COUNT(*) FILTER (WHERE rejected_at IS NOT NULL)::int AS "rejectedCount",
        COALESCE(AVG(confidence), 0)::float8 AS "avgConfidence",
        COALESCE(AVG(sample_size), 0)::float8 AS "avgSampleSize"
      FROM project_learnings
      GROUP BY learning_type
      ORDER BY count DESC
    `),
    // 5. Most recent learnings.
    db.execute(sql`
      SELECT
        id::text AS id, scope, learning_type AS "learningType",
        insight_ar AS "insightAr", confidence::float8 AS confidence,
        sample_size AS "sampleSize", active,
        validated_at AS "validatedAt", rejected_at AS "rejectedAt",
        created_at AS "createdAt"
      FROM project_learnings
      ORDER BY created_at DESC
      LIMIT 20
    `),
    // 6. Decision outcome stats.
    db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE outcome_measured_at IS NOT NULL)::int AS measured
      FROM decision_outcomes
    `),
    // 7. Recent decision outcomes.
    db.execute(sql`
      SELECT
        id::text AS id, decision_type AS "decisionType",
        decision_by AS "decisionBy", decision_made_at AS "decisionMadeAt",
        outcome_measured_at AS "outcomeMeasuredAt", outcome_label AS "outcomeLabel"
      FROM decision_outcomes
      ORDER BY decision_made_at DESC
      LIMIT 20
    `),
    // 8. Illegal transitions by entity type.
    db.execute(sql`
      SELECT
        entity_type AS "entityType",
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE illegal_transition)::int AS illegal
      FROM state_transition_overrides
      GROUP BY entity_type
      ORDER BY illegal DESC, total DESC
    `),
    // 9. Recent (illegal-first) transition attempts.
    db.execute(sql`
      SELECT
        o.id::text AS id, o.entity_type AS "entityType",
        o.from_state AS "fromState", o.to_state AS "toState",
        o.reason, o.illegal_transition AS "illegalTransition",
        o.created_at AS "createdAt", p.display_name AS actor
      FROM state_transition_overrides o
      LEFT JOIN profiles p ON p.id = o.by_profile_id
      ORDER BY o.illegal_transition DESC, o.created_at DESC
      LIMIT 25
    `),
    // 10. Template edit patterns (which template fields humans rewrite most).
    db.execute(sql`
      SELECT
        template_key AS "templateKey", field_edited AS "fieldEdited",
        COUNT(*)::int AS edits
      FROM template_edit_patterns
      GROUP BY template_key, field_edited
      ORDER BY edits DESC
      LIMIT 15
    `),
  ]);

  const totals = rows<OutcomeTotals>(totalsR)[0] ?? {
    total: 0, accepted: 0, rejected: 0, edited: 0, ignored: 0,
  };
  const weekly = rows<WeekRow>(weeklyR);
  const byFeature = rows<FeatureRow>(byFeatureR);
  const learningTypes = rows<LearningTypeRow>(learningTypesR);
  const recentLearnings = rows<LearningRow>(recentLearningsR);
  const decisionStats = rows<{ total: number; measured: number }>(decisionStatsR)[0] ?? { total: 0, measured: 0 };
  const recentDecisions = rows<DecisionRow>(recentDecisionsR);
  const illegalByType = rows<IllegalTypeRow>(illegalByTypeR);
  const recentTransitions = rows<TransitionRow>(recentTransitionsR);
  const templateEdits = rows<TemplateEditRow>(templateEditsR);

  // Top-line acceptance: accepted + edited both count as "AI was useful".
  const usefulCount = totals.accepted + totals.edited;
  const acceptanceRate = pct(usefulCount, totals.total);
  const strictAcceptRate = pct(totals.accepted, totals.total);
  const activeLearnings = learningTypes.reduce((s, t) => s + t.activeCount, 0);
  const totalIllegal = illegalByType.reduce((s, t) => s + t.illegal, 0);
  const weekMax = Math.max(1, ...weekly.map((w) => w.total));

  const hasAnySignal =
    totals.total > 0 ||
    learningTypes.length > 0 ||
    decisionStats.total > 0 ||
    illegalByType.length > 0;

  return (
    <Shell user={{ email: me?.email ?? '' }} activePath="/admin">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
      >
        ← الإدارة
      </Link>

      <PageHeader
        eyebrow="AI · حلقة التعلّم"
        title="رؤى الذكاء الاصطناعي"
        subtitle="معدّل قبول اقتراحات الـ AI، تعديلات الثقة المُكتسبة، نتائج القرارات، ومحاولات الانتقال غير المسموح بها."
      />

      {!hasAnySignal && (
        <Card className="border-[var(--accent)]/30 bg-[var(--accent)]/[0.03]">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 shrink-0 text-[var(--accent)]" size={18} />
            <div>
              <p className="text-sm font-medium text-[var(--text)]">
                حلقة التعلّم لسّه ما اشتغلتش
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                هتتعبّى الجداول تلقائيًا أول ما يبدأ الفريق يقبل/يعدّل/يرفض اقتراحات الـ AI،
                ويسجّل النظام نتائج القرارات ومحاولات تغيير الحالة. كل القياسات أدناه
                للقراءة فقط.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* ── Top-line KPIs ──────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatBox
          label="معدّل القبول"
          value={acceptanceRate}
          format={`${acceptanceRate}%`}
          icon={<ThumbsUp size={16} />}
          tone={acceptanceTone(acceptanceRate)}
          sub={`${usefulCount} مفيد من ${totals.total} · قبول صرف ${strictAcceptRate}%`}
        />
        <StatBox
          label="إشارات الجودة"
          value={totals.total}
          icon={<Brain size={16} />}
          sub="ai_action_log (كل الوقت)"
        />
        <StatBox
          label="دروس نشطة"
          value={activeLearnings}
          icon={<Lightbulb size={16} />}
          tone={activeLearnings > 0 ? 'accent' : 'default'}
          sub={`${learningTypes.length} نوع · project_learnings`}
        />
        <StatBox
          label="انتقالات غير مسموحة"
          value={totalIllegal}
          icon={<ShieldAlert size={16} />}
          tone={totalIllegal > 0 ? 'danger' : 'default'}
          sub="حجبتها آلة الحالة"
        />
      </section>

      {/* ── Acceptance over time ───────────────────────────────────────── */}
      <Card padded={false}>
        <div className="p-6 pb-4">
          <CardHeader
            title="معدّل القبول عبر الزمن"
            subtitle="آخر 12 أسبوع · مقبول + مُعدّل = مفيد"
          />
        </div>
        {weekly.length === 0 ? (
          <EmptyState
            icon={<TrendingUp size={20} />}
            title="لا بيانات قبول بعد"
            description="بمجرد ما يتفاعل الفريق مع اقتراحات الـ AI، هيظهر الاتجاه الأسبوعي هنا."
          />
        ) : (
          <ul className="space-y-3 px-6 pb-6">
            {weekly.map((w) => {
              const useful = w.accepted + w.edited;
              const rate = pct(useful, w.total);
              const barPct = Math.max(2, Math.round((w.total / weekMax) * 100));
              const acceptPart = w.total > 0 ? Math.round((w.accepted / w.total) * barPct) : 0;
              const editPart = w.total > 0 ? Math.round((w.edited / w.total) * barPct) : 0;
              return (
                <li key={w.week} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-[var(--text-muted)]">{w.week}</span>
                    <span className="text-[var(--text)]">
                      <span className={acceptanceTone(rate) === 'success' ? 'text-[var(--success)]' : acceptanceTone(rate) === 'danger' ? 'text-[var(--danger)]' : 'text-[var(--text)]'}>
                        {rate}%
                      </span>{' '}
                      <span className="text-[var(--text-dim)]">· {useful}/{w.total}</span>
                    </span>
                  </div>
                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-[var(--surface-hover)]">
                    <div
                      className="h-full bg-[var(--success)]"
                      style={{ width: `${acceptPart}%` }}
                      title={`${w.accepted} مقبول`}
                    />
                    <div
                      className="h-full bg-[var(--accent)]"
                      style={{ width: `${editPart}%` }}
                      title={`${w.edited} مُعدّل`}
                    />
                  </div>
                </li>
              );
            })}
            <li className="flex items-center gap-4 pt-1 text-[11px] text-[var(--text-dim)]">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[var(--success)]" /> مقبول
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[var(--accent)]" /> مُعدّل
              </span>
            </li>
          </ul>
        )}
      </Card>

      {/* ── Acceptance per feature ─────────────────────────────────────── */}
      <Card padded={false}>
        <div className="p-6 pb-4">
          <CardHeader title="القبول حسب الميزة" subtitle="أين يثق الفريق بالـ AI وأين يتجاهله" />
        </div>
        {byFeature.length === 0 ? (
          <EmptyState
            icon={<Target size={20} />}
            title="لا إشارات لكل ميزة"
            description="كل ميزة AI (تلخيص، صياغة بريد، اقتراح مهمة…) هتجمّع معدّل القبول الخاص بها."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-[var(--line)] bg-[var(--bg-elevated)]/40 text-start text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-dim)]">
                  <th className="px-5 py-3 text-start">الميزة</th>
                  <th className="px-5 py-3 text-start">القبول</th>
                  <th className="px-5 py-3 text-start">الإجمالي</th>
                  <th className="px-5 py-3 text-start">مقبول</th>
                  <th className="px-5 py-3 text-start">مُعدّل</th>
                  <th className="px-5 py-3 text-start">مرفوض</th>
                  <th className="px-5 py-3 text-start">متجاهَل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {byFeature.map((f) => {
                  const useful = f.accepted + f.edited;
                  const rate = pct(useful, f.total);
                  const tone = acceptanceTone(rate);
                  return (
                    <tr key={f.feature} className="hover:bg-[var(--surface-hover)]">
                      <td className="px-5 py-3 font-mono text-xs text-[var(--text)]">{f.feature}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--surface-hover)]">
                            <div
                              className={
                                'h-full rounded-full ' +
                                (tone === 'success'
                                  ? 'bg-[var(--success)]'
                                  : tone === 'warning'
                                    ? 'bg-[var(--warning)]'
                                    : tone === 'danger'
                                      ? 'bg-[var(--danger)]'
                                      : 'bg-[var(--text-dim)]')
                              }
                              style={{ width: `${rate}%` }}
                            />
                          </div>
                          <span
                            className={
                              'font-mono text-xs ' +
                              (tone === 'success'
                                ? 'text-[var(--success)]'
                                : tone === 'danger'
                                  ? 'text-[var(--danger)]'
                                  : 'text-[var(--text-muted)]')
                            }
                          >
                            {rate}%
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-[var(--text-dim)]">{f.total}</td>
                      <td className="px-5 py-3 font-mono text-xs text-[var(--success)]">{f.accepted}</td>
                      <td className="px-5 py-3 font-mono text-xs text-[var(--text-muted)]">{f.edited}</td>
                      <td className="px-5 py-3 font-mono text-xs text-[var(--danger)]">{f.rejected}</td>
                      <td className="px-5 py-3 font-mono text-xs text-[var(--text-dim)]">{f.ignored}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Learned confidence adjustments ─────────────────────────────── */}
      <Card padded={false}>
        <div className="p-6 pb-4">
          <CardHeader
            title="تعديلات الثقة المُكتسبة"
            subtitle="ما تعلّمه النظام لكل نوع — متوسّط الثقة وحجم العيّنة"
          />
        </div>
        {learningTypes.length === 0 ? (
          <EmptyState
            icon={<Lightbulb size={20} />}
            title="لا دروس مُكتسبة"
            description="هيستخلص النظام أنماطًا متكرّرة من المشاريع (عميل، موقع، طاقم…) ويسجّل ثقته فيها."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-[var(--line)] bg-[var(--bg-elevated)]/40 text-start text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-dim)]">
                  <th className="px-5 py-3 text-start">النوع</th>
                  <th className="px-5 py-3 text-start">متوسّط الثقة</th>
                  <th className="px-5 py-3 text-start">متوسّط العيّنة</th>
                  <th className="px-5 py-3 text-start">نشط</th>
                  <th className="px-5 py-3 text-start">مُوثّق</th>
                  <th className="px-5 py-3 text-start">مرفوض</th>
                  <th className="px-5 py-3 text-start">الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {learningTypes.map((t) => {
                  const conf = Math.round(t.avgConfidence * 100);
                  return (
                    <tr key={t.learningType} className="hover:bg-[var(--surface-hover)]">
                      <td className="px-5 py-3 font-mono text-xs text-[var(--text)]">{t.learningType}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--surface-hover)]">
                            <div
                              className="h-full rounded-full bg-[var(--accent)]"
                              style={{ width: `${conf}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs text-[var(--text-muted)]">{conf}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-[var(--text-dim)]">
                        {t.avgSampleSize.toFixed(1)}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-[var(--text)]">{t.activeCount}</td>
                      <td className="px-5 py-3 font-mono text-xs text-[var(--success)]">{t.validatedCount}</td>
                      <td className="px-5 py-3 font-mono text-xs text-[var(--danger)]">{t.rejectedCount}</td>
                      <td className="px-5 py-3 font-mono text-xs text-[var(--text-dim)]">{t.count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Recent learnings list ──────────────────────────────────────── */}
      {recentLearnings.length > 0 && (
        <Card padded={false}>
          <div className="p-6 pb-4">
            <CardHeader title="أحدث الدروس" subtitle={`${recentLearnings.length} درس`} />
          </div>
          <ul className="divide-y divide-[var(--line)]">
            {recentLearnings.map((l) => {
              const tone = l.rejectedAt ? 'danger' : l.validatedAt ? 'success' : l.active ? 'info' : 'neutral';
              const stateLabel = l.rejectedAt ? 'مرفوض' : l.validatedAt ? 'مُوثّق' : l.active ? 'نشط' : 'خامل';
              return (
                <li key={l.id} className="flex items-start justify-between gap-3 px-6 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill tone="neutral" withDot={false}>{l.scope}</StatusPill>
                      <span className="font-mono text-[10px] text-[var(--text-dim)]">{l.learningType}</span>
                      <StatusPill tone={tone} withDot={false}>{stateLabel}</StatusPill>
                    </div>
                    <p className="mt-1.5 text-sm text-[var(--text)]">{l.insightAr}</p>
                  </div>
                  <div className="shrink-0 text-end">
                    <p className="font-mono text-xs text-[var(--text-muted)]">
                      {Math.round(l.confidence * 100)}%
                    </p>
                    <p className="text-[10px] text-[var(--text-dim)]">n={l.sampleSize}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-[var(--text-dim)]">{fmtDate(l.createdAt)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* ── Recent decision outcomes ───────────────────────────────────── */}
      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 p-6 pb-4">
          <CardHeader
            title="نتائج القرارات الأخيرة"
            subtitle="هل كان الـ AI على حق؟ — تتبّع القرار حتى نتيجته"
          />
          {decisionStats.total > 0 && (
            <StatusPill tone="info" withDot={false}>
              {decisionStats.measured}/{decisionStats.total} مُقاس
            </StatusPill>
          )}
        </div>
        {recentDecisions.length === 0 ? (
          <EmptyState
            icon={<Target size={20} />}
            title="لا قرارات مُسجّلة"
            description="كل قرار يدعمه الـ AI (تسعير، توزيع طاقم، جدولة…) هيُسجّل هنا مع نتيجته لاحقًا."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-[var(--line)] bg-[var(--bg-elevated)]/40 text-start text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-dim)]">
                  <th className="px-5 py-3 text-start">نوع القرار</th>
                  <th className="px-5 py-3 text-start">بواسطة</th>
                  <th className="px-5 py-3 text-start">اتُّخذ</th>
                  <th className="px-5 py-3 text-start">النتيجة</th>
                  <th className="px-5 py-3 text-start">قِيست</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {recentDecisions.map((d) => (
                  <tr key={d.id} className="hover:bg-[var(--surface-hover)]">
                    <td className="px-5 py-3 font-mono text-xs text-[var(--text)]">{d.decisionType}</td>
                    <td className="px-5 py-3 text-xs text-[var(--text-muted)]">{d.decisionBy}</td>
                    <td className="px-5 py-3 font-mono text-xs text-[var(--text-dim)]">{fmtDate(d.decisionMadeAt)}</td>
                    <td className="px-5 py-3">
                      {d.outcomeLabel ? (
                        <StatusPill tone={outcomeTone(d.outcomeLabel)} withDot={false}>
                          {d.outcomeLabel}
                        </StatusPill>
                      ) : (
                        <StatusPill tone="neutral" withDot={false}>بانتظار القياس</StatusPill>
                      )}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-[var(--text-dim)]">{fmtDate(d.outcomeMeasuredAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Illegal state-transition attempts ──────────────────────────── */}
      <Card padded={false}>
        <div className="p-6 pb-4">
          <CardHeader
            title="محاولات الانتقال غير المسموح بها"
            subtitle="تغييرات الحالة التي رفضتها آلة الحالة — مؤشّر على فجوات في العمليات أو الـ UI"
          />
        </div>
        {illegalByType.length > 0 && (
          <div className="flex flex-wrap gap-2 px-6 pb-4">
            {illegalByType.map((t) => (
              <StatusPill
                key={t.entityType}
                tone={t.illegal > 0 ? 'danger' : 'neutral'}
                withDot={false}
              >
                {t.entityType}: {t.illegal}/{t.total}
              </StatusPill>
            ))}
          </div>
        )}
        {recentTransitions.length === 0 ? (
          <EmptyState
            icon={<ShieldAlert size={20} />}
            title="لا محاولات مُسجّلة"
            description="ممتاز — ما فيش أحد حاول يقفز خطوة في دورة حياة مشروع أو معدّة بشكل غير مسموح."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-[var(--line)] bg-[var(--bg-elevated)]/40 text-start text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-dim)]">
                  <th className="px-5 py-3 text-start">الكيان</th>
                  <th className="px-5 py-3 text-start">من</th>
                  <th className="px-5 py-3 text-start">إلى</th>
                  <th className="px-5 py-3 text-start">الحالة</th>
                  <th className="px-5 py-3 text-start">بواسطة</th>
                  <th className="px-5 py-3 text-start">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {recentTransitions.map((tr) => (
                  <tr key={tr.id} className="hover:bg-[var(--surface-hover)]">
                    <td className="px-5 py-3 font-mono text-xs text-[var(--text)]">{tr.entityType}</td>
                    <td className="px-5 py-3 font-mono text-xs text-[var(--text-dim)]">{tr.fromState ?? '—'}</td>
                    <td className="px-5 py-3 font-mono text-xs text-[var(--text-muted)]">{tr.toState}</td>
                    <td className="px-5 py-3">
                      <StatusPill tone={tr.illegalTransition ? 'danger' : 'success'} withDot={false}>
                        {tr.illegalTransition ? 'غير مسموح' : 'مسموح'}
                      </StatusPill>
                    </td>
                    <td className="px-5 py-3 text-xs text-[var(--text-muted)]">{tr.actor ?? '—'}</td>
                    <td className="px-5 py-3 font-mono text-xs text-[var(--text-dim)]">{fmtDate(tr.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Template edit patterns ─────────────────────────────────────── */}
      <Card padded={false}>
        <div className="p-6 pb-4">
          <CardHeader
            title="أنماط تحرير القوالب"
            subtitle="أي حقول قوالب البريد يعيد الفريق صياغتها أكثر — مرشّح لتحسين القالب"
          />
        </div>
        {templateEdits.length === 0 ? (
          <EmptyState
            icon={<FileEdit size={20} />}
            title="لا تعديلات على القوالب"
            description="بمجرد ما يعدّل الفريق مسودّات البريد المولّدة، هتظهر الحقول الأكثر تحريرًا هنا."
          />
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {templateEdits.map((e, i) => (
              <li key={`${e.templateKey}-${e.fieldEdited}-${i}`} className="flex items-center justify-between gap-3 px-6 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-[var(--text)]">{e.templateKey}</span>
                  {e.fieldEdited && (
                    <StatusPill tone="info" withDot={false}>{e.fieldEdited}</StatusPill>
                  )}
                </div>
                <span className="font-mono text-xs text-[var(--text-muted)]">
                  {e.edits} تعديل
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Shell>
  );
}
