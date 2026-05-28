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
import { StatBox } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { Instagram, Youtube, Music, AtSign, Megaphone } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { createContentPost, createSponsoredDeal } from './actions';
import { CalendarGrid } from './calendar-grid';

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

  const [accounts, posts, deals, monthR] = await Promise.all([
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
    db.execute(sql`
      SELECT id::text AS id, title, code,
             planned_publish_at AS "plannedPublishAt", status::text AS status
      FROM content_posts
      WHERE planned_publish_at >= date_trunc('month', now())
        AND planned_publish_at <  date_trunc('month', now()) + interval '1 month'
      ORDER BY planned_publish_at`),
  ]);
  const monthPosts = (monthR as unknown) as Array<{
    id: string;
    title: string;
    code: string | null;
    plannedPublishAt: string;
    status: string;
  }>;

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
          format={`${totalFollowers.toLocaleString('en-US')}`}
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

        {/* Composer — plan a content post (manual calendar) */}
        <Card>
          <p className="mb-3 text-sm font-medium text-[var(--text)]">فكرة محتوى جديدة</p>
          {accounts.length === 0 ? (
            <p className="text-[12px] text-[var(--text-dim)]">
              أضف حساباً مُداراً أولاً لتتمكّن من جدولة المحتوى.
            </p>
          ) : (
            <form action={createContentPost} className="space-y-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr]">
                <select name="accountId" required className="sc-in">
                  <option value="">— الحساب —</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.ownerLabel} · {a.platform} @{a.handle}
                    </option>
                  ))}
                </select>
                <input name="title" required placeholder="عنوان الفكرة" className="sc-in" />
              </div>
              <input name="caption" placeholder="النص / الكابشن (اختياري)" className="sc-in w-full" />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[140px_1fr_auto]">
                <select name="format" defaultValue="reel" className="sc-in">
                  <option value="reel">ريل</option>
                  <option value="story">ستوري</option>
                  <option value="feed_image">صورة</option>
                  <option value="feed_carousel">كاروسيل</option>
                  <option value="feed_video">فيديو</option>
                  <option value="short">شورت</option>
                  <option value="long_form_video">فيديو طويل</option>
                  <option value="live">بث مباشر</option>
                  <option value="text">نص</option>
                </select>
                <input name="plannedPublishAt" type="datetime-local" className="sc-in" dir="ltr" />
                <button
                  type="submit"
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-[var(--accent)] px-4 text-[13px] font-semibold text-black hover:opacity-90"
                >
                  + أضف
                </button>
              </div>
            </form>
          )}
          <style>{`.sc-in{height:36px;border-radius:8px;border:1px solid var(--line);background:var(--bg-elevated);color:var(--text);font-size:13px;padding:0 10px;}.sc-in:focus{outline:none;border-color:var(--accent);}`}</style>
        </Card>
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

      {/* Content calendar (month grid of scheduled posts) */}
      <section className="space-y-4">
        <header>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-dim)]">
            — تقويم النشر
          </p>
          <h2 className="mt-3 text-xl font-semibold text-[var(--text)]">
            content calendar
          </h2>
        </header>
        <CalendarGrid posts={monthPosts} />
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

        {accounts.length > 0 && (
          <Card>
            <p className="mb-3 text-sm font-medium text-[var(--text)]">صفقة رعاية جديدة</p>
            <form
              action={createSponsoredDeal}
              className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px_120px_110px_auto]"
            >
              <select name="accountId" required className="sc-in">
                <option value="">— الحساب —</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.ownerLabel} · @{a.handle}
                  </option>
                ))}
              </select>
              <select name="dealType" defaultValue="paid_post" className="sc-in">
                <option value="paid_post">منشور مدفوع</option>
                <option value="barter">مقايضة</option>
                <option value="affiliate">عمولة (affiliate)</option>
                <option value="long_term_ambassador">سفير طويل الأمد</option>
              </select>
              <input
                name="contractValueSar"
                type="number"
                step="any"
                placeholder="القيمة ر.س"
                dir="ltr"
                className="sc-in"
              />
              <input
                name="deliverablesCount"
                type="number"
                placeholder="عدد"
                dir="ltr"
                className="sc-in"
              />
              <button
                type="submit"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-black hover:opacity-90"
              >
                + أضف
              </button>
            </form>
          </Card>
        )}

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

