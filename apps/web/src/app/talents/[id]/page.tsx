import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { PageHeader, Card, CardHeader, StatusPill, EmptyState, Avatar } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { ArrowLeft, Instagram, FileSignature, Users } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/authz';

export const dynamic = 'force-dynamic';

const rows = <T,>(r: unknown): T[] => r as unknown as T[];

const CONTRACT_AR: Record<string, string> = {
  project_based: 'بالمشروع',
  exclusive: 'حصري',
  retainer: 'شهري ثابت',
  one_off: 'لمرة واحدة',
};

type Talent = {
  id: string;
  code: string;
  displayName: string;
  displayNameEn: string | null;
  legalName: string | null;
  contractType: string;
  commissionPct: string | null;
  signedContractAt: string | null;
  category: string | null;
  niches: string[] | null;
  languages: string[] | null;
  cityBase: string | null;
  payoutMethodRef: string | null;
};

export default async function TalentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/talents/${id}`);
  await requirePermission('team.read');

  const [tR, accR] = await Promise.all([
    db.execute(sql`
      SELECT id::text AS id, code, display_name AS "displayName",
             display_name_en AS "displayNameEn", legal_name AS "legalName",
             contract_type::text AS "contractType", commission_pct AS "commissionPct",
             signed_contract_at AS "signedContractAt", category, niches, languages,
             city_base AS "cityBase", payout_method_ref AS "payoutMethodRef"
      FROM talents WHERE id = ${id}::uuid LIMIT 1`),
    db.execute(sql`
      SELECT id::text AS id, handle, platform::text AS platform,
             follower_count AS "followers", access_type AS "accessType"
      FROM managed_accounts WHERE owner_talent_id = ${id}::uuid
      ORDER BY follower_count DESC NULLS LAST`),
  ]);

  const t = rows<Talent>(tR)[0];
  if (!t) notFound();
  const accounts = rows<{
    id: string;
    handle: string;
    platform: string;
    followers: number | null;
    accessType: string;
  }>(accR);

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/team">
      <Link
        href="/talents"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
      >
        <ArrowLeft size={14} className="rtl:rotate-180" /> المواهب
      </Link>

      <PageHeader
        eyebrow={t.category ?? 'Talent'}
        title={t.displayName}
        subtitle={`${t.displayNameEn ? t.displayNameEn + ' · ' : ''}${t.code}`}
        action={
          <StatusPill tone={t.contractType === 'exclusive' ? 'accent' : 'neutral'}>
            {CONTRACT_AR[t.contractType] ?? t.contractType}
          </StatusPill>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <div className="flex items-center gap-3">
            <Avatar name={t.displayName} size="lg" />
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-[var(--text)]">{t.displayName}</p>
              {t.cityBase && (
                <p className="text-[12px] text-[var(--text-muted)]">{t.cityBase}</p>
              )}
            </div>
          </div>
          <dl className="mt-4 space-y-2 text-[13px]">
            <Row k="نوع العقد" v={CONTRACT_AR[t.contractType] ?? t.contractType} />
            <Row k="العمولة" v={t.commissionPct ? `${Number(t.commissionPct)}%` : '—'} />
            <Row
              k="العقد موقَّع"
              v={t.signedContractAt ?? '—'}
              mono={!!t.signedContractAt}
            />
            {t.legalName && <Row k="الاسم القانوني" v={t.legalName} />}
            {t.payoutMethodRef && <Row k="طريقة الدفع" v={t.payoutMethodRef} />}
            {t.languages && t.languages.length > 0 && (
              <Row k="اللغات" v={t.languages.join(' · ')} />
            )}
          </dl>
          {t.niches && t.niches.length > 0 && (
            <div className="mt-4 border-t border-[var(--line)] pt-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
                المجالات
              </p>
              <div className="flex flex-wrap gap-1.5">
                {t.niches.map((n, i) => (
                  <span
                    key={i}
                    className="rounded-full border border-[var(--line)] px-2.5 py-0.5 text-[11px] text-[var(--text-muted)]"
                  >
                    {n}
                  </span>
                ))}
              </div>
            </div>
          )}
          <p className="mt-4 flex items-center gap-1.5 border-t border-[var(--line)] pt-3 text-[11px] text-[var(--text-dim)]">
            <FileSignature size={12} /> العقود/العمولات مراجع — الفوترة في Dafterah (D-022).
          </p>
        </Card>

        <div className="lg:col-span-2">
          <Card padded={false}>
            <div className="p-6 pb-4">
              <CardHeader
                title="الحسابات المُدارة"
                subtitle={`${accounts.length} حساب`}
              />
            </div>
            {accounts.length === 0 ? (
              <EmptyState
                icon={<Users size={20} />}
                title="لا حسابات مُدارة"
                description="اربط حسابات هذه الموهبة من قسم السوشيال."
              />
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {accounts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-6 py-3">
                    <span className="inline-flex items-center gap-2 text-[13px] text-[var(--text)]">
                      <Instagram size={14} className="text-[var(--text-dim)]" />
                      <span dir="ltr">@{a.handle}</span>
                      <span className="text-[var(--text-dim)]">· {a.platform}</span>
                    </span>
                    <span className="font-mono text-[12px] text-[var(--text-muted)]">
                      {a.followers != null ? `${a.followers.toLocaleString('en-US')} متابع` : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </Shell>
  );
}

function Row({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[var(--text-dim)]">{k}</dt>
      <dd className={'text-[var(--text)] ' + (mono ? 'font-mono text-[12px]' : '')}>{v}</dd>
    </div>
  );
}
