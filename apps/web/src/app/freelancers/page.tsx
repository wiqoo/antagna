import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import {
  PageHeader,
  Card,
  StatusPill,
  EmptyState,
  Avatar,
  MiniStat,
  CardsGrid,
} from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { Users, Star, MapPin, Sparkles } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const rows = <T,>(r: unknown): T[] => r as unknown as T[];

type Freelancer = {
  id: string;
  code: string;
  fullName: string;
  fullNameAr: string | null;
  specialties: string[] | null;
  cityBase: string | null;
  defaultRateSar: string | null;
  defaultRateUnit: string | null;
  projectsCompleted: number;
  averageRating: string | null;
  lastWorkedAt: string | null;
  preferred: boolean;
};

const RATE_UNIT_AR: Record<string, string> = {
  per_day: '/ يوم',
  per_project: '/ مشروع',
  per_hour: '/ ساعة',
};

function idleDays(last: string | null): number | null {
  if (!last) return null;
  return Math.floor((Date.now() - new Date(last).getTime()) / 86_400_000);
}

export default async function FreelancersPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/freelancers');

  const list = rows<Freelancer>(
    await db.execute(sql`
      SELECT id::text AS id, code, full_name AS "fullName", full_name_ar AS "fullNameAr",
             specialties, city_base AS "cityBase",
             default_rate_sar AS "defaultRateSar", default_rate_unit AS "defaultRateUnit",
             projects_completed AS "projectsCompleted", average_rating AS "averageRating",
             last_worked_at AS "lastWorkedAt", preferred
      FROM freelancers
      WHERE archived_at IS NULL AND active
      ORDER BY preferred DESC, last_worked_at DESC NULLS LAST, full_name`),
  );

  const preferredCount = list.filter((f) => f.preferred).length;
  const idleCount = list.filter((f) => {
    const d = idleDays(f.lastWorkedAt);
    return d === null || d >= 90;
  }).length;

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/team">
      <PageHeader
        eyebrow="People · Freelancers"
        title="الفريلانسرز"
        subtitle={`${list.length} فريلانسر · ${preferredCount} مفضّل`}
      />

      <CardsGrid>
        <MiniStat span={4} label="إجمالي" value={list.length} tone="accent" />
        <MiniStat span={4} label="مفضّلون" value={preferredCount} sub="تعاون متكرر" />
        <MiniStat
          span={4}
          label="غير نشطين"
          value={idleCount}
          tone={idleCount > 0 ? 'warning' : 'default'}
          sub="٩٠+ يوماً بلا عمل"
        />
      </CardsGrid>

      <Card padded={false} className="overflow-hidden">
        {list.length === 0 ? (
          <EmptyState
            icon={<Users size={20} />}
            title="لا فريلانسرز بعد"
            description="أضف الفريلانسرز لإسنادهم إلى المشاريع وتتبّع تعاونك معهم."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--bg-elevated)]/40 text-start text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-dim)]">
                  <th className="px-5 py-3 text-start">الفريلانسر</th>
                  <th className="px-5 py-3 text-start">التخصصات</th>
                  <th className="px-5 py-3 text-start">المدينة</th>
                  <th className="px-5 py-3 text-start">السعر</th>
                  <th className="px-5 py-3 text-start">التقييم</th>
                  <th className="px-5 py-3 text-start">مشاريع</th>
                  <th className="px-5 py-3 text-start">آخر عمل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {list.map((f) => {
                  const d = idleDays(f.lastWorkedAt);
                  return (
                    <tr key={f.id} className="hover:bg-[var(--surface-hover)]">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={f.fullNameAr ?? f.fullName} size="sm" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <Link
                                href={`/freelancers/${f.id}`}
                                className="text-[var(--text)] hover:text-[var(--accent)]"
                              >
                                {f.fullNameAr ?? f.fullName}
                              </Link>
                              {f.preferred && (
                                <Sparkles size={11} className="text-[var(--accent)]" />
                              )}
                            </div>
                            <span className="font-mono text-[10px] text-[var(--text-dim)]">
                              {f.code}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {(f.specialties ?? []).slice(0, 3).map((s, i) => (
                            <span
                              key={i}
                              className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-[12px] text-[var(--text-muted)]">
                        {f.cityBase ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={11} className="text-[var(--text-dim)]" />
                            {f.cityBase}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[12px] text-[var(--text-muted)]">
                        {f.defaultRateSar
                          ? `${Number(f.defaultRateSar).toLocaleString('en-US')} ${RATE_UNIT_AR[f.defaultRateUnit ?? ''] ?? ''}`
                          : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        {f.averageRating ? (
                          <span className="inline-flex items-center gap-1 text-[12px] text-[var(--text)]">
                            <Star size={11} className="fill-[var(--accent)] text-[var(--accent)]" />
                            {Number(f.averageRating).toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-[11px] text-[var(--text-dim)]">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[12px] text-[var(--text-muted)]">
                        {f.projectsCompleted}
                      </td>
                      <td className="px-5 py-3.5">
                        {f.lastWorkedAt ? (
                          <StatusPill
                            tone={d !== null && d >= 90 ? 'warning' : 'neutral'}
                            withDot={false}
                          >
                            {d}ي
                          </StatusPill>
                        ) : (
                          <span className="text-[11px] text-[var(--text-dim)]">لم يعمل</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Shell>
  );
}
