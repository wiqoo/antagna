import Link from 'next/link';
import {
  ArrowLeft, Flame, Clock4, Users, Brain, AlertTriangle, Reply,
  Battery, Activity, Camera, MessageSquare, TrendingDown, Workflow,
  DollarSign, ShieldCheck, CheckCircle2,
} from 'lucide-react';

const NEW_CARDS = [
  {
    id: 'cashflow',
    title: 'Cashflow هذا الشهر',
    icon: DollarSign,
    insight: 'الإيراد المتوقع، المدفوع، المستحق على العميل، صافي runway.',
    why: 'حالياً عندنا "إيراد الشهر" فقط — Cashflow أعمق وبيدمج Dafterah.',
    sample: <CashflowSample />,
  },
  {
    id: 'ai-cost',
    title: 'AI Cost Burn',
    icon: Brain,
    insight: 'إنفاق Claude + OpenAI اليومي، بالأسبوع، النموذج الأغلى.',
    why: 'لدينا ai_usage في الـ DB، ومحتاج surface للـ cost control.',
    sample: <AICostSample />,
  },
  {
    id: 'approval-cycle',
    title: 'دورة الموافقات',
    icon: Workflow,
    insight: 'متوسط ساعات من "submitted" → "approved" لكل موافِق.',
    why: 'يكشف المعوّقات في sequence المدير → AM → عميل.',
    sample: <ApprovalCycleSample />,
  },
  {
    id: 'lead-temp',
    title: 'حرارة الـ leads',
    icon: Flame,
    insight: 'توزيع الـ leads بحسب الـ temperature score (hot/warm/cold).',
    why: 'حالياً نعرف العدد بس، مش الـ distribution.',
    sample: <LeadTempSample />,
  },
  {
    id: 'email-sla',
    title: 'SLA الإيميل',
    icon: Reply,
    insight: '% من الإيميلات اللي ردّينا عليها في أقل من ٢٤ ساعة.',
    why: 'مهم للعلاقات مع العملاء — حالياً مفيش surface واضح.',
    sample: <EmailSLASample />,
  },
  {
    id: 'team-capacity',
    title: 'Capacity heatmap',
    icon: Users,
    insight: '١١ شخص × ٧ أيام، لون كل خانة = ساعات محجوزة / capacity.',
    why: 'الـ team-load card الحالية بتقارب الفكرة بس مش heatmap.',
    sample: <CapacityHeatmapSample />,
  },
  {
    id: 'equipment-util',
    title: 'استخدام المعدات',
    icon: Camera,
    insight: '٪ الكاميرا/الإضاءة/المايكات المحجوزة vs idle آخر ١٤ يوم.',
    why: 'يكشف لو في معدات مش بنستفيد منها وممكن نأجّرها للغير.',
    sample: <EquipmentUtilSample />,
  },
  {
    id: 'bottleneck',
    title: 'Bottleneck الـ stage',
    icon: AlertTriangle,
    insight: 'جملة واحدة: "Deals stuck في Quote sent متوسط ١٤ يوم".',
    why: 'بدل ما تشوف ١٠٠ صف، شوف الـ stage الأبطأ في الـ pipeline.',
    sample: <BottleneckSample />,
  },
  {
    id: 'activity-feed',
    title: 'Activity Feed',
    icon: Activity,
    insight: 'آخر ١٠ أحداث في النظام: تسليمات، موافقات، تكوينات.',
    why: 'للمدير اللي عايز يعرف كل شيء — pulse الـ ops.',
    sample: <ActivityFeedSample />,
  },
  {
    id: 'whatsapp-bot',
    title: 'بوت الواتساب',
    icon: MessageSquare,
    insight: 'عدد الاستفسارات اليوم، الأسئلة الشائعة، الـ tool calls.',
    why: 'كان حماس كبير من البوت — نعرف لو الفريق فعلاً بيستخدمه.',
    sample: <WhatsAppSample />,
  },
  {
    id: 'oauth-health',
    title: 'صحة الـ OAuth tokens',
    icon: ShieldCheck,
    insight: 'كل token: متى ينتهي؟ آخر مرة تجدّد؟ red/amber/green.',
    why: 'لما Gmail/Drive token ينتهي بدون تنبيه، الـ pipeline بيقع.',
    sample: <OAuthHealthSample />,
  },
  {
    id: 'cold-clients',
    title: 'عملاء صامتين',
    icon: TrendingDown,
    insight: 'عملاء سابقين، آخر مشروع لهم > ٩٠ يوم. فرصة re-engagement.',
    why: 'الـ CRM فيه history لكن مفيش "wake-up signal".',
    sample: <ColdClientsSample />,
  },
] as const;

