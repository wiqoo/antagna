import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { PageHeader, StatBox, Card, StatusPill, EmptyState } from '@antagna/ui';
import { BarChart3 } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { can } from '@/lib/authz';
import { SocialTabs } from '../SocialTabs';
import { AnalyticsBars, type DayBar } from '../AnalyticsBars';
import { SnapshotRecorder, type SnapshotPostOption } from '../SnapshotRecorder';
import { PLATFORM_ICON, fmtNum } from '../_shared';

export const dynamic = 'force-dynamic';

const rows = <T,>(r: unknown): T[] => r as unknown as T[];

export default async function SocialAnalyticsPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/social/analytics');

  const [dailyR, topR, postOptsR, totalsR, canEdit] = await Promise.all([
    // Daily aggregate over the last 30 days of snapshots.
    db.execute(sql`
      SELECT to_char(date_trunc('day', captured_at), 'YYYY-MM-DD') AS day,
             COALESCE(SUM(reach_unique), 0)::bigint AS reach,
             COALESCE(SUM(views), 0)::bigint        AS views,
             COALESCE(SUM(likes + comments + shares + saves), 0)::bigint AS engagement
      FROM post_analytics_snapshots
      WHERE captured_at >= now() - interval '30 days'
      GROUP BY 1
      ORDER BY 1`),
    // Top posts by latest cached reach.
    db.execute(sql`
      SELECT cp.id::text AS id, cp.title, cp.status::text AS status,
             cp.reach_unique AS reach, cp.views, cp.engagement_rate AS er,
             ma.handle AS handle, ma.platform::text AS platform
      FROM content_posts cp
      JOIN managed_accounts ma ON ma.id = cp.account_id
      WHERE cp.metrics_cached_at IS NOT NULL
      ORDER BY cp.reach_unique DESC NULLS LAST, cp.views DESC NULLS LAST
      LIMIT 10`),
    // Posts available to attach a snapshot to.
    db.execute(sql`
      SELECT cp.id::text AS id, cp.title, ma.handle AS "accountHandle"
      FROM content_posts cp
      JOIN managed_accounts ma ON ma.id = cp.account_id
      ORDER BY cp.created_at DESC
      LIMIT 300`),
    db.execute(sql`
      SELECT
        COALESCE(SUM(reach_unique), 0)::bigint AS reach,
        COALESCE(SUM(views), 0)::bigint        AS views,
        COUNT(*)::int                          AS snapshots,
        COUNT(DISTINCT post_id)::int           AS posts
      FROM post_analytics_snapshots`),
    can('project.update'),
  ]);

  const daily = rows<{ day: string; reach: string; views: string; engagement: string }>(dailyR);
  const reachSeries: DayBar[] = daily.map((d) => ({ day: d.day, value: Number(d.reach) }));
  const engSeries: DayBar[] = daily.map((d) => ({ day: d.day, value: Number(d.engagement) }));

  const top = rows<{
    id: string;
    title: string;
    status: string;
    reach: number | null;
    views: string | null;
    er: string | null;
    handle: string;
    platform: string;
  }>(topR);

  const postOpts = rows<SnapshotPostOption>(postOptsR);
  const totals = rows<{ reach: string; views: string; snapshots: number; posts: number }>(totalsR)[0] ?? {
    reach: '0',
    views: '0',
    snapshots: 0,
    posts: 0,
  };

  const hasData = Number(totals.snapshots) > 0;

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/social">
      <PageHeader
        eyebrow="Social Media"
        title="التحليلات"
        subtitle="أداء المحتوى عبر الزمن — لقطات يدوية، لا سحب تلقائي عبر API (D-028)."
      />
      <SocialTabs />

      <section className="grid grid-cols-2 gap-4 stagger-in sm:grid-cols-4">
        <StatBox label="إجمالي الوصول" value={Number(totals.reach)} format={fmtNum(totals.reach)} tone="accent" />
        <StatBox label="إجمالي المشاهدات" value={Number(totals.views)} format={fmtNum(totals.views)} />
        <StatBox label="منشورات متتبَّعة" value={Number(totals.posts)} />
        <StatBox label="لقطات مُسجّلة" value={Number(totals.snapshots)} />
      </section>

      {canEdit && <SnapshotRecorder posts={postOpts} />}

      {!hasData ? (
        <Card>
          <EmptyState
            icon={<BarChart3 size={18} />}
            title="لا توجد بيانات تحليلية بعد"
            description="سجّل لقطة أداء لأي منشور (مشاهدات، وصول، تفاعل) لتبدأ سلاسل البيانات بالظهور هنا."
          />
        </Card>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <AnalyticsBars series={reachSeries} label="الوصول (reach) — آخر ٣٠ يوم" unit="وصول" />
            <AnalyticsBars
              series={engSeries}
              label="التفاعل — آخر ٣٠ يوم"
              accent="var(--success)"
              unit="تفاعل"
            />
          </section>

          {/* Top posts */}
          <section className="space-y-4">
            <header>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-dim)]">
                — الأفضل أداءً
              </p>
              <h2 className="mt-3 text-xl font-semibold text-[var(--text)]">أعلى المنشورات وصولاً</h2>
            </header>
            <Card padded={false}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--line)] bg-[var(--bg-elevated)]/60 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
                      <th className="px-5 py-3 text-start">المنشور</th>
                      <th className="px-5 py-3 text-end">الوصول</th>
                      <th className="px-5 py-3 text-end">المشاهدات</th>
                      <th className="px-5 py-3 text-end">معدل التفاعل</th>
                      <th className="px-5 py-3 text-start">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line)]">
                    {top.map((p) => {
                      const Icon = PLATFORM_ICON[p.platform];
                      return (
                        <tr key={p.id} className="hover:bg-[var(--surface-hover)]">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2.5">
                              {Icon && <Icon size={14} className="shrink-0 text-[var(--text-dim)]" />}
                              <div className="min-w-0">
                                <p className="truncate text-[13px] text-[var(--text)]">{p.title}</p>
                                <p className="truncate text-[11px] text-[var(--text-muted)]">@{p.handle}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-end font-mono text-[12px] tabular text-[var(--text)]">
                            {fmtNum(p.reach)}
                          </td>
                          <td className="px-5 py-3 text-end font-mono text-[12px] tabular text-[var(--text-muted)]">
                            {fmtNum(p.views)}
                          </td>
                          <td className="px-5 py-3 text-end font-mono text-[12px] tabular text-[var(--text-muted)]">
                            {p.er != null ? `${(Number(p.er) * 100).toFixed(1)}%` : '—'}
                          </td>
                          <td className="px-5 py-3">
                            <StatusPill tone={p.status === 'published' || p.status === 'promoted' ? 'success' : 'neutral'}>
                              {p.status}
                            </StatusPill>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>
        </>
      )}
    </Shell>
  );
}
