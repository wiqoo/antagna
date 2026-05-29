import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sql, eq, desc } from 'drizzle-orm';
import { db, managedAccounts, contentPosts, sponsoredDeals } from '@antagna/db';
import {
  PageHeader,
  Card,
  StatBox,
  StatusPill,
  EmptyState,
  AIHints,
  type AIHint,
} from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { AtSign, CalendarDays, Megaphone, BarChart3, ArrowLeft } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getTranslations } from 'next-intl/server';
import { SocialTabs } from './SocialTabs';
import { CalendarGrid } from './calendar-grid';
import {
  PLATFORM_ICON,
  POST_STATUS_LABEL_AR,
  POST_STATUS_TONE,
  fmtNum,
} from './_shared';

export const dynamic = 'force-dynamic';

const rows = <T,>(r: unknown): T[] => r as unknown as T[];

export default async function SocialPage() {
  const supabase = await getSupabaseServerClient();
  const t = await getTranslations('pages.social');
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/social');

  const [accounts, recentPosts, deals, monthR, statsR] = await Promise.all([
    db
      .select({
        id: managedAccounts.id,
        platform: managedAccounts.platform,
        handle: managedAccounts.handle,
        ownerLabel: managedAccounts.ownerLabel,
        followerCount: managedAccounts.followerCount,
      })
      .from(managedAccounts)
      .orderBy(desc(managedAccounts.followerCount))
      .limit(6),
    db
      .select({
        id: contentPosts.id,
        title: contentPosts.title,
        status: contentPosts.status,
        platform: managedAccounts.platform,
        accountHandle: managedAccounts.handle,
        ownerLabel: managedAccounts.ownerLabel,
      })
      .from(contentPosts)
      .innerJoin(managedAccounts, eq(managedAccounts.id, contentPosts.accountId))
      .orderBy(desc(contentPosts.createdAt))
      .limit(8),
    db
      .select({ status: sponsoredDeals.status, value: sponsoredDeals.contractValueSar })
      .from(sponsoredDeals)
      .limit(500),
    db.execute(sql`
      SELECT id::text AS id, title, code,
             planned_publish_at AS "plannedPublishAt", status::text AS status
      FROM content_posts
      WHERE planned_publish_at >= date_trunc('month', now())
        AND planned_publish_at <  date_trunc('month', now()) + interval '1 month'
      ORDER BY planned_publish_at`),
    db.execute(sql`
      SELECT
        (SELECT count(*) FROM managed_accounts)                           AS accounts,
        (SELECT COALESCE(SUM(follower_count),0) FROM managed_accounts)    AS followers,
        (SELECT count(*) FROM content_posts)                             AS posts,
        (SELECT count(*) FROM content_posts WHERE status = 'scheduled')   AS scheduled,
        (SELECT count(*) FROM content_posts WHERE status IN ('published','promoted')) AS published`),
  ]);

  const monthPosts = rows<{
    id: string;
    title: string;
    code: string | null;
    plannedPublishAt: string;
    status: string;
  }>(monthR);

  const s = rows<{
    accounts: number;
    followers: number;
    posts: number;
    scheduled: number;
    published: number;
  }>(statsR)[0] ?? { accounts: 0, followers: 0, posts: 0, scheduled: 0, published: 0 };

  const activeDeals = deals.filter((d) => d.status === 'agreed' || d.status === 'in_progress').length;
  const pipelineValue = deals
    .filter((d) => d.status !== 'cancelled')
    .reduce((acc, d) => acc + (d.value != null ? Number(d.value) : 0), 0);

  const isEmpty = Number(s.accounts) === 0;

  // AI hints driven by real state (AI proposes; user acts via the linked tabs).
  const hints: AIHint[] = [];
  if (isEmpty) {
    hints.push({
      index: '01',
      text: 'ابدأ بإضافة الحسابات المُدارة',
      insight: 'لا توجد حسابات بعد — أضف حسابات أبو لوكا / مها / كبسي يدوياً لتفعيل بقية الوحدة.',
      actions: [{ label: 'إضافة حساب', href: '/social/accounts', primary: true }],
    });
  } else {
    if (Number(s.scheduled) === 0 && Number(s.posts) > 0) {
      hints.push({
        index: '01',
        text: 'لا يوجد محتوى مجدول هذا الشهر',
        insight: 'جدوِل منشورات قادمة لتملأ تقويم النشر وتحافظ على إيقاع النشر.',
        actions: [{ label: 'فتح التقويم', href: '/social/calendar', primary: true }],
      });
    }
    if (Number(s.posts) === 0) {
      hints.push({
        index: String(hints.length + 1).padStart(2, '0'),
        text: 'الحسابات جاهزة — أضف أول فكرة محتوى',
        insight: 'استخدم composer في تبويب التقويم لبدء التخطيط.',
        actions: [{ label: 'إنشاء محتوى', href: '/social/calendar', primary: true }],
      });
    }
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: 'سجّل لقطات الأداء أسبوعياً',
      insight: 'إدخال reach/engagement يدوياً يبني سلاسل بيانات تكشف أفضل المنشورات.',
      actions: [{ label: 'فتح التحليلات', href: '/social/analytics' }],
    });
  }

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/social">
      <PageHeader eyebrow={t('eyebrow')} title={t('title')} subtitle={t('subtitle')} />
      <SocialTabs />

      {hints.length > 0 && (
        <AIHints context="Antagna AI · السوشيال ميديا" hints={hints} compact />
      )}

      <section className="grid grid-cols-2 gap-4 stagger-in sm:grid-cols-4">
        <StatBox label="حسابات" value={Number(s.accounts)} />
        <StatBox label="إجمالي المتابعين" value={Number(s.followers)} format={fmtNum(s.followers)} />
        <StatBox label="منشورات" value={Number(s.posts)} />
        <StatBox
          label="صفقات نشطة"
          value={activeDeals}
          sub={pipelineValue > 0 ? `${fmtNum(pipelineValue)} ر.س pipeline` : undefined}
          tone="accent"
        />
      </section>

      {isEmpty ? (
        <Card>
          <EmptyState
            icon={<AtSign size={18} />}
            title="لا يوجد حسابات مُدارة بعد"
            description="أضف أول حساب لتفعيل التقويم والصفقات والتحليلات. تتبّع يدوي بالكامل — بدون نشر تلقائي (D-028)."
            action={
              <Link
                href="/social/accounts"
                className="magnet inline-flex h-9 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-black hover:opacity-90"
              >
                إضافة حساب مُدار
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          {/* Quick-nav cards */}
          <section className="grid grid-cols-1 gap-3 stagger-in sm:grid-cols-2 lg:grid-cols-4">
            <NavCard href="/social/accounts" icon={<AtSign size={16} />} title="الحسابات" sub={`${Number(s.accounts)} حساب`} />
            <NavCard href="/social/calendar" icon={<CalendarDays size={16} />} title="التقويم والمحتوى" sub={`${Number(s.scheduled)} مجدول`} />
            <NavCard href="/social/deals" icon={<Megaphone size={16} />} title="صفقات الرعاية" sub={`${activeDeals} نشطة`} />
            <NavCard href="/social/analytics" icon={<BarChart3 size={16} />} title="التحليلات" sub={`${Number(s.published)} منشور`} />
          </section>

          {/* Top accounts */}
          <section className="space-y-4">
            <header className="flex items-end justify-between gap-4">
              <h2 className="text-xl font-semibold text-[var(--text)]">أكبر الحسابات</h2>
              <Link href="/social/accounts" className="inline-flex items-center gap-1 text-[12px] text-[var(--accent)] hover:underline">
                الكل <ArrowLeft size={13} />
              </Link>
            </header>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {accounts.map((a) => {
                const Icon = PLATFORM_ICON[a.platform] ?? AtSign;
                return (
                  <Link
                    key={a.id}
                    href="/social/accounts"
                    className="flex items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)]/60 p-4 hover:border-[var(--line-strong)]"
                  >
                    <div className="grid h-10 w-10 place-items-center rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--accent)]">
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-[var(--text)]">@{a.handle}</p>
                      <p className="truncate text-[11px] text-[var(--text-muted)]">{a.ownerLabel}</p>
                    </div>
                    <span className="font-mono text-[14px] font-semibold tabular text-[var(--text)]">
                      {fmtNum(a.followerCount)}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Recent content */}
          <section className="space-y-4">
            <header className="flex items-end justify-between gap-4">
              <h2 className="text-xl font-semibold text-[var(--text)]">أحدث المحتوى</h2>
              <Link href="/social/calendar" className="inline-flex items-center gap-1 text-[12px] text-[var(--accent)] hover:underline">
                التقويم <ArrowLeft size={13} />
              </Link>
            </header>
            {recentPosts.length === 0 ? (
              <Card>
                <EmptyState icon={<Megaphone size={18} />} title="لا يوجد محتوى بعد" description="أضف أول فكرة من تبويب التقويم." />
              </Card>
            ) : (
              <Card padded={false}>
                <ul className="divide-y divide-[var(--line)]">
                  {recentPosts.map((p) => {
                    const Icon = PLATFORM_ICON[p.platform] ?? AtSign;
                    return (
                      <li key={p.id} className="flex items-center gap-3 px-4 py-3 sm:px-6">
                        <Icon size={14} className="shrink-0 text-[var(--text-dim)]" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] text-[var(--text)]">{p.title}</p>
                          <p className="truncate text-[11px] text-[var(--text-muted)]">@{p.accountHandle} · {p.ownerLabel}</p>
                        </div>
                        <StatusPill tone={POST_STATUS_TONE[p.status] ?? 'neutral'}>
                          {POST_STATUS_LABEL_AR[p.status] ?? p.status}
                        </StatusPill>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            )}
          </section>

          {/* Month calendar preview */}
          <section className="space-y-4">
            <header className="flex items-end justify-between gap-4">
              <h2 className="text-xl font-semibold text-[var(--text)]">تقويم هذا الشهر</h2>
              <Link href="/social/calendar" className="inline-flex items-center gap-1 text-[12px] text-[var(--accent)] hover:underline">
                إدارة <ArrowLeft size={13} />
              </Link>
            </header>
            <CalendarGrid posts={monthPosts} />
          </section>
        </>
      )}
    </Shell>
  );
}

function NavCard({
  href,
  icon,
  title,
  sub,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="magnet group flex items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)]/60 p-4 transition-colors hover:border-[var(--line-strong)]"
    >
      <div className="grid h-9 w-9 place-items-center rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--accent)]">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-[var(--text)] group-hover:text-[var(--accent)]">{title}</p>
        <p className="text-[11px] text-[var(--text-muted)]">{sub}</p>
      </div>
    </Link>
  );
}
