/**
 * The card library — 28 AI-aware widgets. Each renders self-contained
 * sample content using only the existing palette.
 *
 * AI levels:
 *   heavy   — the card is mostly AI output (suggestions, drafts, predictions)
 *   medium  — AI enriches existing data (scores, projections, sentiment)
 *   light   — AI labels a metric or highlights items
 *   none    — pure data, no AI
 */
import {
  Sparkles, MoreHorizontal, GripVertical, ArrowUpRight, Mail, Brain,
  Briefcase, Calendar, Camera, Activity, Flame, Reply, ShieldCheck,
  AlertTriangle, DollarSign, Workflow, TrendingDown, TrendingUp,
  Users, MessageSquare, ListChecks, Clock, Battery, Zap, Lightbulb,
  CheckCircle2, FileText, Layers, Send, ChevronRight,
} from 'lucide-react';

// ════════════════════════════════════════════════════════════════════════
// CARD SHELL — clean, modern, minimal
// ════════════════════════════════════════════════════════════════════════

export type CardSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';
export type AILevel = 'heavy' | 'medium' | 'light' | 'none';

export function Card({
  title,
  ai,
  size = 'md',
  children,
  footer,
  editable = false,
}: {
  title: string;
  ai?: AILevel;
  size?: CardSize;
  children: React.ReactNode;
  footer?: React.ReactNode;
  editable?: boolean;
}) {
  const span = {
    sm: 'col-span-12 md:col-span-3',
    md: 'col-span-12 md:col-span-4',
    lg: 'col-span-12 md:col-span-6',
    xl: 'col-span-12 md:col-span-8',
    full: 'col-span-12',
  }[size];

  return (
    <article
      className={
        span +
        ' group relative overflow-hidden rounded-xl border border-white/[0.08] bg-[#17171C] transition-colors hover:border-white/[0.16]'
      }
    >
      {/* AI stripe — top edge, very subtle */}
      {ai && ai !== 'none' && (
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background:
              ai === 'heavy'
                ? '#FF6B1A'
                : ai === 'medium'
                  ? 'rgba(255,107,26,0.6)'
                  : 'rgba(255,107,26,0.3)',
          }}
        />
      )}

      <header className="flex items-center gap-2 px-4 pt-3.5 pb-2.5">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/55">
          {title}
        </h3>
        {ai && ai !== 'none' && <AIBadge level={ai} />}
        <div className="ms-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {editable && (
            <button className="grid h-5 w-5 cursor-grab place-items-center rounded text-white/35 hover:bg-white/[0.06] hover:text-white">
              <GripVertical size={11} />
            </button>
          )}
          <button className="grid h-5 w-5 place-items-center rounded text-white/35 hover:bg-white/[0.06] hover:text-white">
            <MoreHorizontal size={11} />
          </button>
        </div>
      </header>

      <div className="px-4 pb-3">{children}</div>

      {footer && (
        <footer className="flex items-center gap-2 border-t border-white/[0.05] px-4 py-2 font-mono text-[9.5px] text-white/40">
          {footer}
        </footer>
      )}
    </article>
  );
}

export function AIBadge({ level }: { level: Exclude<AILevel, 'none'> }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-mono text-[8.5px] font-semibold uppercase tracking-wider"
      style={{
        background:
          level === 'heavy'
            ? 'rgba(255,107,26,0.18)'
            : level === 'medium'
              ? 'rgba(255,107,26,0.10)'
              : 'rgba(255,107,26,0.06)',
        color:
          level === 'heavy'
            ? '#FF8442'
            : level === 'medium'
              ? '#FF6B1A'
              : 'rgba(255,107,26,0.7)',
      }}
    >
      <Sparkles size={8} />
      AI
    </span>
  );
}

// ════════════════════════════════════════════════════════════════════════
// 28 CARD COMPONENTS
// ════════════════════════════════════════════════════════════════════════

