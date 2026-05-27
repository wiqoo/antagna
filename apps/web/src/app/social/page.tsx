import { redirect } from 'next/navigation';
import { sql, eq, desc } from 'drizzle-orm';
import {
  db,
  managedAccounts,
  contentPosts,
  sponsoredDeals,
  clients,
  profiles,
  talents,
} from '@antagna/db';
import {
  PageHeader,
  Card,
  StatusPill,
  EmptyState,
  Avatar,
  MoneyDisplay,
} from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { Instagram, Youtube, Music, AtSign, Megaphone } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const PLATFORM_ICON: Record<string, React.ComponentType<{ size: number; className?: string }>> = {
  instagram: Instagram,
  tiktok: Music,
  youtube: Youtube,
  twitter: AtSign,
  snapchat: AtSign,
  threads: AtSign,
};

const POST_STATUS_TONE: Record<string, 'neutral' | 'info' | 'warning' | 'success' | 'danger'> = {
  idea: 'neutral',
  briefed: 'info',
  filming: 'warning',
  editing: 'warning',
  scheduled: 'accent' as never,
  published: 'success',
  archived: 'neutral',
  cancelled: 'danger',
};

export default async function SocialPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/social');

  const [accounts, posts, deals] = await Promise.all([
    db
      .select({
        id: managedAccounts.id,
        code: managedAccounts.code,
        ownerLabel: managedAccounts.ownerLabel,
        platform: managedAccounts.platform,
        handle: managedAccounts.handle,
        accessType: managedAccounts.accessType,
        followerCount: managedAccounts.followerCount,
        ownerClientName: clients.nameAr,
        ownerTalentName: talents.displayName,
        ownerProfileName: profiles.displayName,
      })
      .from(managedAccounts)
      .leftJoin(clients, eq(clients.id, managedAccounts.ownerClientId))
      .leftJoin(talents, eq(talents.id, managedAccounts.ownerTalentId))
      .leftJoin(profiles, eq(profiles.id, managedAccounts.ownerProfileId))
      .orderBy(managedAccounts.ownerLabel)
      .limit(100),
    db
      .select({
        id: contentPosts.id,
        code: contentPosts.code,
        title: contentPosts.title,
        format: contentPosts.format,
        status: contentPosts.status,
        accountHandle: managedAccounts.handle,
        platform: managedAccounts.platform,
        ownerLabel: managedAccounts.ownerLabel,
      })
      .from(contentPosts)
      .innerJoin(managedAccounts, eq(managedAccounts.id, contentPosts.accountId))
      .orderBy(desc(contentPosts.createdAt))
      .limit(20),
    db
      .select({
        id: sponsoredDeals.id,
        code: sponsoredDeals.code,
        dealType: sponsoredDeals.dealType,
        contractValueSar: sponsoredDeals.contractValueSar,
        deliverablesCount: sponsoredDeals.deliverablesCount,
        status: sponsoredDeals.status,
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
      .limit(20),
  ]);

  const totalFollowers = accounts.reduce(
    (s, a) => s + (a.followerCount ?? 0),
    0,
  );

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/social">
      <PageHeader
        eyebrow="Social Media"
        title="السوشيال ميديا"
        subtitle="حسابات مُدارة، محتوى منشور، صفقات رعاية — Pillar 7. لا يزال OAuth runtime يدوياً."
      />

      <section className="grid grid-cols-3 gap-4 stagger-in">
        <StatBox label="حسابات" value={accounts.length} />
        <StatBox
          label="إجمالي متابعين"
          value={totalFollowers}
          formatted={`${totalFollowers.toLocaleString('en-US')}`}
        />
        <StatBox label="صفقات نشطة" value={deals.filter((d) => d.status === 'agreed' || d.status === 'in_progress').length} />
      </section>

      {/* Managed accounts */}
      <section className="space-y-5">
        <header className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-dim)]">
              — الحسابات المُدارة
            </p>
            <h2 className="mt-3 text-xl font-semibold text-[var(--text)]">
              كل الـ accounts
            </h2>
          </div>
          <span className="text-[11px] text-[var(--text-muted)]">
            {accounts.length} حساب
          </span>
        </header>

        {accounts.length === 0 ? (
          <Card>
            <EmptyState
              icon={<AtSign size={18} />}
              title="لا يوجد حسابات مُدارة"
              description="ضيف حسابات في قاعدة البيانات يدوياً حتى يتم تفعيل الـ OAuth runtime."
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 stagger-in md:grid-cols-2 lg:grid-cols-3">
            {accounts.map((a) => {
              const Icon = PLATFORM_ICON[a.platform] ?? AtSign;
              const ownerName =
                a.ownerClientName ??
                a.ownerTalentName ??
                a.ownerProfileName ??
                a.ownerLabel;
              return (
                <article
                  key={a.id}
                  className="rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)]/60 p-5"
                >
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--accent)]">
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[10px] text-[var(--text-dim)]">
                        {a.code}
                      </p>
                      <p className="truncate text-[14px] font-semibold text-[var(--text)]">
                        @{a.handle}
                      </p>
                      <p className="truncate text-[11px] text-[var(--text-muted)]">
                        {ownerName}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--line)] pt-3 text-[11px]">
                    <div>
                      <p className="text-[var(--text-dim)]">متابعين</p>
                      <p className="mt-0.5 font-mono text-[16px] font-semibold text-[var(--text)]">
                        {a.followerCount?.toLocaleString('en-US') ?? '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[var(--text-dim)]">نوع الوصول</p>
                      <p className="mt-0.5 text-[12px] text-[var(--text)]">
                        {a.accessType}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Content posts */}
      <section className="space-y-5">
        <header>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-dim)]">
            — المحتوى الأخير
          </p>
          <h2 className="mt-3 text-xl font-semibold text-[var(--text)]">
            posts (20 الأحدث)
          </h2>
        </header>
        {posts.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Megaphone size={18} />}
              title="لا يوجد محتوى مسجّل"
              description="سيظهر هنا كل منشور بمجرد إنشاء record."
            />
          </Card>
        ) : (
          <Card padded={false}>
            <ul className="divide-y divide-[var(--line)]">
              {posts.map((p) => {
                const Icon = PLATFORM_ICON[p.platform] ?? AtSign;
                return (
                  <li
                    key={p.id}
                    className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-6 py-3"
                  >
                    <Icon size={14} className="text-[var(--text-dim)]" />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] text-[var(--text)]">
                        {p.title}
                      </p>
                      <p className="truncate text-[11px] text-[var(--text-muted)]">
                        @{p.accountHandle} · {p.ownerLabel}
                      </p>
                    </div>
                    <StatusPill tone="neutral">{p.format}</StatusPill>
                    <StatusPill tone={POST_STATUS_TONE[p.status] ?? 'neutral'}>
                      {p.status}
                    </StatusPill>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </section>

      {/* Deals */}
      <section className="space-y-5">
        <header>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-dim)]">
            — صفقات الرعاية
          </p>
          <h2 className="mt-3 text-xl font-semibold text-[var(--text)]">
            sponsored deals
          </h2>
        </header>
        {deals.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Megaphone size={18} />}
              title="لا توجد صفقات"
              description="ضيف صفقات لتتبع الإيراد الإعلاني."
            />
          </Card>
        ) : (
          <Card padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--line)] bg-[var(--bg-elevated)]/60 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
                    <th className="px-5 py-3 text-start">code</th>
                    <th className="px-5 py-3 text-start">الحساب</th>
                    <th className="px-5 py-3 text-start">الراعي</th>
                    <th className="px-5 py-3 text-start">النوع</th>
                    <th className="px-5 py-3 text-end">القيمة</th>
                    <th className="px-5 py-3 text-start">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {deals.map((d) => (
                    <tr key={d.id} className="hover:bg-[var(--surface-hover)]">
                      <td className="px-5 py-3 font-mono text-xs text-[var(--text-dim)]">
                        {d.code}
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-[var(--text)]">
                          @{d.accountHandle}
                        </span>{' '}
                        <span className="text-[11px] text-[var(--text-muted)]">
                          {d.ownerLabel}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[12px]">
                        {d.sponsorClientName ?? '—'}
                      </td>
                      <td className="px-5 py-3 text-[12px] text-[var(--text-muted)]">
                        {d.dealType}
                      </td>
                      <td className="px-5 py-3 text-end">
                        {d.contractValueSar ? (
                          <MoneyDisplay
                            amount={Number(d.contractValueSar)}
                            currency="SAR"
                            className="text-[12px]"
                          />
                        ) : (
                          <span className="text-[11px] text-[var(--text-dim)]">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <StatusPill
                          tone={
                            d.status === 'completed'
                              ? 'success'
                              : d.status === 'in_progress'
                                ? 'warning'
                                : d.status === 'cancelled'
                                  ? 'danger'
                                  : 'neutral'
                          }
                        >
                          {d.status}
                        </StatusPill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>

      <Avatar name="" className="hidden" />
      <span className="hidden">{String(sql)}</span>
    </Shell>
  );
}

function StatBox({
  label,
  value,
  formatted,
}: {
  label: string;
  value: number;
  formatted?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)]/60 p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-dim)]">
        {label}
      </p>
      <p className="mt-4 text-[36px] font-bold leading-none tracking-tight tabular text-[var(--text)]">
        {formatted ?? value}
      </p>
    </div>
  );
}
