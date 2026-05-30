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
import { Sparkles, FileSignature } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { can, requirePermission } from '@/lib/authz';
import { TalentsWorkspace, type TalentRow } from './TalentsWorkspace';

export const dynamic = 'force-dynamic';

const rows = <T,>(r: unknown): T[] => r as unknown as T[];

export default async function TalentsPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/talents');

  // Page guard: lacking team.read → /dashboard (signed-out → /login).
  await requirePermission('team.read');

  // Commission % is financial data — a separate, narrower grant than directory access.
  const canFinance = await can('financials.read');

  const list = rows<TalentRow>(
    await db.execute(sql`
      SELECT id::text AS id, code, display_name AS "displayName",
             display_name_en AS "displayNameEn", contract_type::text AS "contractType",
             ${
               canFinance
                 ? sql`commission_pct`
                 : sql`NULL::numeric`
             } AS "commissionPct", category, niches, languages,
             city_base AS "cityBase", signed_contract_at AS "signedContractAt"
      FROM talents
      WHERE archived_at IS NULL AND active
      ORDER BY display_name`),
  );

  // Defense in depth: the SELECT already omits commission, but null it again so it
  // never crosses the wire to a viewer without the financials grant.
  if (!canFinance) {
    for (const t of list) t.commissionPct = null;
  }

  const contracted = list.filter((t) => t.signedContractAt).length;
  const exclusive = list.filter((t) => t.contractType === 'exclusive').length;

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/team">
      <PageHeader
        eyebrow="People · Talents"
        title="المواهب"
        subtitle={`${list.length} موهبة · ${contracted} بعقد موقَّع`}
      />

      <CardsGrid>
        <MiniStat span={4} label="إجمالي" value={list.length} tone="accent" />
        <MiniStat span={4} label="بعقد موقَّع" value={contracted} sub="موثّقون" />
        <MiniStat span={4} label="حصريون" value={exclusive} sub="عقد حصري" />
      </CardsGrid>

      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Sparkles size={20} />}
            title="لا مواهب بعد"
            description="أضف المواهب والمؤثّرين لإسنادهم إلى حملات المحتوى وتتبّع عقودهم."
          />
        </Card>
      ) : (
        <TalentsWorkspace items={list} />
      )}

      <p className="flex items-center gap-1.5 px-1 text-[11px] text-[var(--text-dim)]">
        <FileSignature size={12} /> العقود والعمولات مراجع فقط — الفوترة في Dafterah (D-022).
      </p>
    </Shell>
  );
}