// 01 — AI Daily Brief (HEAVY) — 3 ranked priorities
export function CardAIBrief({ size = 'lg', editable }: { size?: CardSize; editable?: boolean }) {
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
          <li key={num as string} className="grid grid-cols-[20px,1fr] gap-2 text-[12px]">
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
export function CardAtRisk({ size = 'md', editable }: { size?: CardSize; editable?: boolean }) {
  return (
    <Card title="// at_risk · ai prediction" ai="heavy" size={size} editable={editable} footer={<><Brain size={9} /><span>AI confidence: 84٪</span></>}>
      <ul className="space-y-2.5">
        {[
          ['رولز رويس', 92, 'تأخر التسليم'],
          ['BMW Summer', 67, 'فريق محمّل'],
          ['لكزس LX', 48, 'بريف ناقص'],
        ].map(([name, score, why]) => (
          <li key={name as string} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-white">{name as string}</span>
              <span className="font-mono text-[11px] font-semibold text-[#FF6B1A]">{score as number}٪</span>
            </div>
            <div className="h-0.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full bg-[#FF6B1A]" style={{ width: `${score as number}%` }} />
            </div>
            <p className="text-[10px] text-white/45">↳ {why as string}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// 03 — Hot Leads (HEAVY) — AI ranked by conversion likelihood
export function CardHotLeads({ size = 'md', editable }: { size?: CardSize; editable?: boolean }) {
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
export function CardSmartSuggestions({ size = 'md', editable }: { size?: CardSize; editable?: boolean }) {
  return (
    <Card title="// ai_suggestions" ai="heavy" size={size} editable={editable} footer={<><Sparkles size={9} className="text-[#FF6B1A]" /><span>٧ بانتظار مراجعتك</span><span className="ms-auto cursor-pointer hover:underline">راجع الكل →</span></>}>
      <ul className="space-y-2">
        {[
          ['create_client', 'عميل جديد: شركة Toyota الجزيرة', 89],
          ['link_thread', 'ربط 4 إيميلات بـ PRJ-0006', 76],
          ['create_task', 'مهمة: اتصال بـ BMW السعودية', 71],
          ['escalate', 'محادثة معلقة منذ 6 أيام', 65],
        ].map(([type, text, conf]) => (
          <li key={text as string} className="flex items-center gap-2 rounded-md border border-white/[0.05] bg-[#0F0F12] px-2.5 py-1.5">
            <span className="font-mono text-[8.5px] uppercase tracking-wider text-[#FF6B1A]">{type as string}</span>
            <span className="flex-1 truncate text-[11px] text-white/85">{text as string}</span>
            <span className="font-mono text-[10px] text-white/45">{conf as number}٪</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// 05 — Email Triage (HEAVY)
export function CardEmailTriage({ size = 'md', editable }: { size?: CardSize; editable?: boolean }) {
  return (
    <Card title="// email_triage" ai="heavy" size={size} editable={editable} footer={<><Mail size={9} /><span>٨ ينتظر ردنا · ٢ urgent</span></>}>
      <ul className="space-y-1.5">
        {[
          ['BMW السعودية', 'الـ draft جاهز · 52س متأخر', 'critical'],
          ['تويوتا الجزيرة', 'يستفسر عن العرض', 'high'],
          ['لكزس', 'ملاحظة على آخر cut', 'med'],
          ['Rolls Royce', 'تأكيد التسليم', 'med'],
        ].map(([who, what, p]) => (
          <li key={who as string} className="flex items-center gap-2 text-[11.5px]">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background:
                  (p as string) === 'critical'
                    ? '#FF6B1A'
                    : (p as string) === 'high'
                      ? 'rgba(255,255,255,0.75)'
                      : 'rgba(255,255,255,0.35)',
              }}
            />
            <span className="text-white">{who as string}</span>
            <span className="text-white/45">·</span>
            <span className="truncate text-white/55">{what as string}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// 06 — Suggested Next Actions (HEAVY)
export function CardNextActions({ size = 'md', editable }: { size?: CardSize; editable?: boolean }) {
  return (
    <Card title="// do_these_now" ai="heavy" size={size} editable={editable} footer={<><Zap size={9} className="text-[#FF6B1A]" /><span>AI اختارها بناءً على وقتك الحالي</span></>}>
      <ul className="space-y-2">
        {[
          ['اتصل بـ Toyota الجزيرة', '12 دقيقة', '#FF6B1A'],
          ['وافق على Reel 7 من ريم', '2 دقيقة', 'rgba(255,255,255,0.75)'],
          ['أعد توزيع MG لـ فادي', '5 دقايق', 'rgba(255,255,255,0.55)'],
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
export function CardProjectHealth({ size = 'lg', editable }: { size?: CardSize; editable?: boolean }) {
  return (
    <Card title="// project_health" ai="heavy" size={size} editable={editable} footer={<><Activity size={9} /><span>تم تحليل ١٢ مشروع نشط</span></>}>
      <ul className="space-y-2">
        {[
          ['رولز رويس — الشوروم', 'red', 'تأخر + capacity issue', 45],
          ['BMW Summer', 'amber', 'إنجاز جيد بس thread معلق', 78],
          ['Rolls Royce interior', 'green', 'في المسار', 92],
          ['لكزس LX', 'amber', 'بريف ناقص', 12],
        ].map(([name, health, why, pct]) => (
          <li key={name as string} className="grid grid-cols-[8px,1fr,80px,40px] items-center gap-2.5 text-[11.5px]">
            <span
              className="h-2 w-2 rounded-full"
              style={{
                background:
                  (health as string) === 'red'
                    ? '#FF6B1A'
                    : (health as string) === 'amber'
                      ? 'rgba(255,255,255,0.6)'
                      : 'rgba(255,255,255,0.35)',
              }}
            />
            <span className="truncate text-white">{name as string}</span>
            <span className="truncate text-[10px] text-white/55">{why as string}</span>
            <span className="text-end font-mono text-[10px] text-white/55">{pct as number}٪</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// 08 — Approval Bottleneck (HEAVY)
export function CardBottleneck({ size = 'md', editable }: { size?: CardSize; editable?: boolean }) {
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
export function CardClientSentiment({ size = 'md', editable }: { size?: CardSize; editable?: boolean }) {
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
                  (mood as string) === 'negative'
                    ? '#FF6B1A'
                    : (mood as string) === 'positive'
                      ? 'rgba(255,255,255,0.9)'
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
export function CardCapacityForecast({ size = 'lg', editable }: { size?: CardSize; editable?: boolean }) {
  const PEOPLE = [
    ['خالد', [4, 4, 3, 2, 2, 0, 0, 1, 3, 3, 2, 1, 0, 0]],
    ['ريم', [3, 3, 2, 2, 1, 0, 0, 2, 3, 4, 3, 2, 1, 0]],
    ['فادي', [2, 2, 1, 1, 0, 0, 0, 1, 2, 2, 2, 1, 1, 0]],
    ['حمادة', [1, 1, 1, 0, 0, 0, 0, 1, 1, 2, 1, 1, 0, 0]],
    ['آدم', [0, 1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0]],
  ] as const;
  return (
    <Card title="// capacity_forecast" ai="heavy" size={size} editable={editable} footer={<><AlertTriangle size={9} className="text-[#FF6B1A]" /><span>خالد سيتجاوز السقف الأسبوع القادم</span></>}>
      <div className="space-y-1">
        {PEOPLE.map(([name, days]) => (
          <div key={name} className="grid grid-cols-[40px,1fr] items-center gap-2">
            <span className="font-mono text-[10px] text-white/65">{name}</span>
            <div className="grid grid-cols-14 gap-0.5">
              {days.map((v, j) => (
                <div
                  key={j}
                  className="h-2 rounded-sm"
                  style={{
                    background:
                      v === 0
                        ? 'rgba(255,255,255,0.03)'
                        : v < 2
                          ? 'rgba(255,255,255,0.25)'
                          : v < 4
                            ? 'rgba(255,255,255,0.5)'
                            : '#FF6B1A',
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// 11 — Draft Follow-ups (HEAVY)
export function CardFollowups({ size = 'md', editable }: { size?: CardSize; editable?: boolean }) {
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

// 12 — Today's Shoots (LIGHT)
export function CardTodayShoots({ size = 'md', editable }: { size?: CardSize; editable?: boolean }) {
  return (
    <Card title="// shoots_this_week" ai="light" size={size} editable={editable} footer={<><Camera size={9} /><span>٤ لقطات · ١ conflict</span></>}>
      <ul className="space-y-1.5">
        {[
          ['اليوم 21:33', 'جولة الشوروم MG', 'الرياض', true, false],
          ['غداً 09:00', 'BMW Summer', 'جدة', false, true],
          ['الأحد 10:00', 'Rolls Royce interior', 'الرياض', false, false],
          ['الإثنين 07:30', 'لكزس LX social', 'جدة', false, false],
        ].map(([when, what, city, isToday, conflict]) => (
          <li key={(when as string) + (what as string)} className="text-[11.5px]">
            <div className="flex items-baseline gap-2">
              <span className={'font-mono text-[10px] ' + ((isToday as boolean) ? 'text-[#FF6B1A]' : 'text-white/45')}>
                {when as string}
              </span>
              {(conflict as boolean) && (
                <span className="rounded-sm bg-[#FF6B1A]/15 px-1 py-0.5 font-mono text-[8.5px] uppercase text-[#FF6B1A]">
                  conflict
                </span>
              )}
            </div>
            <p className="mt-0.5 text-white">
              {what as string} <span className="text-white/45">· {city as string}</span>
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// 13 — Cashflow Forecast (MEDIUM)
export function CardCashflow({ size = 'md', editable }: { size?: CardSize; editable?: boolean }) {
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
export function CardMTDRevenue({ size = 'sm', editable }: { size?: CardSize; editable?: boolean }) {
  return (
    <Card title="// revenue_mtd" ai="light" size={size} editable={editable} footer={<><TrendingUp size={9} /><span>+١٨٪ من الشهر الماضي</span></>}>
      <p className="font-mono text-[36px] font-bold leading-none tracking-tight text-white">
        410<span className="text-[14px] text-white/40">K</span>
      </p>
      <p className="mt-1 text-[10px] text-white/55">ر.س محصّل من بداية مايو</p>
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
export function CardOpenTasks({ size = 'md', editable }: { size?: CardSize; editable?: boolean }) {
  return (
    <Card title="// my_open_tasks" ai="light" size={size} editable={editable} footer={<><ListChecks size={9} /><span>AI رتّبها حسب الإلحاح</span></>}>
      <ul className="space-y-1.5">
        {[
          ['راجع cut نهائي BMW', 'اليوم', '#FF6B1A'],
          ['وافق على invoice Toyota', 'بكرة', 'rgba(255,255,255,0.6)'],
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
export function CardApprovals({ size = 'md', editable }: { size?: CardSize; editable?: boolean }) {
  return (
    <Card title="// approvals_pending" ai="medium" size={size} editable={editable} footer={<><CheckCircle2 size={9} /><span>AI يقترح "approve" لـ ٢</span></>}>
      <ul className="divide-y divide-white/[0.05]">
        {[
          ['Reel 7 — BMW', 'recommend', 'approve'],
          ['Cut v3 — Rolls Royce', 'recommend', 'approve'],
          ['Color grade — لكزس', 'recommend', 'revise'],
        ].map(([what, , action]) => (
          <li key={what as string} className="flex items-center justify-between py-2 text-[11.5px]">
            <span className="text-white">{what as string}</span>
            <span
              className={
                'rounded-sm px-1.5 py-0.5 font-mono text-[8.5px] uppercase ' +
                ((action as string) === 'approve'
                  ? 'bg-[#FF6B1A]/15 text-[#FF6B1A]'
                  : 'bg-white/8 text-white/55')
              }
            >
              {action as string}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// 17 — Equipment Conflicts (LIGHT)
export function CardEquipmentConflicts({ size = 'sm', editable }: { size?: CardSize; editable?: boolean }) {
  return (
    <Card title="// equip_conflicts" ai="light" size={size} editable={editable} footer={<><Camera size={9} /><span>AI كشف overlap</span></>}>
      <p className="font-mono text-[36px] font-bold leading-none text-[#FF6B1A]">2</p>
      <p className="mt-1 text-[11px] text-white/65">حجوزات متداخلة</p>
      <ul className="mt-3 space-y-1 text-[10.5px] text-white/55">
        <li>Canon R5 · الأحد 10-14</li>
        <li>Sony FX6 · الإثنين 8-12</li>
      </ul>
    </Card>
  );
}

// 18 — Equipment Battery (LIGHT)
export function CardEquipmentBattery({ size = 'sm', editable }: { size?: CardSize; editable?: boolean }) {
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
export function CardActivity({ size = 'md', editable }: { size?: CardSize; editable?: boolean }) {
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
export function CardStaleConvos({ size = 'md', editable }: { size?: CardSize; editable?: boolean }) {
  return (
    <Card title="// stale_threads" ai="heavy" size={size} editable={editable} footer={<><Reply size={9} className="text-[#FF6B1A]" /><span>AI اكتشف خمول</span></>}>
      <ul className="space-y-2">
        {[
          ['Mazda KSA', 'كان مهتم — صمت', 9],
          ['Hyundai', 'وعدنا بعرض', 7],
          ['MG السعودية', 'سؤال بدون رد', 6],
        ].map(([client, why, days]) => (
          <li key={client as string} className="flex items-start gap-2 rounded-md border border-white/[0.05] bg-[#0F0F12] px-2.5 py-2 text-[11.5px]">
            <div className="min-w-0 flex-1">
              <p className="truncate text-white">{client as string}</p>
              <p className="mt-0.5 text-[10px] text-white/55">{why as string}</p>
            </div>
            <span className="shrink-0 font-mono text-[10px] text-[#FF6B1A]">{days as number}ي</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// 21 — Lead Temperature (MEDIUM)
export function CardLeadTemp({ size = 'sm', editable }: { size?: CardSize; editable?: boolean }) {
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
                style={{
                  width: `${((n as number) / 25) * 100}%`,
                  background: color as string,
                }}
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
export function CardAICost({ size = 'sm', editable }: { size?: CardSize; editable?: boolean }) {
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
export function CardEmailSLA({ size = 'sm', editable }: { size?: CardSize; editable?: boolean }) {
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
export function CardVelocity({ size = 'md', editable }: { size?: CardSize; editable?: boolean }) {
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
          <li key={stage as string} className="grid grid-cols-[80px,1fr,40px] items-center gap-2 text-[11px]">
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
export function CardWinRate({ size = 'sm', editable }: { size?: CardSize; editable?: boolean }) {
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
export function CardOAuthHealth({ size = 'sm', editable }: { size?: CardSize; editable?: boolean }) {
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
            <span
              className={
                'h-1.5 w-1.5 rounded-full ' +
                ((s as string) === 'ok' ? 'bg-white/65' : 'bg-[#FF6B1A]')
              }
            />
            <span className="text-white/85">{k as string}</span>
            <span className="ms-auto font-mono text-[10px] text-white/45">{t as string}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// 27 — Worker Status (NONE)
export function CardWorkerStatus({ size = 'sm', editable }: { size?: CardSize; editable?: boolean }) {
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
export function CardAITip({ size = 'md', editable }: { size?: CardSize; editable?: boolean }) {
  return (
    <Card title="// ai_tip_of_the_day" ai="heavy" size={size} editable={editable} footer={<><Lightbulb size={9} className="text-[#FF6B1A]" /><span>AI رصد نمط من ٣٠ يوم</span></>}>
      <p className="text-[13.5px] leading-relaxed text-white/90">
        لاحظت إن مشاريع <span className="text-[#FF6B1A]">السيارات اللي ميزانيتها فوق ١٠٠ك</span> بتاخد
        ٤٠٪ مونتاج زيادة عن المتوقع. اقترح زود الـ buffer لـ ٧ أيام.
      </p>
      <button className="mt-3 inline-flex items-center gap-1.5 rounded border border-[#FF6B1A]/40 px-2 py-1 font-mono text-[9.5px] uppercase tracking-wider text-[#FF6B1A] hover:bg-[#FF6B1A]/10">
        <FileText size={9} />
        طبّق على templates
      </button>
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════════════
// CARD CATALOG — metadata for the library page + customization picker
// ════════════════════════════════════════════════════════════════════════

export const CARD_CATALOG = [
  { id: 'ai_brief', title: 'AI Daily Brief', group: 'AI Heavy', ai: 'heavy', component: CardAIBrief, defaultSize: 'lg' as CardSize, desc: 'أهم ٣-٥ أولويات اليوم، ranked بالـ AI' },
  { id: 'at_risk', title: 'At-Risk Projects', group: 'AI Heavy', ai: 'heavy', component: CardAtRisk, defaultSize: 'md' as CardSize, desc: 'مشاريع AI شايف إنها هتفوت deadline' },
  { id: 'hot_leads', title: 'Hot Leads', group: 'AI Heavy', ai: 'heavy', component: CardHotLeads, defaultSize: 'md' as CardSize, desc: 'leads بأعلى احتمال تحويل' },
  { id: 'ai_suggestions', title: 'Smart Suggestions', group: 'AI Heavy', ai: 'heavy', component: CardSmartSuggestions, defaultSize: 'md' as CardSize, desc: 'اقتراحات AI من الإيميل بانتظار مراجعتك' },
  { id: 'email_triage', title: 'Email Triage', group: 'AI Heavy', ai: 'heavy', component: CardEmailTriage, defaultSize: 'md' as CardSize, desc: 'إيميلات مرتبة بـ AI حسب الأهمية' },
  { id: 'next_actions', title: 'Do These Now', group: 'AI Heavy', ai: 'heavy', component: CardNextActions, defaultSize: 'md' as CardSize, desc: '٣ خطوات AI شايف إنها priority الآن' },
  { id: 'project_health', title: 'Project Health Pulse', group: 'AI Heavy', ai: 'heavy', component: CardProjectHealth, defaultSize: 'lg' as CardSize, desc: 'R/A/G لكل مشروع نشط مع شرح AI' },
  { id: 'bottleneck', title: 'Bottleneck Stage', group: 'AI Heavy', ai: 'heavy', component: CardBottleneck, defaultSize: 'md' as CardSize, desc: 'AI يحدد المرحلة الأبطأ' },
  { id: 'client_mood', title: 'Client Sentiment', group: 'AI Heavy', ai: 'heavy', component: CardClientSentiment, defaultSize: 'md' as CardSize, desc: 'مزاج العميل من قراءة AI للإيميلات' },
  { id: 'capacity_fc', title: 'Capacity Forecast', group: 'AI Heavy', ai: 'heavy', component: CardCapacityForecast, defaultSize: 'lg' as CardSize, desc: 'AI يتوقع overload قبل ما يحصل' },
  { id: 'followups', title: 'Draft Follow-ups', group: 'AI Heavy', ai: 'heavy', component: CardFollowups, defaultSize: 'md' as CardSize, desc: 'مسودات إيميل AI جاهزة للإرسال' },
  { id: 'stale_convos', title: 'Stale Conversations', group: 'AI Heavy', ai: 'heavy', component: CardStaleConvos, defaultSize: 'md' as CardSize, desc: 'محادثات AI شاف إنها متوقفة' },
  { id: 'ai_tip', title: 'AI Tip of the Day', group: 'AI Heavy', ai: 'heavy', component: CardAITip, defaultSize: 'md' as CardSize, desc: 'نمط جديد رصده الـ AI من تاريخ Volt' },
  { id: 'shoots', title: "Today's Shoots", group: 'AI Medium', ai: 'light', component: CardTodayShoots, defaultSize: 'md' as CardSize, desc: 'لقطات الأسبوع مع AI conflict detection' },
  { id: 'cashflow', title: 'Cashflow Forecast', group: 'AI Medium', ai: 'medium', component: CardCashflow, defaultSize: 'md' as CardSize, desc: 'إيراد + توقع AI لنهاية الشهر' },
  { id: 'approvals', title: 'Pending Approvals', group: 'AI Medium', ai: 'medium', component: CardApprovals, defaultSize: 'md' as CardSize, desc: 'موافقات معلقة مع AI recommendation' },
  { id: 'lead_temp', title: 'Lead Temperature', group: 'AI Medium', ai: 'medium', component: CardLeadTemp, defaultSize: 'sm' as CardSize, desc: 'توزيع الـ leads بالـ AI score' },
  { id: 'ai_cost', title: 'AI Cost Burn', group: 'AI Medium', ai: 'medium', component: CardAICost, defaultSize: 'sm' as CardSize, desc: 'إنفاق Anthropic + OpenAI الشهري' },
  { id: 'velocity', title: 'Project Velocity', group: 'AI Medium', ai: 'medium', component: CardVelocity, defaultSize: 'md' as CardSize, desc: 'سرعة المشاريع مقارنة بالقاعدة' },
  { id: 'win_rate', title: 'Win Rate', group: 'AI Medium', ai: 'medium', component: CardWinRate, defaultSize: 'sm' as CardSize, desc: 'معدل الفوز بالعروض حسب نوع العميل' },
  { id: 'mtd_revenue', title: 'MTD Revenue', group: 'AI Light', ai: 'light', component: CardMTDRevenue, defaultSize: 'sm' as CardSize, desc: 'إيراد الشهر مع sparkline' },
  { id: 'open_tasks', title: 'My Open Tasks', group: 'AI Light', ai: 'light', component: CardOpenTasks, defaultSize: 'md' as CardSize, desc: 'مهامي مرتبة بالـ AI urgency' },
  { id: 'activity', title: 'Activity Feed', group: 'AI Light', ai: 'light', component: CardActivity, defaultSize: 'md' as CardSize, desc: 'آخر الأحداث، AI يبرز المهم' },
  { id: 'equip_conflicts', title: 'Equipment Conflicts', group: 'AI Light', ai: 'light', component: CardEquipmentConflicts, defaultSize: 'sm' as CardSize, desc: 'AI كشف overlaps في الحجوزات' },
  { id: 'battery', title: 'Battery Alerts', group: 'AI Light', ai: 'light', component: CardEquipmentBattery, defaultSize: 'sm' as CardSize, desc: 'AI يتوقع المعدات اللي محتاجة شحن' },
  { id: 'email_sla', title: 'Email Response SLA', group: 'No AI', ai: 'none', component: CardEmailSLA, defaultSize: 'sm' as CardSize, desc: '٪ الـ threads المردود عليها خلال ٢٤س' },
  { id: 'oauth_health', title: 'OAuth Health', group: 'No AI', ai: 'none', component: CardOAuthHealth, defaultSize: 'sm' as CardSize, desc: 'صحة tokens الـ Google/WhatsApp' },
  { id: 'workers', title: 'Worker Status', group: 'No AI', ai: 'none', component: CardWorkerStatus, defaultSize: 'sm' as CardSize, desc: 'Trigger.dev tasks status' },
] as const;

export type CardId = (typeof CARD_CATALOG)[number]['id'];