export default function CardsLab() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto max-w-[1200px] px-6 py-10 md:px-8 md:py-14">
        <Link
          href="/preview/lab"
          className="mb-6 inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
        >
          <ArrowLeft size={13} className="rtl:rotate-180" />
          العودة
        </Link>
        <header className="mb-10 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
            القسم ٧ — كروت داش بورد جديدة
          </p>
          <h1 className="text-[32px] font-bold tracking-[-0.02em]" style={{ fontFamily: 'var(--font-display)' }}>
            ١٢ فكرة كرت إضافي
          </h1>
          <p className="max-w-2xl text-[13px] leading-relaxed text-[var(--text-muted)]">
            كل كرت معاه: عنوان، شرح، ليه نضيفه، وصورة فعلية للشكل النهائي. اختار اللي عاجبك،
            وأبنيها على الإنتاج.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {NEW_CARDS.map((c) => {
            const Icon = c.icon;
            return (
              <article key={c.id} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
                <header className="mb-3 flex items-start gap-3">
                  <div
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
                    style={{ background: 'var(--accent-tint)', color: 'var(--accent)' }}
                  >
                    <Icon size={16} strokeWidth={1.7} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[14px] font-semibold text-[var(--text)]">{c.title}</h3>
                    <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{c.insight}</p>
                  </div>
                </header>

                {/* Live sample */}
                <div className="rounded-md border border-[var(--line)] bg-[var(--bg-elevated)]/40 p-3">
                  {c.sample}
                </div>

                <p className="mt-3 flex items-start gap-1.5 text-[10px] text-[var(--text-dim)]">
                  <span className="text-[var(--accent)]">↳</span>
                  <span>{c.why}</span>
                </p>
              </article>
            );
          })}
        </div>

        <div className="mt-10 rounded-xl border border-[var(--accent)]/25 bg-[var(--accent-tint)] p-5">
          <p className="text-[12px] text-[var(--text)]">
            قولي أرقام الكروت اللي عايزها (مثال: "١، ٢، ٤، ٧، ١١"). أبنيها في الـ catalog
            وتظهرلك في زر التخصيص.
          </p>
        </div>
      </div>
    </div>
  );
}

// === Sample components ===
function CashflowSample() {
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      <div>
        <p className="font-mono text-[18px] font-bold text-green-400">٤١٠ك</p>
        <p className="text-[9px] text-[var(--text-dim)]">إيراد</p>
      </div>
      <div>
        <p className="font-mono text-[18px] font-bold text-[var(--text)]">٢٨٠ك</p>
        <p className="text-[9px] text-[var(--text-dim)]">مدفوع</p>
      </div>
      <div>
        <p className="font-mono text-[18px] font-bold text-yellow-400">١٣٠ك</p>
        <p className="text-[9px] text-[var(--text-dim)]">مستحق</p>
      </div>
    </div>
  );
}

function AICostSample() {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[20px] font-bold text-[var(--accent)]">$١٢.٤٠</span>
        <span className="text-[10px] text-[var(--text-dim)]">من $٥٠ شهري</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-hover)]">
        <div className="h-full bg-[var(--accent)]" style={{ width: '25%' }} />
      </div>
      <p className="mt-1.5 text-[10px] text-[var(--text-muted)]">Sonnet ٧٠٪ · Haiku ٢٥٪ · embed ٥٪</p>
    </div>
  );
}

