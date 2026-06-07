import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { PageHeader, Card, CardHeader, EmptyState } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import Link from 'next/link';
import {
  Sparkles, Brain, Inbox, DollarSign, Database, Gauge, RefreshCw,
  ArrowRight, Mail, Building2, ListChecks,
} from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { canAny } from '@/lib/authz';

export const dynamic = 'force-dynamic';

const FEATURE_AR: Record<string, string> = {
  email_thread_summary: 'تلخيص محادثات البريد',
  email_thread_classify: 'تصنيف البريد',
  email_thread_next_actions: 'اقتراح الخطوة التالية',
  gmail_summarize: 'فرز الوارد التلقائي',
  email_intel_extract: 'الاستخراج الذكي (عميل/جهة اتصال)',
  client_enrichment: 'إثراء العملاء (بحث ويب)',
  ai_daily_routine: 'روتين اليوم',
  whatsapp_bot: 'مساعد واتساب',
  daily_brief: 'الموجز اليومي',
};
const SCOPE_AR: Record<string, string> = {
  client: 'العملاء',
  project: 'المشاريع',
  email_intel: 'ذكاء البريد',
  email_thread: 'محادثات البريد',
  activity: 'النشاط',
  audit: 'التدقيق',
  global: 'عام',
  lead: 'الفرص',
};

const n = (v: unknown) => Number(v ?? 0);

