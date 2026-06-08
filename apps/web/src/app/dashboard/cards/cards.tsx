/**
 * The card library — 28 AI-aware widgets (+ a compact KPI glance card).
 *
 * Cards that the production dashboard wires to Supabase accept an optional
 * `data` prop; when it's missing they render built-in sample content. That
 * keeps the preview labs (which pass no data) rendering a full showcase
 * while production passes real rows. Cards with no real data source yet
 * always render their sample and simply aren't in the default layout.
 *
 * AI levels:
 *   heavy   — the card is mostly AI output (suggestions, drafts, predictions)
 *   medium  — AI enriches existing data (scores, projections, sentiment)
 *   light   — AI labels a metric or highlights items
 *   none    — pure data, no AI
 */
import Link from 'next/link';
import {
  Sparkles, Mail, Brain, Briefcase, Camera, Activity, Flame, Reply,
  ShieldCheck, AlertTriangle, DollarSign, Workflow, TrendingUp, Users,
  MessageSquare, ListChecks, Clock, Battery, Zap, Lightbulb, CheckCircle2,
  FileText, Layers, Send, ChevronRight,
} from 'lucide-react';
import { Card, AIBadge } from './shell';
import { toAr, type CardSize } from './utils';
import { CountUp } from './count-up';
import type {
  EmailTriageData, SuggestionsData, ProjectHealthData, AtRiskData,
  StaleConvosData, CapacityData, ShootsData, RevenueData, ApprovalsData,
  ConflictsData, GlanceData,
} from './types';

export { Card, AIBadge };

type CardProps = { size?: CardSize; editable?: boolean };

/** Render a row as a link when an href is present, otherwise a plain element. */
function MaybeLink({
  href, className, children,
}: { href?: string; className?: string; children: React.ReactNode }) {
  if (href) return <Link href={href} className={className}>{children}</Link>;
  return <div className={className}>{children}</div>;
}

// ════════════════════════════════════════════════════════════════════════
// 28 CARD COMPONENTS
// ════════════════════════════════════════════════════════════════════════