function ApprovalCycleSample() {
  return (
    <ul className="space-y-1.5 text-[11px]">
      <li className="flex items-center gap-2"><span className="w-16 text-[var(--text-muted)]">المدير</span><div className="h-1 flex-1 rounded-full bg-green-500/30"><div className="h-full w-1/2 rounded-full bg-green-500" /></div><span className="font-mono text-[var(--text-muted)]">٤س</span></li>
      <li className="flex items-center gap-2"><span className="w-16 text-[var(--text-muted)]">AM</span><div className="h-1 flex-1 rounded-full bg-yellow-500/30"><div className="h-full w-3/4 rounded-full bg-yellow-500" /></div><span className="font-mono text-[var(--text-muted)]">١٢س</span></li>
      <li className="flex items-center gap-2"><span className="w-16 text-[var(--text-muted)]">العميل</span><div className="h-1 flex-1 rounded-full bg-red-500/30"><div className="h-full w-full rounded-full bg-red-500" /></div><span className="font-mono text-[var(--text-muted)]">٢٨س</span></li>
    </ul>
  );
}

function LeadTempSample() {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-[10px]">
        <span className="w-12 text-red-400">🔥 ساخن</span>
        <div className="h-2 flex-1 rounded-sm bg-red-500/20"><div className="h-full w-2/3 rounded-sm bg-red-500" /></div>
        <span className="font-mono text-[var(--text-muted)]">٤</span>
      </div>
      <div className="flex items-center gap-2 text-[10px]">
        <span className="w-12 text-yellow-400">دافئ</span>
        <div className="h-2 flex-1 rounded-sm bg-yellow-500/20"><div className="h-full w-1/2 rounded-sm bg-yellow-500" /></div>
        <span className="font-mono text-[var(--text-muted)]">٧</span>
      </div>
      <div className="flex items-center gap-2 text-[10px]">
        <span className="w-12 text-blue-400">بارد</span>
        <div className="h-2 flex-1 rounded-sm bg-blue-500/20"><div className="h-full w-1/3 rounded-sm bg-blue-500" /></div>
        <span className="font-mono text-[var(--text-muted)]">١٢</span>
      </div>
    </div>
  );
}

function EmailSLASample() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-12 w-12">
        <svg className="h-12 w-12 -rotate-90">
          <circle cx="24" cy="24" r="20" stroke="var(--line)" strokeWidth="4" fill="none" />
          <circle cx="24" cy="24" r="20" stroke="var(--accent)" strokeWidth="4" fill="none" strokeDasharray="100" strokeDashoffset="22" />
        </svg>
        <span className="absolute inset-0 grid place-items-center font-mono text-[12px] font-bold">٧٨٪</span>
      </div>
      <div>
        <p className="text-[12px] text-[var(--text)]">ضمن ٢٤س</p>
        <p className="text-[10px] text-[var(--text-dim)]">٤٢ من ٥٤ thread</p>
      </div>
    </div>
  );
}

function CapacityHeatmapSample() {
  const cells = Array.from({ length: 28 }, () => Math.floor(Math.random() * 5));
  return (
    <div className="grid grid-cols-7 gap-0.5">
      {cells.map((v, i) => (
        <div
          key={i}
          className="h-3.5 rounded-sm"
          style={{ background: v === 0 ? 'rgba(255,255,255,0.04)' : v < 2 ? 'rgba(34,197,94,0.4)' : v < 4 ? 'rgba(251,191,36,0.5)' : 'rgba(248,113,113,0.6)' }}
        />
      ))}
    </div>
  );
}

