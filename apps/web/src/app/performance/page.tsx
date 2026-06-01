import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { PageHeader, Card, CardHeader, EmptyState } from '@antagna/ui';
import { Briefcase, ListChecks, Users2, FileText, Target } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { loadJobDescription } from '@/lib/job-descriptions';
import { WeeklyReportCard } from './weekly-report-card';
import { loadCurrentWeeklyReport, type WeeklyReportContent } from './weekly-report-actions';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type TeamReport = {
  id: string;
  name: string;
  weekStart: string;
  sentAt: Date | null;
  highlights: WeeklyReportContent | null;
  edited: WeeklyReportContent | null;
};

export default async function PerformancePage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/performance');

  // The logged-in person (self performance — view-as is a later iteration).
  const meRows = (await db.execute<{ id: string; position_key: string | null; display_name: string }>(sql`
    SELECT id::text, position_key, display_name
    FROM profiles WHERE auth_user_id = ${user.id}::uuid LIMIT 1
  `)) as unknown as Array<{ id: string; position_key: string | null; display_name: string }>;
  const me = meRows[0];
  if (!me) redirect('/dashboard');

  const jd = loadJobDescription(me.position_key);
  const firstName = me.display_name?.trim().split(/\s+/)[0] ?? '';

  // Resilient loads — never crash the page on a cold connection drop.
  const report = await loadCurrentWeeklyReport().catch(() => null);

  const teamReports = (await db
    .execute<TeamReport>(sql`
      SELECT wr.id::text, p.display_name AS name, wr.week_start AS "weekStart",
             wr.sent_at AS "sentAt", wr.highlights, wr.edited_highlights AS edited
      FROM weekly_reports wr
      JOIN profiles p ON p.id = wr.profile_id
      WHERE wr.sent_to_manager_id = ${me.id}::uuid AND wr.status = 'sent'
      ORDER BY wr.sent_at DESC NULLS LAST
      LIMIT 20
    `)
    .catch(() => [] as unknown as TeamReport[])) as unknown as TeamReport[];

  return (
    <Shell
      user={{ email: user.email ?? '', displayName: me.display_name }}
      activePath="/performance"
    >
      <PageHeader
        eyebrow={`أداء ${firstName}`.trim()}
        title="أدائي"
        subtitle={jd ? [jd.titleAr, jd.missionAr].filter(Boolean).join(' · ') : 'وصفك الوظيفي ومؤشّرات أدائك'}
      />

      {/* The AI weekly performance report */}
      <WeeklyReportCard initial={report} />

      {/* Job description reference — what you're accountable for */}
      {jd && jd.responsibilities.length > 0 && (
        <Card>
          <CardHeader title="مسؤولياتك" subtitle="من وصفك الوظيفي — ما يقيس عليه النظام أداءك" />
          <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {jd.responsibilities.map((r) => (
              <li key={r.key} className="flex items-start gap-2 rounded-lg border border-[var(--line)] p-3">
                <ListChecks size={15} className="mt-0.5 shrink-0 text-[var(--text-dim)]" />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[var(--text)]">{r.titleAr}</p>
                  {r.detailAr && <p className="mt-0.5 text-[11px] leading-snug text-[var(--text-muted)]">{r.detailAr}</p>}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* JD targets reference */}
      {jd && jd.kpis.length > 0 && (
        <Card>
          <CardHeader title="مؤشّرات أدائك وأهدافها" subtitle="الأهداف من وصفك الوظيفي" />
          <div className="mt-2 flex flex-wrap gap-2">
            {jd.kpis.map((k) => (
              <span
                key={k.key}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-1.5 text-[11px]"
              >
                <Target size={11} className="text-[var(--text-dim)]" />
                <span className="text-[var(--text)]">{k.titleAr}</span>
                <span className="font-mono text-[var(--text-muted)]">
                  {k.direction === 'lower' ? '≤' : '≥'}{k.target}
                  {k.unit === 'pct' ? '٪' : k.unit === 'hours' ? 'س' : k.unit === 'ratio' ? '/٥' : ''}
                </span>
                {!k.measurable && <span className="text-[9px] text-[var(--text-dim)]">(قريباً)</span>}
              </span>
            ))}
          </div>
        </Card>
      )}

      {!jd && (
        <Card>
          <EmptyState
            icon={<Briefcase size={20} />}
            title="لا يوجد وصف وظيفي لمنصبك بعد"
            description="أضِف منصبك أو عرّف الوصف في config/job-descriptions.yaml ليبدأ النظام بقياس أدائك."
          />
        </Card>
      )}

      {/* Manager view — weekly reports your team sent you */}
      {teamReports.length > 0 && (
        <Card>
          <CardHeader title="تقارير فريقك" subtitle={`${teamReports.length} تقرير أسبوعي وصلك`} />
          <ul className="mt-2 divide-y divide-[var(--line)]">
            {teamReports.map((t) => {
              const content = t.edited ?? t.highlights;
              return (
                <li key={t.id} className="flex items-start gap-3 py-3">
                  <Users2 size={16} className="mt-0.5 shrink-0 text-[var(--text-dim)]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-[var(--text)]">
                      {t.name}
                      <span className="ms-2 text-[11px] font-normal text-[var(--text-muted)]">{content?.headline ?? ''}</span>
                    </p>
                    {content?.summary_ar && (
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[var(--text-muted)]">{content.summary_ar}</p>
                    )}
                    {content?.concerns && content.concerns.length > 0 && (
                      <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-amber-400">
                        <FileText size={10} /> {content.concerns.length} ملاحظة تحتاج انتباهك
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-[10px] text-[var(--text-dim)]">
                    {t.sentAt ? new Date(t.sentAt).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' }) : ''}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </Shell>
  );
}
