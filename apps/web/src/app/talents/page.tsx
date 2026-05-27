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
import { Sparkles, MapPin, FileSignature } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const rows = <T,>(r: unknown): T[] => r as unknown as T[];

type Talent = {
  id: string;
  code: string;
  displayName: string;
  displayNameEn: string | null;
  contractType: string;
  commissionPct: string | null;
  category: string | null;
  niches: string[] | null;
  languages: string[] | null;
  cityBase: string | null;
  signedContractAt: string | null;
};

const CONTRACT_AR: Record<string, string> = {
  project_based: 'بالمشروع',
  exclusive: 'حصري',
  retainer: 'شهري ثابت',
  one_off: 'لمرة واحدة',
};

export default async function TalentsPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/talents');

  const list = rows<Talent>(
    await db.execute(sql`
      SELECT id::text AS id, code, display_name AS "displayName",
             display_name_en AS "displayNameEn", contract_type::text AS "contractType",
             commission_pct AS "commissionPct", category, niches, languages,
             city_base AS "cityBase", signed_contract_at AS "signedContractAt"
      FROM talents
      WHERE archived_at IS NULL AND active
      ORDER BY display_name`),
  );

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

      <Card padded={false} className="overflow-hidden">
        {list.length === 0 ? (
          <EmptyState
            icon={<Sparkles size={20} />}
            title="لا مواهب بعد"
            description="أضف المواهب والمؤثّرين لإسنادهم إلى حملات المحتوى وتتبّع عقودهم."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--bg-elevated)]/40 text-start text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-dim)]">
                  <th className="px-5 py-3 text-start">الموهبة</th>
                  <th className="px-5 py-3 text-start">الفئة</th>
                  <th className="px-5 py-3 text-start">المجالات</th>
                  <th className="px-5 py-3 text-start">اللغات</th>
                  <th className="px-5 py-3 text-start">العمولة</th>
                  <th className="px-5 py-3 text-start">العقد</th>
                  <th className="px-5 py-3 text-start">المدينة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {list.map((t) => (
                  <tr key={t.id} className="hover:bg-[var(--surface-hover)]">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={t.displayName} size="sm" />
                        <div className="min-w-0">
                          <Link
                            href={`/talents/${t.id}`}
                            className="text-[var(--text)] hover:text-[var(--accent)]"
                          >
                            {t.displayName}
                          </Link>
                          <div className="font-mono text-[10px] text-[var(--text-dim)]">
                            {t.code}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-[12px] text-[var(--text-muted)]">
                      {t.category ?? '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {(t.niches ?? []).slice(0, 3).map((n, i) => (
                          <span
                            key={i}
                            className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]"
                          >
                            {n}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[11px] text-[var(--text-dim)]">
                      {(t.languages ?? []).join(' · ') || '—'}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[12px] text-[var(--text-muted)]">
                      {t.commissionPct ? `${Number(t.commissionPct)}%` : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill
                        tone={t.contractType === 'exclusive' ? 'accent' : 'neutral'}
                        withDot={false}
                      >
                        {CONTRACT_AR[t.contractType] ?? t.contractType}
                      </StatusPill>
                    </td>
                    <td className="px-5 py-3.5 text-[12px] text-[var(--text-muted)]">
                      {t.cityBase ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={11} className="text-[var(--text-dim)]" />
                          {t.cityBase}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="flex items-center gap-1.5 px-1 text-[11px] text-[var(--text-dim)]">
        <FileSignature size={12} /> العقود والعمولات مراجع فقط — الفوترة في Dafterah (D-022).
      </p>
    </Shell>
  );
}
