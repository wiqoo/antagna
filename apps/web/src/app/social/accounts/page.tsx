import { redirect } from 'next/navigation';
import { sql, eq } from 'drizzle-orm';
import { db, managedAccounts, clients, talents, profiles } from '@antagna/db';
import { PageHeader, StatBox } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { can } from '@/lib/authz';
import { SocialTabs } from '../SocialTabs';
import { AccountsPanel } from '../AccountsPanel';
import { fmtNum } from '../_shared';
import type { AccountRow } from '../AccountsWorkspace';

export const dynamic = 'force-dynamic';

export default async function SocialAccountsPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/social/accounts');

  const [rows, canEdit] = await Promise.all([
    db
      .select({
        id: managedAccounts.id,
        code: managedAccounts.code,
        ownerLabel: managedAccounts.ownerLabel,
        platform: managedAccounts.platform,
        handle: managedAccounts.handle,
        accessType: managedAccounts.accessType,
        followerCount: managedAccounts.followerCount,
        active: managedAccounts.active,
        ownerClientName: clients.nameAr,
        ownerTalentName: talents.displayName,
        ownerProfileName: profiles.displayName,
        postsCount: sql<number>`(SELECT count(*)::int FROM content_posts cp WHERE cp.account_id = ${managedAccounts.id})`,
      })
      .from(managedAccounts)
      .leftJoin(clients, eq(clients.id, managedAccounts.ownerClientId))
      .leftJoin(talents, eq(talents.id, managedAccounts.ownerTalentId))
      .leftJoin(profiles, eq(profiles.id, managedAccounts.ownerProfileId))
      .orderBy(managedAccounts.ownerLabel)
      .limit(200),
    can('project.update'),
  ]);

  const accountRows: AccountRow[] = rows.map((r) => ({
    id: r.id,
    code: r.code,
    ownerLabel: r.ownerLabel,
    ownerName: r.ownerClientName ?? r.ownerTalentName ?? r.ownerProfileName ?? null,
    platform: r.platform,
    handle: r.handle,
    accessType: r.accessType,
    followerCount: r.followerCount,
    postsCount: Number(r.postsCount ?? 0),
    active: r.active,
  }));

  const totalFollowers = accountRows.reduce((s, a) => s + (a.followerCount ?? 0), 0);
  const platforms = new Set(accountRows.map((a) => a.platform)).size;

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/social">
      <PageHeader
        eyebrow="Social Media"
        title="الحسابات المُدارة"
        subtitle="كل حسابات السوشيال التي ندير محتواها — تتبّع يدوي، بدون نشر تلقائي (D-028)."
      />
      <SocialTabs />

      <section className="grid grid-cols-1 gap-4 stagger-in sm:grid-cols-3">
        <StatBox label="حسابات" value={accountRows.length} />
        <StatBox
          label="إجمالي المتابعين"
          value={totalFollowers}
          format={fmtNum(totalFollowers)}
        />
        <StatBox label="منصّات" value={platforms} />
      </section>

      <AccountsPanel rows={accountRows} canEdit={canEdit} />
    </Shell>
  );
}