function EquipmentUtilSample() {
  return (
    <ul className="space-y-1.5 text-[11px]">
      <li className="flex items-center gap-2"><span className="w-16 text-[var(--text-muted)]">كاميرات</span><div className="h-1.5 flex-1 rounded-full bg-[var(--surface-hover)]"><div className="h-full w-4/5 rounded-full bg-[var(--accent)]" /></div><span className="font-mono text-[var(--text-muted)]">٨٠٪</span></li>
      <li className="flex items-center gap-2"><span className="w-16 text-[var(--text-muted)]">إضاءة</span><div className="h-1.5 flex-1 rounded-full bg-[var(--surface-hover)]"><div className="h-full w-2/5 rounded-full bg-[var(--accent)]" /></div><span className="font-mono text-[var(--text-muted)]">٤٠٪</span></li>
      <li className="flex items-center gap-2"><span className="w-16 text-[var(--text-muted)]">صوت</span><div className="h-1.5 flex-1 rounded-full bg-[var(--surface-hover)]"><div className="h-full w-1/4 rounded-full bg-[var(--accent)]" /></div><span className="font-mono text-[var(--text-muted)]">٢٥٪</span></li>
    </ul>
  );
}

function BottleneckSample() {
  return (
    <div>
      <p className="text-[12px] text-[var(--text)]">
        مشاريع عالقة في <span className="font-semibold text-yellow-400">"بريف معلّق"</span>
      </p>
      <p className="mt-1 font-mono text-[16px] font-bold text-[var(--text)]">١١ يوم متوسط</p>
      <p className="mt-1 text-[10px] text-[var(--text-dim)]">٤ مشاريع · أعلى من السقف ٧ أيام</p>
    </div>
  );
}

function ActivityFeedSample() {
  return (
    <ul className="space-y-1 text-[11px]">
      <li className="flex items-center gap-2"><CheckCircle2 size={10} className="text-green-400 shrink-0" /><span className="truncate text-[var(--text)]">خالد سلّم مونتاج BMW</span><span className="ms-auto text-[var(--text-dim)]">٣د</span></li>
      <li className="flex items-center gap-2"><Battery size={10} className="text-yellow-400 shrink-0" /><span className="truncate text-[var(--text)]">كاميرا Canon R5 تحت ٢٠٪</span><span className="ms-auto text-[var(--text-dim)]">١٢د</span></li>
      <li className="flex items-center gap-2"><Clock4 size={10} className="text-[var(--text-dim)] shrink-0" /><span className="truncate text-[var(--text)]">مهمة جديدة من ريم</span><span className="ms-auto text-[var(--text-dim)]">٢٢د</span></li>
    </ul>
  );
}

function WhatsAppSample() {
  return (
    <div className="flex items-baseline gap-4">
      <div>
        <p className="font-mono text-[20px] font-bold text-[var(--text)]">٢٣</p>
        <p className="text-[10px] text-[var(--text-dim)]">رسالة اليوم</p>
      </div>
      <div>
        <p className="font-mono text-[20px] font-bold text-green-400">٩١٪</p>
        <p className="text-[10px] text-[var(--text-dim)]">رد بنجاح</p>
      </div>
      <div>
        <p className="font-mono text-[14px] text-[var(--text-muted)]">١.٢س</p>
        <p className="text-[10px] text-[var(--text-dim)]">متوسط الرد</p>
      </div>
    </div>
  );
}

function OAuthHealthSample() {
  return (
    <ul className="space-y-1 text-[11px]">
      <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-green-500" /><span>Gmail</span><span className="ms-auto text-[var(--text-dim)]">صالح ٢٥د</span></li>
      <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-yellow-500" /><span>Drive</span><span className="ms-auto text-[var(--text-dim)]">ينتهي ٥٢س</span></li>
      <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-green-500" /><span>Calendar</span><span className="ms-auto text-[var(--text-dim)]">صالح ٢٢د</span></li>
    </ul>
  );
}

function ColdClientsSample() {
  return (
    <ul className="space-y-1 text-[11px]">
      <li className="flex items-center gap-2"><span className="text-[var(--text)]">BMW السعودية</span><span className="ms-auto text-[var(--text-dim)]">١٢٠ يوم</span></li>
      <li className="flex items-center gap-2"><span className="text-[var(--text)]">لكزس</span><span className="ms-auto text-[var(--text-dim)]">٩٥ يوم</span></li>
      <li className="flex items-center gap-2"><span className="text-[var(--text)]">رولز رويس</span><span className="ms-auto text-[var(--text-dim)]">٩٢ يوم</span></li>
    </ul>
  );
}
