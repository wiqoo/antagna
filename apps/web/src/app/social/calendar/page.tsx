import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sql, eq, desc } from 'drizzle-orm';
import { db, managedAccounts, contentPosts } from '@antagna/db';
import { PageHeader, StatBox } from '@antagna/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { can } from '@/lib/authz';
import { SocialTabs } from '../SocialTabs';
import { CalendarGrid } from '../calendar-grid';
import { ComposerPanel, type AccountOption } from '../ComposerPanel';
import { PostsWorkspace, type PostRow } from '../PostsWorkspace';

export const dynamic = 'force-dynamic';

const MONTH_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

export default async function SocialCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const sp = await searchParams;
  const offset = Math.max(-24, Math.min(24, Number.parseInt(sp.m ?? '0', 10) || 0));

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/social/calendar');

  const [accounts, posts, monthR, canEdit] = await Promise.all([
    db
      .select({
        id: managedAccounts.id,
        ownerLabel: managedAccounts.ownerLabel,
        platform: managedAccounts.platform,
        handle: managedAccounts.handle,
      })
      .from(managedAccounts)
      .orderBy(managedAccounts.ownerLabel)
      .limit(200),
    db
      .select({
        id: contentPosts.id,
        code: contentPosts.code,
        title: contentPosts.title,
        format: contentPosts.format,
        status: contentPosts.status,
        plannedPublishAt: contentPosts.plannedPublishAt,
        publishedAt: contentPosts.publishedAt,
        externalPostUrl: contentPosts.externalPostUrl,
        views: contentPosts.views,
        reachUnique: contentPosts.reachUnique,
        platform: managedAccounts.platform,
        accountHandle: managedAccounts.handle,
        ownerLabel: managedAccounts.ownerLabel,
      })
      .from(contentPosts)
      .innerJoin(managedAccounts, eq(managedAccounts.id, contentPosts.accountId))
      .orderBy(desc(contentPosts.createdAt))
      .limit(500),
    db.execute(sql`
      SELECT id::text AS id, title, code,
             planned_publish_at AS "plannedPublishAt", status::text AS status
      FROM content_posts
      WHERE planned_publish_at >= date_trunc('month', now()) + make_interval(months => ${offset}::int)
        AND planned_publish_at <  date_trunc('month', now()) + make_interval(months => ${offset}::int + 1)
      ORDER BY planned_publish_at`),
    can('project.update'),
  ]);

  const monthPosts = monthR as unknown as Array<{
    id: string;
    title: string;
    code: string | null;
    plannedPublishAt: string;
    status: string;
  }>;

  const accountOpts: AccountOption[] = accounts.map((a) => ({
    id: a.id,
    ownerLabel: a.ownerLabel,
    platform: a.platform,
    handle: a.handle,
  }));

  const postRows: PostRow[] = posts.map((p) => ({
    id: p.id,
    code: p.code,
    title: p.title,
    format: p.format,
    status: p.status,
    platform: p.platform,
    accountHandle: p.accountHandle,
    ownerLabel: p.ownerLabel,
    plannedPublishAt: p.plannedPublishAt ? new Date(p.plannedPublishAt).toISOString() : null,
    publishedAt: p.publishedAt ? new Date(p.publishedAt).toISOString() : null,
    externalPostUrl: p.externalPostUrl,
    views: p.views != null ? Number(p.views) : null,
    reachUnique: p.reachUnique,
  }));

  const scheduledCount = postRows.filter((p) => p.status === 'scheduled').length;
  const publishedCount = postRows.filter((p) => p.status === 'published' || p.status === 'promoted').length;

  // Month label for the nav (computed in UTC like the grid).
  const now = new Date();
  const labelDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  const monthLabel = `${MONTH_AR[labelDate.getUTCMonth()]} ${labelDate.getUTCFullYear()}`;

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/social">
      <PageHeader
        eyebrow="Social Media"
        title="التقويم والمحتوى"
        subtitle="خطّط المحتوى، جدوِل المنشورات، وحرّك كل منشور عبر دورة حياته."
      />
      <SocialTabs />

      <section className="grid grid-cols-1 gap-4 stagger-in sm:grid-cols-3">
        <StatBox label="إجمالي المنشورات" value={postRows.length} />
        <StatBox label="مجدولة" value={scheduledCount} tone="accent" />
        <StatBox label="منشورة" value={publishedCount} tone="success" />
      </section>

      <ComposerPanel accounts={accountOpts} />

      {/* Content calendar with month navigation */}
      <section className="space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-dim)]">
              — تقويم النشر
            </p>
            <h2 className="mt-3 text-xl font-semibold text-[var(--text)]">{monthLabel}</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <Link
              href={`/social/calendar?m=${offset - 1}`}
              className="grid h-9 w-9 place-items-center rounded-md border border-[var(--line)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              aria-label="الشهر السابق"
            >
              <ChevronRight size={16} />
            </Link>
            {offset !== 0 && (
              <Link
                href="/social/calendar"
                className="rounded-md border border-[var(--line)] px-3 py-1.5 text-[12px] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                اليوم
              </Link>
            )}
            <Link
              href={`/social/calendar?m=${offset + 1}`}
              className="grid h-9 w-9 place-items-center rounded-md border border-[var(--line)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              aria-label="الشهر التالي"
            >
              <ChevronLeft size={16} />
            </Link>
          </div>
        </header>
        <CalendarGrid posts={monthPosts} monthOffset={offset} />
      </section>

      {/* All posts — ListWorkspace */}
      <section className="space-y-4">
        <header>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-dim)]">
            — كل المحتوى
          </p>
          <h2 className="mt-3 text-xl font-semibold text-[var(--text)]">المنشورات</h2>
        </header>
        <PostsWorkspace rows={postRows} canEdit={canEdit} />
      </section>
    </Shell>
  );
}
