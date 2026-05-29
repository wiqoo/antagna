import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import {
  PageHeader,
  Card,
  EmptyState,
  MiniStat,
  CardsGrid,
} from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { Users } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { FreelancersWorkspace, type FreelancerRow } from './FreelancersWorkspace';

export const dynamic = 'force-dynamic';

const rows = <T,>(r: unknown): T[] => r as unknown as T[];

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

  const list = rows<FreelancerRow>(
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

      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users size={20} />}
            title="لا فريلانسرز بعد"
            description="أضف الفريلانسرز لإسنادهم إلى المشاريع وتتبّع تعاونك معهم."
          />
        </Card>
      ) : (
        <FreelancersWorkspace items={list} />
      )}
    </Shell>
  );
}
