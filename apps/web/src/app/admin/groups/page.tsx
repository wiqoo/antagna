import Link from 'next/link';
import { redirect } from 'next/navigation';
import { asc, sql } from 'drizzle-orm';
import { db, squads } from '@antagna/db';
import {
  PageHeader,
  Card,
  CardHeader,
  StatusPill,
  EmptyState,
  AIHints,
  type AIHint,
} from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { getAdminUser } from '@/lib/auth-admin';
import { requirePermission } from '@/lib/authz';
import { Users2, ChevronLeft } from 'lucide-react';
import { PURPOSE_LABEL_AR } from './constants';
import { CreateSquadForm } from './CreateSquadForm';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function GroupsPage(props: { searchParams: SearchParams }) {
  // Page guard — lacking access.manage → /dashboard, signed out → /login.
  await requirePermission('access.manage');
  const admin = await getAdminUser();
  if (!admin) redirect('/login?next=/admin/groups');

  const params = await props.searchParams;
  const error = typeof params.error === 'string' ? params.error : null;
  const ok = typeof params.ok === 'string' ? params.ok : null;

  const [rows, counts] = await Promise.all([
    db.select().from(squads).orderBy(asc(squads.code)),
    db.execute<{ squad_id: string; n: number }>(
      sql`SELECT squad_id, count(*)::int AS n FROM squad_members GROUP BY squad_id`,
    ) as unknown as Promise<{ squad_id: string; n: number }[]>,
  ]);

  const memberCount = new Map<string, number>();
  for (const c of counts) memberCount.set(c.squad_id, Number(c.n));

  const total = rows.length;
  const inactive = rows.filter((s) => !s.active).length;
  const empty = rows.filter((s) => (memberCount.get(s.id) ?? 0) === 0).length;

  const hints: AIHint[] = [];
  if (empty > 0) {
    hints.push({
      index: '01',
      text: `${empty} مجموعة بلا أعضاء`,
      insight: 'افتح المجموعة وأضف أعضاء حتى تظهر كخيار عند إسناد المشاريع.',
    });
  }
  if (inactive > 0) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: `${inactive} مجموعة معطّلة`,
      insight: 'المجموعات المعطّلة تختفي من قوائم الإسناد.',
    });
  }

  return (
    <Shell user={{ email: admin.user.email ?? '' }} activePath="/admin">
      {hints.length > 0 && (
        <AIHints
          context="Antagna AI · المجموعات"
          headline={`${total} مجموعة / Squad`}
          hints={hints}
          compact
        />
      )}
      <PageHeader
        eyebrow="Admin · الفرق"
        title="المجموعات / Squads"
        subtitle="فرق متكرّرة (طاقم تصوير، فريق مونتاج…) تُسنَد للمشاريع دفعة واحدة"
        action={<CreateSquadForm />}
      />

      {ok && (
        <p className="rounded-lg border border-[var(--success)]/30 bg-[var(--success)]/10 px-3 py-2 text-[13px] text-[var(--success)]">
          {ok}
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
          {error}
        </p>
      )}

      <Card padded={false}>
        {total === 0 ? (
          <EmptyState
            icon={<Users2 size={20} />}
            title="لا مجموعات بعد"
            description="استخدم زر «مجموعة جديدة» لإنشاء أول فريق متكرّر."
          />
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {rows.map((s) => {
              const n = memberCount.get(s.id) ?? 0;
              return (
                <li key={s.id}>
                  <Link
                    href={`/admin/groups/${s.id}`}
                    className="group flex items-center gap-4 px-6 py-4 hover:bg-[var(--surface-hover)]"
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[var(--surface-hover)] text-[var(--text-muted)] group-hover:text-[var(--accent)]">
                      <Users2 size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-[var(--text-dim)]">{s.code}</span>
                        {s.purpose && (
                          <StatusPill tone="info" withDot={false}>
                            {PURPOSE_LABEL_AR[s.purpose] ?? s.purpose}
                          </StatusPill>
                        )}
                        <StatusPill tone={s.active ? 'success' : 'neutral'} withDot={false}>
                          {s.active ? 'نشط' : 'معطّل'}
                        </StatusPill>
                      </div>
                      <p className="mt-1 text-sm font-medium text-[var(--text)] group-hover:text-[var(--accent)]">
                        {s.nameAr}
                        {s.nameEn && (
                          <span className="ms-2 text-[11px] text-[var(--text-dim)]">{s.nameEn}</span>
                        )}
                      </p>
                    </div>
                    <span className="shrink-0 text-[12px] text-[var(--text-muted)]">
                      {n} عضو
                    </span>
                    <ChevronLeft
                      size={16}
                      className="shrink-0 text-[var(--text-dim)] transition-transform group-hover:-translate-x-0.5 group-hover:text-[var(--accent)]"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </Shell>
  );
}