export default async function AiCenterPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/ai');

  // Gate: the AI control tower is for admins / managers.
  const allowed = await canAny(['ai.cost_dashboard.read', 'access.manage', 'settings.update']);
  if (!allowed) redirect('/dashboard');

  const [
    costMtdRes, costByFeatureRes, memTotalRes, memByScopeRes,
    suggRes, extractRes, cacheRes, enrichRes, routineRes, recentRes,
  ] = await Promise.all([
    db.execute<{ cost: string; calls: number }>(sql`
      SELECT COALESCE(SUM(cost_usd),0)::text AS cost, COUNT(*)::int AS calls
      FROM ai_usage WHERE created_at >= date_trunc('month', now())`),
    db.execute<{ feature: string; cost: string; calls: number; tokens: number }>(sql`
      SELECT feature, COALESCE(SUM(cost_usd),0)::text AS cost, COUNT(*)::int AS calls,
             COALESCE(SUM(input_tokens),0)::int AS tokens
      FROM ai_usage WHERE created_at >= date_trunc('month', now())
      GROUP BY feature ORDER BY SUM(cost_usd) DESC LIMIT 12`),
    db.execute<{ total: number; useful: number }>(sql`
      SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE useful)::int AS useful FROM ai_memory_chunks`),
    db.execute<{ scope: string; cnt: number }>(sql`
      SELECT scope, COUNT(*)::int AS cnt FROM ai_memory_chunks GROUP BY scope ORDER BY cnt DESC LIMIT 10`),
    db.execute<{ pending: number }>(sql`SELECT COUNT(*)::int AS pending FROM ai_suggestions WHERE status = 'pending'`),
    db.execute<{ total: number; today: number }>(sql`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE extracted_at >= date_trunc('day', now()))::int AS today
      FROM email_extractions`),
    db.execute<{ rows: number; last: string | null }>(sql`
      SELECT COUNT(*)::int AS rows, MAX(computed_at)::text AS last FROM dashboard_board_cache`),
    db.execute<{ cnt: number }>(sql`SELECT COUNT(*)::int AS cnt FROM clients WHERE custom_fields ? 'enrichment'`),
    db.execute<{ cnt: number }>(sql`SELECT COUNT(*)::int AS cnt FROM daily_tasks WHERE source_key LIKE 'ai_routine:%'`),
    db.execute<{ feature: string; model: string; created_at: string }>(sql`
      SELECT feature, model, created_at::text AS created_at FROM ai_usage ORDER BY created_at DESC LIMIT 8`),
  ]);

  const costMtd = n((costMtdRes as unknown as Array<{ cost: string }>)[0]?.cost);
  const callsMtd = n((costMtdRes as unknown as Array<{ calls: number }>)[0]?.calls);
  const byFeature = costByFeatureRes as unknown as Array<{ feature: string; cost: string; calls: number; tokens: number }>;
  const memTotal = n((memTotalRes as unknown as Array<{ total: number }>)[0]?.total);
  const memUseful = n((memTotalRes as unknown as Array<{ useful: number }>)[0]?.useful);
  const byScope = memByScopeRes as unknown as Array<{ scope: string; cnt: number }>;
  const pending = n((suggRes as unknown as Array<{ pending: number }>)[0]?.pending);
  const extractTotal = n((extractRes as unknown as Array<{ total: number }>)[0]?.total);
  const extractToday = n((extractRes as unknown as Array<{ today: number }>)[0]?.today);
  const cacheRows = n((cacheRes as unknown as Array<{ rows: number }>)[0]?.rows);
  const cacheLast = (cacheRes as unknown as Array<{ last: string | null }>)[0]?.last ?? null;
  const enriched = n((enrichRes as unknown as Array<{ cnt: number }>)[0]?.cnt);
  const routineCount = n((routineRes as unknown as Array<{ cnt: number }>)[0]?.cnt);
  const recent = recentRes as unknown as Array<{ feature: string; model: string; created_at: string }>;

  const maxFeatureCost = Math.max(0.000001, ...byFeature.map((f) => n(f.cost)));
  const maxScope = Math.max(1, ...byScope.map((s) => s.cnt));

  const QUICK = [
    { href: '/inbox/suggestions', label: 'الاقتراحات', desc: `${pending} بانتظار المراجعة`, Icon: Sparkles },
    { href: '/inbox', label: 'الوارد الذكي', desc: 'تصنيف + تلخيص تلقائي', Icon: Mail },
    { href: '/crm', label: 'العملاء + الإثراء', desc: `${enriched} عميل مُثرَى`, Icon: Building2 },
    { href: '/calendar', label: 'التقويم', desc: 'جدول + اقتراحات', Icon: ListChecks },
  ];

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/ai">
      <PageHeader
        eyebrow="AI Center"
        title={<span className="inline-flex items-center gap-2"><Sparkles size={20} className="text-[var(--accent)]" /> مركز الذكاء الاصطناعي</span>}
        subtitle="كل ما يفعله الـ AI في النظام — التكلفة، الذاكرة، الاقتراحات، والحوسبة المسبقة — في مكان واحد."
      />

      {/* Overview */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="تكلفة الشهر" value={`$${costMtd.toFixed(2)}`} icon={<DollarSign size={16} />} sub={`${callsMtd} استدعاء`} />
        <Stat label="اقتراحات معلّقة" value={String(pending)} icon={<Sparkles size={16} />} tone={pending > 0 ? 'warning' : 'default'} sub="من البريد" />
        <Stat label="حجم الذاكرة" value={String(memTotal)} icon={<Brain size={16} />} sub={`${memUseful} مفيدة`} />
        <Stat label="استخراجات ذكية" value={String(extractTotal)} icon={<Database size={16} />} sub={`${extractToday} اليوم`} />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Cost by feature */}
        <Card padded={false}>
          <div className="p-6 pb-3"><CardHeader title="التكلفة حسب الميزة" subtitle="هذا الشهر (MTD)" /></div>
          <div className="space-y-2 px-6 pb-6">
            {byFeature.length === 0 ? (
              <p className="text-[12px] text-[var(--text-dim)]">لا استخدام بعد هذا الشهر.</p>
            ) : byFeature.map((f) => (
              <div key={f.feature} className="space-y-1">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-[var(--text)]">{FEATURE_AR[f.feature] ?? f.feature}</span>
                  <span className="font-mono text-[var(--text-muted)]">${n(f.cost).toFixed(3)} · {f.calls}×</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface)]">
                  <div className="h-full rounded-full bg-[var(--accent)]/60" style={{ width: `${(n(f.cost) / maxFeatureCost) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Brain / memory */}
        <Card padded={false}>
          <div className="p-6 pb-3">
            <CardHeader
              title={<span className="inline-flex items-center gap-2"><Brain size={14} className="text-[var(--accent)]" /> الذاكرة (البرين)</span>}
              subtitle={`${memTotal} مقطع — ما تعلّمه النظام ويستدعيه في الاقتراحات`}
            />
          </div>
          <div className="space-y-2 px-6 pb-6">
            {byScope.length === 0 ? (
              <p className="text-[12px] text-[var(--text-dim)]">الذاكرة فارغة — تمتلئ من البريد والإثراء والنشاط.</p>
            ) : byScope.map((s) => (
              <div key={s.scope} className="flex items-center gap-3">
                <span className="w-24 shrink-0 truncate text-[12px] text-[var(--text-muted)]">{SCOPE_AR[s.scope] ?? s.scope}</span>
                <div className="h-3 flex-1 overflow-hidden rounded bg-[var(--surface)]">
                  <div className="h-full rounded bg-[var(--accent)]/40" style={{ width: `${(s.cnt / maxScope) * 100}%` }} />
                </div>
                <span className="w-8 shrink-0 text-end font-mono text-[11px] text-[var(--text)]">{s.cnt}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Engine status */}
      <Card padded={false}>
        <div className="p-6 pb-3"><CardHeader title="حالة المحرّك" subtitle="الحوسبة المسبقة + ما ينتجه الـ AI تلقائياً" /></div>
        <div className="grid grid-cols-2 gap-px bg-[var(--line)] lg:grid-cols-4">
          <StatusTile Icon={RefreshCw} label="كاش الداشبورد" value={`${cacheRows} ملف`} sub={cacheLast ? `آخر حساب ${cacheLast.slice(0, 16).replace('T', ' ')}` : 'لم يُحسب بعد'} />
          <StatusTile Icon={Sparkles} label="اقتراحات معلّقة" value={String(pending)} sub="من البريد" href="/inbox/suggestions" />
          <StatusTile Icon={ListChecks} label="روتين AI" value={String(routineCount)} sub="مهام مُخطَّطة" />
          <StatusTile Icon={Building2} label="عملاء مُثرَون" value={String(enriched)} sub="ببحث الويب" href="/crm" />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Quick links */}
        <Card className="lg:col-span-2">
          <CardHeader title="روابط سريعة" subtitle="افتح ما يحرّكه الـ AI" />
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {QUICK.map((q) => (
              <Link key={q.href} href={q.href} className="group flex items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)]/40 p-3 hover:border-[var(--accent)]">
                <span className="grid h-9 w-9 place-items-center rounded-md bg-[var(--accent)]/10 text-[var(--accent)]"><q.Icon size={16} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-[var(--text)]">{q.label}</p>
                  <p className="truncate text-[11px] text-[var(--text-dim)]">{q.desc}</p>
                </div>
                <ArrowRight size={14} className="text-[var(--text-dim)] group-hover:text-[var(--accent)] rtl:rotate-180" />
              </Link>
            ))}
          </div>
        </Card>

        {/* Recent AI activity */}
        <Card padded={false}>
          <div className="p-6 pb-3"><CardHeader title="آخر نشاط" subtitle="أحدث استدعاءات الـ AI" /></div>
          {recent.length === 0 ? (
            <div className="px-6 pb-6"><EmptyState icon={<Gauge size={18} />} title="لا نشاط بعد" description="سيظهر هنا فور أول استدعاء." /></div>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {recent.map((r, i) => (
                <li key={i} className="flex items-center justify-between gap-2 px-6 py-2.5 text-[12px]">
                  <span className="truncate text-[var(--text)]">{FEATURE_AR[r.feature] ?? r.feature}</span>
                  <span className="shrink-0 font-mono text-[10px] text-[var(--text-dim)]">{r.created_at.slice(5, 16).replace('T', ' ')}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </Shell>
  );
}

function Stat({ label, value, icon, sub, tone }: { label: string; value: string; icon: React.ReactNode; sub?: string; tone?: 'warning' | 'default' }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)]/40 p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[var(--text-dim)]">{label}</span>
        <span className={tone === 'warning' ? 'text-[var(--warning)]' : 'text-[var(--text-dim)]'}>{icon}</span>
      </div>
      <p className="mt-2 font-mono text-[24px] font-bold text-[var(--text)]">{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-[var(--text-dim)]">{sub}</p>}
    </div>
  );
}

function StatusTile({ Icon, label, value, sub, href }: { Icon: typeof RefreshCw; label: string; value: string; sub: string; href?: string }) {
  const body = (
    <div className="flex h-full flex-col gap-1 bg-[var(--bg)] p-4 hover:bg-[var(--surface-hover)]">
      <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-dim)]"><Icon size={12} /> {label}</span>
      <span className="font-mono text-[20px] font-semibold text-[var(--text)]">{value}</span>
      <span className="text-[10px] text-[var(--text-dim)]">{sub}</span>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