// 01 — AI Daily Brief (HEAVY) — 3 ranked priorities
export function CardAIBrief({ size = 'lg', editable }: CardProps) {
  return (
    <Card title="// ai_daily_brief" ai="heavy" size={size} editable={editable} footer={
      <>
        <Sparkles size={9} className="text-[#FF6B1A]" />
        <span>محدّث منذ 4د</span>
        <span className="ms-auto cursor-pointer text-[#FF6B1A] hover:underline">جدّد</span>
      </>
    }>
      <p className="mb-3 text-[15px] font-semibold leading-snug text-white">
        يوم ضغط على التسليم — رولز رويس متأخر، خالد فوق سقف الحمولة.
      </p>
      <ol className="space-y-2.5">
        {[
          ['01', 'رولز رويس: تسليم ٣ أيام، إنجاز ٤٥٪. راجع الفريق.', true],
          ['02', 'إيميل BMW متأخر ٥٢س — الـ draft جاهز.', false],
          ['03', 'وزّع MG لـ فادي قبل الإثنين.', false],
        ].map(([num, text, urgent]) => (
          <li key={num as string} className="grid grid-cols-[20px_1fr] gap-2 text-[12px]">
            <span className={'font-mono ' + ((urgent as boolean) ? 'text-[#FF6B1A]' : 'text-white/35')}>
              {num as string}
            </span>
            <span className="leading-snug text-white/85">{text as string}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

// 02 — At-Risk Projects (HEAVY) — AI predicts which projects might miss
const SAMPLE_AT_RISK: AtRiskData = {
  confidence: 84,
  items: [
    { name: 'رولز رويس', score: 92, why: 'تأخر التسليم' },
    { name: 'BMW Summer', score: 67, why: 'فريق محمّل' },
    { name: 'لكزس LX', score: 48, why: 'بريف ناقص' },
  ],
};
export function CardAtRisk({ size = 'md', editable, data }: CardProps & { data?: AtRiskData }) {
  const d = data ?? SAMPLE_AT_RISK;
  return (
    <Card title="// at_risk · ai prediction" ai="heavy" size={size} editable={editable}
      footer={<><Brain size={9} /><span>AI confidence: {d.confidence != null ? `${toAr(d.confidence)}٪` : '—'}</span></>}>
      {d.items.length === 0 ? (
        <p className="py-2 text-[11px] text-white/45">لا مشاريع تحتاج انتباه الآن ✓</p>
      ) : (
        <ul className="space-y-2.5">
          {d.items.map((it) => (
            <li key={it.name} className="space-y-1">
              <div className="flex items-center justify-between">
                <MaybeLink href={it.href} className="text-[12px] text-white hover:text-[#FF6B1A]">{it.name}</MaybeLink>
                <span className="font-mono text-[11px] font-semibold text-[#FF6B1A]">{toAr(it.score)}٪</span>
              </div>
              <div className="h-0.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full bg-[#FF6B1A]" style={{ width: `${it.score}%` }} />
              </div>
              <p className="text-[10px] text-white/45">↳ {it.why}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// 03 — Hot Leads (HEAVY) — AI ranked by conversion likelihood
export function CardHotLeads({ size = 'md', editable }: CardProps) {
  return (
    <Card title="// hot_leads · call today" ai="heavy" size={size} editable={editable} footer={<><Flame size={9} className="text-[#FF6B1A]" /><span>٤ leads ساخنة</span></>}>
      <ul className="divide-y divide-white/[0.05]">
        {[
          ['تويوتا الجزيرة', 'احتمال 86٪', 'برِيف واضح + ميزانية مذكورة'],
          ['نيسان السعودية', 'احتمال 71٪', 'رد إيجابي على العرض'],
          ['Mazda KSA', 'احتمال 65٪', 'طلب مرجع'],
        ].map(([name, score, reason]) => (
          <li key={name as string} className="flex items-start gap-2 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] text-white">{name as string}</p>
              <p className="mt-0.5 text-[10px] text-white/45">{reason as string}</p>
            </div>
            <span className="shrink-0 font-mono text-[10px] text-[#FF6B1A]">{score as string}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// 04 — Smart Suggestions Queue (HEAVY)
const SAMPLE_SUGGESTIONS: SuggestionsData = {
  pending: 7,
  items: [
    { type: 'create_client', text: 'عميل جديد: شركة Toyota الجزيرة', confidence: 89 },
    { type: 'link_thread', text: 'ربط 4 إيميلات بـ PRJ-0006', confidence: 76 },
    { type: 'create_task', text: 'مهمة: اتصال بـ BMW السعودية', confidence: 71 },
    { type: 'escalate', text: 'محادثة معلقة منذ 6 أيام', confidence: 65 },
  ],
};
export function CardSmartSuggestions({ size = 'md', editable, data }: CardProps & { data?: SuggestionsData }) {
  const d = data ?? SAMPLE_SUGGESTIONS;
  return (
    <Card title="// ai_suggestions" ai="heavy" size={size} editable={editable}
      footer={<><Sparkles size={9} className="text-[#FF6B1A]" /><span>{toAr(d.pending)} بانتظار مراجعتك</span><Link href="/inbox/suggestions" className="ms-auto cursor-pointer hover:underline">راجع الكل →</Link></>}>
      {d.items.length === 0 ? (
        <p className="py-2 text-[11px] text-white/45">لا اقتراحات معلّقة. عند وصول إيميلات جديدة، سيقترح الـ AI إجراءات.</p>
      ) : (
        <ul className="space-y-2">
          {d.items.map((it) => (
            <li key={it.text} className="flex items-center gap-2 rounded-md border border-white/[0.05] bg-[#0F0F12] px-2.5 py-1.5">
              <span className="font-mono text-[8.5px] uppercase tracking-wider text-[#FF6B1A]">{it.type}</span>
              <span className="flex-1 truncate text-[11px] text-white/85">{it.text}</span>
              <span className="font-mono text-[10px] text-white/45">{toAr(it.confidence)}٪</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// 05 — Email Triage (HEAVY)
const SAMPLE_TRIAGE: EmailTriageData = {
  awaitingOurReply: 8,
  urgent: 2,
  items: [
    { who: 'BMW السعودية', what: 'الـ draft جاهز · 52س متأخر', priority: 'critical' },
    { who: 'تويوتا الجزيرة', what: 'يستفسر عن العرض', priority: 'high' },
    { who: 'لكزس', what: 'ملاحظة على آخر cut', priority: 'med' },
    { who: 'Rolls Royce', what: 'تأكيد التسليم', priority: 'med' },
  ],
};
export function CardEmailTriage({ size = 'md', editable, data }: CardProps & { data?: EmailTriageData }) {
  const d = data ?? SAMPLE_TRIAGE;
  return (
    <Card title="// email_triage" ai="heavy" size={size} editable={editable}
      footer={<><Mail size={9} /><span>{toAr(d.awaitingOurReply)} ينتظر ردنا · {toAr(d.urgent)} urgent</span></>}>
      {d.items.length === 0 ? (
        <p className="py-2 text-[11px] text-white/45">لا إيميلات تنتظر ردك ✓</p>
      ) : (
        <ul className="space-y-1.5">
          {d.items.map((it) => (
            <li key={it.who + it.what} className="flex items-center gap-2 text-[11.5px]">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{
                  background:
                    it.priority === 'critical' ? '#FF6B1A'
                      : it.priority === 'high' ? 'rgba(255,255,255,0.75)'
                        : 'rgba(255,255,255,0.35)',
                }}
              />
              <MaybeLink href={it.href} className="shrink-0 text-white">{it.who}</MaybeLink>
              <span className="text-white/45">·</span>
              <span className="truncate text-white/55">{it.what}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// 06 — Suggested Next Actions (HEAVY)
export function CardNextActions({ size = 'md', editable }: CardProps) {
  return (
    <Card title="// do_these_now" ai="heavy" size={size} editable={editable} footer={<><Zap size={9} className="text-[#FF6B1A]" /><span>AI اختارها بناءً على وقتك الحالي</span></>}>
      <ul className="space-y-2">
        {[
          ['اتصل بـ Toyota الجزيرة', '12 دقيقة', '#FF6B1A'],
          ['وافق على Reel 7 من ريم', '2 دقيقة', 'rgba(255,255,255,0.75)'],
          ['أعد توزيع MG لـ فادي', '5 دقائق', 'rgba(255,255,255,0.55)'],
        ].map(([action, time, color]) => (
          <li key={action as string} className="flex items-center gap-2.5 rounded-md border border-white/[0.05] bg-[#0F0F12] px-2.5 py-2">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: color as string }} />
            <span className="flex-1 text-[12px] text-white/90">{action as string}</span>
            <span className="font-mono text-[10px] text-white/45">{time as string}</span>
            <ChevronRight size={11} className="text-white/35 rtl:rotate-180" />
          </li>
        ))}
      </ul>
    </Card>
  );
}

// 07 — Project Health Pulse (HEAVY)
const SAMPLE_HEALTH: ProjectHealthData = {
  analyzed: 12,
  items: [
    { name: 'رولز رويس — الشوروم', health: 'red', why: 'تأخر + capacity issue', pct: 45 },
    { name: 'BMW Summer', health: 'amber', why: 'إنجاز جيد بس thread معلق', pct: 78 },
    { name: 'Rolls Royce interior', health: 'green', why: 'في المسار', pct: 92 },
    { name: 'لكزس LX', health: 'amber', why: 'بريف ناقص', pct: 12 },
  ],
};
export function CardProjectHealth({ size = 'lg', editable, data }: CardProps & { data?: ProjectHealthData }) {
  const d = data ?? SAMPLE_HEALTH;
  return (
    <Card title="// project_health" ai="heavy" size={size} editable={editable}
      footer={<><Activity size={9} /><span>تم تحليل {toAr(d.analyzed)} مشروع نشط</span></>}>
      {d.items.length === 0 ? (
        <p className="py-2 text-[11px] text-white/45">لا مشاريع نشطة الآن.</p>
      ) : (
        <ul className="space-y-2">
          {d.items.map((it) => (
            <li key={it.name} className="grid grid-cols-[8px_1fr_80px_40px] items-center gap-2.5 text-[11.5px]">
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  background:
                    it.health === 'red' ? '#FF6B1A'
                      : it.health === 'amber' ? 'rgba(255,255,255,0.6)'
                        : 'rgba(255,255,255,0.35)',
                }}
              />
              <MaybeLink href={it.href} className="truncate text-white hover:text-[#FF6B1A]">{it.name}</MaybeLink>
              <span className="truncate text-[10px] text-white/55">{it.why}</span>
              <span className="text-end font-mono text-[10px] text-white/55">{toAr(it.pct)}٪</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// 08 — Approval Bottleneck (HEAVY)
export function CardBottleneck({ size = 'md', editable }: CardProps) {
  return (
    <Card title="// bottleneck" ai="heavy" size={size} editable={editable} footer={<><Workflow size={9} /><span>AI حلل آخر ٣٠ يوم</span></>}>
      <p className="text-[11px] text-white/45">المرحلة الأبطأ:</p>
      <p className="mt-1 text-[16px] font-semibold text-white">مراجعة المدير</p>
      <p className="mt-3 font-mono text-[24px] font-bold text-[#FF6B1A]">
        14<span className="text-[13px] text-white/40"> يوم متوسط</span>
      </p>
      <p className="mt-2 text-[11px] leading-relaxed text-white/55">
        ↳ ٤ deliverables عالقة. أبو لوقا يراجع ١ في اليوم.
      </p>
    </Card>
  );
}

// 09 — Client Sentiment (HEAVY)
export function CardClientSentiment({ size = 'md', editable }: CardProps) {
  return (
    <Card title="// client_mood" ai="heavy" size={size} editable={editable} footer={<><MessageSquare size={9} /><span>قراءة AI من ١٢٤ إيميل</span></>}>
      <ul className="space-y-2">
        {[
          ['BMW السعودية', '◔', 'متحمس', 'positive'],
          ['Rolls Royce', '◑', 'محايد', 'neutral'],
          ['لكزس', '●', 'قلق من التأخر', 'negative'],
          ['Toyota', '◕', 'مهتم جداً', 'positive'],
        ].map(([client, sym, label, mood]) => (
          <li key={client as string} className="flex items-center gap-2.5 text-[11.5px]">
            <span
              className="font-mono text-[14px]"
              style={{
                color:
                  (mood as string) === 'negative' ? '#FF6B1A'
                    : (mood as string) === 'positive' ? 'rgba(255,255,255,0.9)'
                      : 'rgba(255,255,255,0.5)',
              }}
            >
              {sym as string}
            </span>
            <span className="flex-1 text-white">{client as string}</span>
            <span className="text-[10px] text-white/55">{label as string}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// 10 — Team Capacity Forecast (HEAVY)
const SAMPLE_CAPACITY: CapacityData = {
  note: 'خالد سيتجاوز السقف الأسبوع القادم',
  people: [
    { name: 'خالد', days: [4, 4, 3, 2, 2, 0, 0, 1, 3, 3, 2, 1, 0, 0] },
    { name: 'ريم', days: [3, 3, 2, 2, 1, 0, 0, 2, 3, 4, 3, 2, 1, 0] },
    { name: 'فادي', days: [2, 2, 1, 1, 0, 0, 0, 1, 2, 2, 2, 1, 1, 0] },
    { name: 'حمادة', days: [1, 1, 1, 0, 0, 0, 0, 1, 1, 2, 1, 1, 0, 0] },
    { name: 'آدم', days: [0, 1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0] },
  ],
};
export function CardCapacityForecast({ size = 'lg', editable, data }: CardProps & { data?: CapacityData }) {
  const d = data ?? SAMPLE_CAPACITY;
  return (
    <Card title="// capacity_forecast" ai="heavy" size={size} editable={editable}
      footer={d.note ? <><AlertTriangle size={9} className="text-[#FF6B1A]" /><span>{d.note}</span></> : <><Users size={9} /><span>١٤ يوم قادمة</span></>}>
      {d.people.length === 0 ? (
        <p className="py-2 text-[11px] text-white/45">لا توظيفات نشطة.</p>
      ) : (
        <div className="space-y-1">
          {d.people.map((p) => (
            <div key={p.name} className="grid grid-cols-[48px_1fr] items-center gap-2">
              <span className="truncate font-mono text-[10px] text-white/65">{p.name}</span>
              <div className="grid gap-0.5" style={{ gridTemplateColumns: 'repeat(14, minmax(0, 1fr))' }}>
                {p.days.map((v, j) => (
                  <div
                    key={j}
                    className="h-2 rounded-sm"
                    title={`${v}`}
                    style={{
                      background:
                        v === 0 ? 'rgba(255,255,255,0.03)'
                          : v < 2 ? 'rgba(255,255,255,0.25)'
                            : v < 4 ? 'rgba(255,255,255,0.5)'
                              : '#FF6B1A',
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// 11 — Draft Follow-ups (HEAVY)
export function CardFollowups({ size = 'md', editable }: CardProps) {
  return (
    <Card title="// draft_followups" ai="heavy" size={size} editable={editable} footer={<><Send size={9} /><span>٣ مسودات جاهزة للإرسال</span></>}>
      <ul className="space-y-2">
        {[
          ['BMW السعودية', '"شكراً لردك، أرفقت الـ draft v3..."'],
          ['لكزس', '"تم تعديل القطع حسب طلبك..."'],
          ['Toyota', '"يسعدنا تقديم عرض جديد..."'],
        ].map(([who, snippet]) => (
          <li key={who as string} className="rounded-md border border-white/[0.05] bg-[#0F0F12] p-2">
            <p className="text-[11.5px] text-white">{who as string}</p>
            <p className="mt-1 truncate text-[10px] text-white/55">{snippet as string}</p>
            <div className="mt-1.5 flex gap-1.5">
              <button className="rounded border border-[#FF6B1A]/40 px-1.5 py-0.5 font-mono text-[8.5px] uppercase text-[#FF6B1A] hover:bg-[#FF6B1A]/10">
                send
              </button>
              <button className="rounded border border-white/15 px-1.5 py-0.5 font-mono text-[8.5px] uppercase text-white/55 hover:bg-white/[0.04]">
                edit
              </button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// 12 — This week's Shoots (LIGHT)
const SAMPLE_SHOOTS: ShootsData = {
  count: 4,
  conflicts: 1,
  items: [
    { when: 'اليوم 21:33', what: 'جولة الشوروم MG', city: 'الرياض', isToday: true, conflict: false },
    { when: 'غداً 09:00', what: 'BMW Summer', city: 'جدة', isToday: false, conflict: true },
    { when: 'الأحد 10:00', what: 'Rolls Royce interior', city: 'الرياض', isToday: false, conflict: false },
    { when: 'الإثنين 07:30', what: 'لكزس LX social', city: 'جدة', isToday: false, conflict: false },
  ],
};
export function CardTodayShoots({ size = 'md', editable, data }: CardProps & { data?: ShootsData }) {
  const d = data ?? SAMPLE_SHOOTS;
  return (
    <Card title="// shoots_this_week" ai="light" size={size} editable={editable}
      footer={<><Camera size={9} /><span>{toAr(d.count)} لقطات · {toAr(d.conflicts)} conflict</span></>}>
      {d.items.length === 0 ? (
        <p className="py-2 text-[11px] text-white/45">لا تصوير مجدول الأسبوع ده.</p>
      ) : (
        <ul className="space-y-1.5">
          {d.items.map((it) => (
            <li key={it.when + it.what} className="text-[11.5px]">
              <div className="flex items-baseline gap-2">
                <span className={'font-mono text-[10px] ' + (it.isToday ? 'text-[#FF6B1A]' : 'text-white/45')}>
                  {it.when}
                </span>
                {it.conflict && (
                  <span className="rounded-sm bg-[#FF6B1A]/15 px-1 py-0.5 font-mono text-[8.5px] uppercase text-[#FF6B1A]">
                    conflict
                  </span>
                )}
              </div>
              <MaybeLink href={it.href} className="mt-0.5 block text-white">
                {it.what} <span className="text-white/45">· {it.city}</span>
              </MaybeLink>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// 13 — Cashflow Forecast (MEDIUM)
export function CardCashflow({ size = 'md', editable }: CardProps) {
  return (
    <Card title="// cashflow_forecast" ai="medium" size={size} editable={editable} footer={<><DollarSign size={9} /><span>توقّع AI لنهاية الشهر</span></>}>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Money label="إيراد" value="410K" />
        <Money label="مدفوع" value="280K" />
        <Money label="مستحق" value="130K" warning />
      </div>
      <div className="mt-3">
        <p className="text-[10px] text-white/45">توقّع AI لنهاية مايو:</p>
        <p className="mt-1 font-mono text-[18px] font-bold text-[#FF6B1A]">
          485K<span className="text-[10px] text-white/40"> ر.س</span>
        </p>
      </div>
    </Card>
  );
}

function Money({ label, value, warning }: { label: string; value: string; warning?: boolean }) {
  return (
    <div>
      <p className={'font-mono text-[18px] font-bold ' + (warning ? 'text-[#FF6B1A]' : 'text-white')}>{value}</p>
      <p className="mt-0.5 text-[9px] text-white/45">{label}</p>
    </div>
  );
}

// 14 — MTD Revenue (LIGHT)
const SAMPLE_REVENUE: RevenueData = { value: 410000, deltaPct: 18 };
export function CardMTDRevenue({ size = 'sm', editable, data }: CardProps & { data?: RevenueData }) {
  const d = data ?? SAMPLE_REVENUE;
  const k = Math.round(d.value / 1000);
  return (
    <Card title="// revenue_mtd" ai="light" size={size} editable={editable}
      footer={d.deltaPct != null
        ? <><TrendingUp size={9} /><span>{d.deltaPct >= 0 ? '+' : ''}{toAr(d.deltaPct)}٪ من الشهر الماضي</span></>
        : <><TrendingUp size={9} /><span>live · pg_cron</span></>}>
      <p className="font-mono text-[36px] font-bold leading-none tracking-tight text-white">
        <CountUp value={k} /><span className="text-[14px] text-white/40">K</span>
      </p>
      <p className="mt-1 text-[10px] text-white/55">ر.س محصّل من بداية الشهر</p>
      <svg viewBox="0 0 100 20" className="mt-3 h-6 w-full">
        <path
          d="M 0,16 L 12,14 L 24,15 L 36,11 L 48,12 L 60,8 L 72,9 L 84,5 L 100,3"
          fill="none"
          stroke="#FF6B1A"
          strokeWidth="1.2"
        />
      </svg>
    </Card>
  );
}

// 15 — Open Tasks (LIGHT)
export function CardOpenTasks({ size = 'md', editable }: CardProps) {
  return (
    <Card title="// my_open_tasks" ai="light" size={size} editable={editable} footer={<><ListChecks size={9} /><span>AI رتّبها حسب الإلحاح</span></>}>
      <ul className="space-y-1.5">
        {[
          ['راجع cut نهائي BMW', 'اليوم', '#FF6B1A'],
          ['وافق على invoice Toyota', 'غداً', 'rgba(255,255,255,0.6)'],
          ['اتصل بـ Mazda', '+3 أيام', 'rgba(255,255,255,0.4)'],
          ['تحضير عرض جديد', '+5 أيام', 'rgba(255,255,255,0.3)'],
        ].map(([task, due, color]) => (
          <li key={task as string} className="flex items-center gap-2 text-[11.5px]">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: color as string }} />
            <span className="flex-1 truncate text-white">{task as string}</span>
            <span className="font-mono text-[10px] text-white/45">{due as string}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// 16 — Pending Approvals (MEDIUM)
const SAMPLE_APPROVALS: ApprovalsData = {
  items: [
    { what: 'Reel 7 — BMW', sub: 'Reels' },
    { what: 'Cut v3 — Rolls Royce', sub: 'Video' },
    { what: 'Color grade — لكزس', sub: 'Video' },
  ],
};
export function CardApprovals({ size = 'md', editable, data }: CardProps & { data?: ApprovalsData }) {
  const d = data ?? SAMPLE_APPROVALS;
  return (
    <Card title="// approvals_pending" ai="medium" size={size} editable={editable}
      footer={<><CheckCircle2 size={9} /><span>{toAr(d.items.length)} بانتظار المراجعة</span></>}>
      {d.items.length === 0 ? (
        <p className="py-2 text-[11px] text-white/45">المسار فارغ ✓</p>
      ) : (
        <ul className="divide-y divide-white/[0.05]">
          {d.items.map((it) => (
            <li key={it.what} className="flex items-center justify-between gap-2 py-2 text-[11.5px]">
              <div className="min-w-0">
                <MaybeLink href={it.href} className="block truncate text-white hover:text-[#FF6B1A]">{it.what}</MaybeLink>
                {it.sub && <p className="truncate text-[10px] text-white/45">{it.sub}</p>}
              </div>
              <span className="shrink-0 rounded-sm bg-[#FF6B1A]/15 px-1.5 py-0.5 font-mono text-[8.5px] uppercase text-[#FF6B1A]">
                راجع
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// 17 — Equipment Conflicts (LIGHT)
const SAMPLE_CONFLICTS: ConflictsData = {
  count: 2,
  items: [
    { label: 'Canon R5', detail: 'الأحد 10-14' },
    { label: 'Sony FX6', detail: 'الإثنين 8-12' },
  ],
};
export function CardEquipmentConflicts({ size = 'sm', editable, data }: CardProps & { data?: ConflictsData }) {
  const d = data ?? SAMPLE_CONFLICTS;
  return (
    <Card title="// equip_conflicts" ai="light" size={size} editable={editable} footer={<><Camera size={9} /><span>AI كشف overlap</span></>}>
      <p className="font-mono text-[36px] font-bold leading-none text-[#FF6B1A]"><CountUp value={d.count} /></p>
      <p className="mt-1 text-[11px] text-white/65">حجوزات متداخلة</p>
      {d.items.length > 0 && (
        <ul className="mt-3 space-y-1 text-[10.5px] text-white/55">
          {d.items.map((it) => (
            <li key={it.label}>{it.label} · {it.detail}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// 18 — Equipment Battery (LIGHT)
export function CardEquipmentBattery({ size = 'sm', editable }: CardProps) {
  return (
    <Card title="// battery_alerts" ai="light" size={size} editable={editable} footer={<><Battery size={9} /><span>AI يتوقع شحن قبل الأحد</span></>}>
      <ul className="space-y-2">
        {[
          ['Canon R5 #1', 18, true],
          ['Sony FX6 #2', 42, false],
          ['DJI Mavic 3', 78, false],
        ].map(([name, pct, low]) => (
          <li key={name as string} className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-white">{name as string}</span>
              <span className={'font-mono text-[10px] ' + ((low as boolean) ? 'text-[#FF6B1A]' : 'text-white/55')}>
                {pct as number}٪
              </span>
            </div>
            <div className="h-0.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full"
                style={{
                  width: `${pct as number}%`,
                  background: (low as boolean) ? '#FF6B1A' : 'rgba(255,255,255,0.6)',
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// 19 — Recent Activity (LIGHT)
export function CardActivity({ size = 'md', editable }: CardProps) {
  return (
    <Card title="// activity_live" ai="light" size={size} editable={editable} footer={<><Activity size={9} /><span>AI يبرز الأحداث المهمة</span></>}>
      <ul className="space-y-1.5">
        {[
          ['16:38', 'خالد سلّم مونتاج BMW', true],
          ['16:21', 'ريم وافقت على Reel 7', false],
          ['15:58', 'إيميل لـ Lexus', false],
          ['15:34', 'مهمة من فادي', false],
          ['14:45', 'حجز Canon R5', false],
        ].map(([time, what, hl]) => (
          <li key={(time as string) + (what as string)} className="flex items-center gap-2 text-[11px]">
            <span className="font-mono text-[10px] text-white/40">{time as string}</span>
            <span className={(hl as boolean) ? 'text-white' : 'text-white/65'}>
              {what as string}
            </span>
            {(hl as boolean) && <Sparkles size={8} className="text-[#FF6B1A]" />}
          </li>
        ))}
      </ul>
    </Card>
  );
}

// 20 — Stale Conversations (HEAVY)
const SAMPLE_STALE: StaleConvosData = {
  items: [
    { client: 'Mazda KSA', why: 'كان مهتم — صمت', days: 9 },
    { client: 'Hyundai', why: 'وعدنا بعرض', days: 7 },
    { client: 'MG السعودية', why: 'سؤال بدون رد', days: 6 },
  ],
};
export function CardStaleConvos({ size = 'md', editable, data }: CardProps & { data?: StaleConvosData }) {
  const d = data ?? SAMPLE_STALE;
  return (
    <Card title="// stale_threads" ai="heavy" size={size} editable={editable} footer={<><Reply size={9} className="text-[#FF6B1A]" /><span>AI اكتشف خمول</span></>}>
      {d.items.length === 0 ? (
        <p className="py-2 text-[11px] text-white/45">لا محادثات معلّقة ✓</p>
      ) : (
        <ul className="space-y-2">
          {d.items.map((it) => (
            <li key={it.client + it.why} className="flex items-start gap-2 rounded-md border border-white/[0.05] bg-[#0F0F12] px-2.5 py-2 text-[11.5px]">
              <div className="min-w-0 flex-1">
                <MaybeLink href={it.href} className="block truncate text-white hover:text-[#FF6B1A]">{it.client}</MaybeLink>
                <p className="mt-0.5 text-[10px] text-white/55">{it.why}</p>
              </div>
              <span className="shrink-0 font-mono text-[10px] text-[#FF6B1A]">{toAr(it.days)}ي</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// 21 — Lead Temperature (MEDIUM)
export function CardLeadTemp({ size = 'sm', editable }: CardProps) {
  return (
    <Card title="// lead_temperature" ai="medium" size={size} editable={editable} footer={<><Flame size={9} /><span>AI score</span></>}>
      <ul className="space-y-2">
        {[
          ['ساخن', 4, '#FF6B1A'],
          ['دافئ', 7, 'rgba(255,255,255,0.55)'],
          ['بارد', 12, 'rgba(255,255,255,0.25)'],
        ].map(([label, n, color]) => (
          <li key={label as string} className="flex items-center gap-2 text-[11.5px]">
            <span className="w-10 text-white/65">{label as string}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-white/[0.06]">
              <div
                className="h-full"
                style={{ width: `${((n as number) / 25) * 100}%`, background: color as string }}
              />
            </div>
            <span className="w-6 text-end font-mono text-[10px] text-white/55">{n as number}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// 22 — AI Cost Burn (MEDIUM)
export function CardAICost({ size = 'sm', editable }: CardProps) {
  return (
    <Card title="// ai_cost_burn" ai="medium" size={size} editable={editable} footer={<><Brain size={9} /><span>$50 شهري · ٢٥٪ مستخدم</span></>}>
      <p className="font-mono text-[28px] font-bold leading-none text-[#FF6B1A]">$12.40</p>
      <p className="mt-1 text-[10px] text-white/55">إنفاق AI هذا الشهر</p>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full bg-[#FF6B1A]" style={{ width: '25%' }} />
      </div>
      <p className="mt-2 text-[9px] text-white/45">Sonnet ٧٠٪ · Haiku ٢٥٪ · embed ٥٪</p>
    </Card>
  );
}

// 23 — Email SLA (NONE)
export function CardEmailSLA({ size = 'sm', editable }: CardProps) {
  return (
    <Card title="// email_sla_24h" size={size} editable={editable} footer={<><Clock size={9} /><span>٤٢ من ٥٤ thread</span></>}>
      <div className="flex items-center gap-4">
        <div className="relative h-14 w-14">
          <svg className="h-14 w-14 -rotate-90">
            <circle cx="28" cy="28" r="24" stroke="rgba(255,255,255,0.06)" strokeWidth="4" fill="none" />
            <circle cx="28" cy="28" r="24" stroke="#FF6B1A" strokeWidth="4" fill="none" strokeDasharray="151" strokeDashoffset="33" />
          </svg>
          <span className="absolute inset-0 grid place-items-center font-mono text-[12px] font-bold text-white">٧٨٪</span>
        </div>
        <div>
          <p className="text-[12px] text-white">رد خلال ٢٤س</p>
          <p className="mt-0.5 text-[10px] text-white/55">آخر ٧ أيام</p>
        </div>
      </div>
    </Card>
  );
}

// 24 — Project Velocity (MEDIUM)
export function CardVelocity({ size = 'md', editable }: CardProps) {
  return (
    <Card title="// project_velocity" ai="medium" size={size} editable={editable} footer={<><TrendingUp size={9} /><span>AI يقارن بالقاعدة</span></>}>
      <ul className="space-y-2">
        {[
          ['بريف', 2, 3, true],
          ['عرض سعر', 4, 3, false],
          ['تصوير', 1, 1, true],
          ['مونتاج', 7, 5, false],
          ['مراجعة', 14, 7, false],
        ].map(([stage, actual, baseline, ok]) => (
          <li key={stage as string} className="grid grid-cols-[80px_1fr_40px] items-center gap-2 text-[11px]">
            <span className="text-white/75">{stage as string}</span>
            <div className="flex items-center gap-1.5">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full"
                  style={{
                    width: `${Math.min(100, ((actual as number) / 14) * 100)}%`,
                    background: (ok as boolean) ? 'rgba(255,255,255,0.6)' : '#FF6B1A',
                  }}
                />
              </div>
            </div>
            <span className="font-mono text-[10px] text-white/45">{actual as number}/{baseline as number}ي</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// 25 — Win Rate by Client (MEDIUM)
export function CardWinRate({ size = 'sm', editable }: CardProps) {
  return (
    <Card title="// win_rate" ai="medium" size={size} editable={editable} footer={<><Briefcase size={9} /><span>آخر ٩٠ يوم</span></>}>
      <p className="font-mono text-[28px] font-bold leading-none text-white">62٪</p>
      <p className="mt-1 text-[10px] text-white/55">عرض → مشروع موقّع</p>
      <ul className="mt-3 space-y-1 text-[10px] text-white/55">
        <li className="flex justify-between"><span>سيارات</span><span className="text-[#FF6B1A]">78٪</span></li>
        <li className="flex justify-between"><span>عقار</span><span>54٪</span></li>
        <li className="flex justify-between"><span>F&B</span><span>40٪</span></li>
      </ul>
    </Card>
  );
}

// 26 — OAuth Health (NONE)
export function CardOAuthHealth({ size = 'sm', editable }: CardProps) {
  return (
    <Card title="// oauth_health" size={size} editable={editable} footer={<><ShieldCheck size={9} /><span>التحديث التلقائي شغّال</span></>}>
      <ul className="space-y-1.5 text-[11px]">
        {[
          ['Gmail', 'ok', '25 يوم'],
          ['Drive', 'warn', '52 ساعة'],
          ['Calendar', 'ok', '22 يوم'],
          ['WhatsApp', 'ok', 'live'],
        ].map(([k, s, t]) => (
          <li key={k as string} className="flex items-center gap-2">
            <span className={'h-1.5 w-1.5 rounded-full ' + ((s as string) === 'ok' ? 'bg-white/65' : 'bg-[#FF6B1A]')} />
            <span className="text-white/85">{k as string}</span>
            <span className="ms-auto font-mono text-[10px] text-white/45">{t as string}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// 27 — Worker Status (NONE)
export function CardWorkerStatus({ size = 'sm', editable }: CardProps) {
  return (
    <Card title="// trigger_workers" size={size} editable={editable} footer={<><Layers size={9} /><span>١١ مهمة مجدولة</span></>}>
      <p className="font-mono text-[28px] font-bold leading-none text-white">11<span className="text-[12px] text-white/40">/11</span></p>
      <p className="mt-1 text-[10px] text-white/55">workers شغّالين</p>
      <ul className="mt-3 space-y-0.5 font-mono text-[10px] text-white/55">
        <li className="flex justify-between"><span>gmail-scanner</span><span>5m</span></li>
        <li className="flex justify-between"><span>email-send</span><span>1m</span></li>
        <li className="flex justify-between"><span>daily-brief</span><span>24h</span></li>
      </ul>
    </Card>
  );
}

// 28 — AI Daily Tip (HEAVY)
export function CardAITip({ size = 'md', editable }: CardProps) {
  return (
    <Card title="// ai_tip_of_the_day" ai="heavy" size={size} editable={editable} footer={<><Lightbulb size={9} className="text-[#FF6B1A]" /><span>AI رصد نمط من ٣٠ يوم</span></>}>
      <p className="text-[13.5px] leading-relaxed text-white/90">
        لاحظت أن مشاريع <span className="text-[#FF6B1A]">السيارات التي تتجاوز ميزانيتها ١٠٠ ألف</span> تستغرق
        ٤٠٪ مونتاجاً أكثر من المتوقع. أقترح زيادة الـ buffer إلى ٧ أيام.
      </p>
      <button className="mt-3 inline-flex items-center gap-1.5 rounded border border-[#FF6B1A]/40 px-2 py-1 font-mono text-[9.5px] uppercase tracking-wider text-[#FF6B1A] hover:bg-[#FF6B1A]/10">
        <FileText size={9} />
        طبّق على templates
      </button>
    </Card>
  );
}

// 29 — At a glance KPIs (NONE) — compact 2×2 of the headline counts
const SAMPLE_GLANCE: GlanceData = { active: 12, tasks: 34, leads: 7, review: 3 };
export function CardGlance({ size = 'sm', editable, data }: CardProps & { data?: GlanceData }) {
  const d = data ?? SAMPLE_GLANCE;
  const cells: { label: string; value: number; href: string; warn?: boolean }[] = [
    { label: 'مشاريع نشطة', value: d.active, href: '/projects' },
    { label: 'مهام مفتوحة', value: d.tasks, href: '/tasks' },
    { label: 'Leads', value: d.leads, href: '/crm' },
    { label: 'بانتظار مراجعة', value: d.review, href: '/projects', warn: d.review > 0 },
  ];
  return (
    <Card title="// at_a_glance" size={size} editable={editable} footer={<><ListChecks size={9} /><span>الأرقام الحيّة</span></>}>
      <div className="grid grid-cols-2 gap-2.5">
        {cells.map((c) => (
          <Link key={c.label} href={c.href} className="rounded-md border border-white/[0.05] bg-[#0F0F12] px-2.5 py-2 hover:border-white/[0.12]">
            <p className={'font-mono text-[22px] font-bold leading-none ' + (c.warn ? 'text-[#FF6B1A]' : 'text-white')}>
              <CountUp value={c.value} />
            </p>
            <p className="mt-1 text-[9.5px] text-white/50">{c.label}</p>
          </Link>
        ))}
      </div>
    </Card>
  );
}
