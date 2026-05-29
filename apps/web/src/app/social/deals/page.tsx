import { redirect } from 'next/navigation';
import { eq, desc } from 'drizzle-orm';
import { db, managedAccounts, sponsoredDeals, clients } from '@antagna/db';
import { PageHeader, StatBox } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { can } from '@/lib/authz';
import { SocialTabs } from '../SocialTabs';
import { DealsPanel, type DealAccountOption } from '../DealsPanel';
import { fmtNum } from '../_shared';
import type { DealRow } from '../DealsWorkspace';

export const dynamic = 'force-dynamic';

export default async function SocialDealsPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/social/deals');

  const [accounts, deals, canEdit] = await Promise.all([
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
        id: sponsoredDeals.id,
        code: sponsoredDeals.code,
        dealType: sponsoredDeals.dealType,
        status: sponsoredDeals.status,
        contractValueSar: sponsoredDeals.contractValueSar,
        deliverablesCount: sponsoredDeals.deliverablesCount,
        startsAt: sponsoredDeals.startsAt,
        endsAt: sponsoredDeals.endsAt,
        accountHandle: managedAccounts.handle,
        ownerLabel: managedAccounts.ownerLabel,
        sponsorClientName: clients.nameAr,
      })
      .from(sponsoredDeals)
      .innerJoin(managedAccounts, eq(managedAccounts.id, sponsoredDeals.accountId))
      .leftJoin(clients, eq(clients.id, sponsoredDeals.sponsorClientId))
      .orderBy(desc(sponsoredDeals.createdAt))
      .limit(300),
    can('project.update'),
  ]);

  const dealRows: DealRow[] = deals.map((d) => ({
    id: d.id,
    code: d.code,
    dealType: d.dealType,
    status: d.status,
    contractValueSar: d.contractValueSar != null ? Number(d.contractValueSar) : null,
    deliverablesCount: d.deliverablesCount,
    startsAt: d.startsAt ? new Date(d.startsAt).toISOString() : null,
    endsAt: d.endsAt ? new Date(d.endsAt).toISOString() : null,
    accountHandle: d.accountHandle,
    ownerLabel: d.ownerLabel,
    sponsorClientName: d.sponsorClientName,
  }));

  const accountOpts: DealAccountOption[] = accounts.map((a) => ({
    id: a.id,
    ownerLabel: a.ownerLabel,
    platform: a.platform,
    handle: a.handle,
  }));

  const activeCount = dealRows.filter((d) => d.status === 'agreed' || d.status === 'in_progress').length;
  const pipelineValue = dealRows
    .filter((d) => d.status !== 'cancelled')
    .reduce((s, d) => s + (d.contractValueSar ?? 0), 0);

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/social">
      <PageHeader
        eyebrow="Social Media"
        title="صفقات الرعاية"
        subtitle="تتبّع الصفقات الإعلانية على حساباتنا المُدارة — التحصيل والفوترة في دفترة (D-022)."
      />
      <SocialTabs />

      <section className="grid grid-cols-1 gap-4 stagger-in sm:grid-cols-3">
        <StatBox label="إجمالي الصفقات" value={dealRows.length} />
        <StatBox label="صفقات نشطة" value={activeCount} tone="accent" />
        <StatBox
          label="قيمة الـ pipeline"
          value={pipelineValue}
          format={`${fmtNum(pipelineValue)} ر.س`}
          tone="success"
        />
      </section>

      <DealsPanel rows={dealRows} accounts={accountOpts} canEdit={canEdit} />
    </Shell>
  );
}
