import { redirect } from 'next/navigation';
import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { withProfileScope } from '@antagna/db';
import { PageHeader, Card, EmptyState } from '@antagna/ui';
import {
  Search,
  Briefcase,
  Building2,
  Contact,
  Camera,
  UserSquare2,
  UserCog,
  Star,
  ChevronLeft,
  type LucideIcon,
} from 'lucide-react';
import { Shell } from '@/components/Shell';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requirePermission, getEffectiveProfileId } from '@/lib/authz';
import { SearchBox } from './SearchBox';

export const dynamic = 'force-dynamic';

type ResultType =
  | 'project'
  | 'client'
  | 'contact'
  | 'equipment'
  | 'profile'
  | 'freelancer'
  | 'talent';

type Row = {
  type: ResultType;
  id: string;
  label: string;
  sublabel: string | null;
  href: string;
};

const GROUP_ORDER: ResultType[] = [
  'project',
  'client',
  'contact',
  'equipment',
  'profile',
  'freelancer',
  'talent',
];

const GROUP_META: Record<
  ResultType,
  { label: string; icon: LucideIcon }
> = {
  project: { label: 'المشاريع', icon: Briefcase },
  client: { label: 'العملاء', icon: Building2 },
  contact: { label: 'جهات الاتصال', icon: Contact },
  equipment: { label: 'المعدات', icon: Camera },
  profile: { label: 'الفريق', icon: UserSquare2 },
  freelancer: { label: 'المستقلّون', icon: UserCog },
  talent: { label: 'المواهب', icon: Star },
};

/**
 * Server-side global search. Mirrors /api/search (used by the ⌘K palette) but
 * renders a full, shareable results page honoring ?q. Runs one UNION across the
 * core entities; results grouped by type. Clean-slate friendly — empty states
 * everywhere.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=/search${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  }

  // Page gate (D-037/D-041). Global search reaches across team/contacts/
  // equipment/clients/projects, so require the same read key the team pages use
  // (`team.read`); there is no `user.read` in the seeded graph. No perm → the
  // requirePermission helper redirects to /dashboard.
  await requirePermission('team.read');
  const effectivePid = await getEffectiveProfileId();

  let rows: Row[] = [];
  if (q.length >= 1) {
    const like = `%${q}%`;
    // Field-level masking (D-037): route every entity through its v_*_safe view
    // inside ONE withProfileScope txn so current_effective_profile_id() resolves
    // on the pinned 6543 connection and the views mask columns (notably the team
    // `email`, which previously leaked here). Freelancers/talents have no safe
    // view yet and expose no masked columns in these projections, so they stay
    // on their base tables — same rows, same behavior.
    rows = (await withProfileScope(effectivePid, (tx) =>
      tx.execute(sql`
      (
        SELECT 'project'::text AS type, id::text AS id, title AS label,
          code || (CASE WHEN title_ar IS NOT NULL THEN ' · ' || title_ar ELSE '' END) AS sublabel,
          '/projects/' || id::text AS href
        FROM v_projects_safe
        WHERE archived_at IS NULL
          AND (title ILIKE ${like} OR title_ar ILIKE ${like} OR code ILIKE ${like})
        ORDER BY updated_at DESC LIMIT 12
      )
      UNION ALL
      (
        SELECT 'client'::text AS type, id::text AS id, name_ar AS label,
          code || (CASE WHEN name_en IS NOT NULL THEN ' · ' || name_en ELSE '' END) AS sublabel,
          '/clients/' || id::text AS href
        FROM v_clients_safe
        WHERE archived_at IS NULL
          AND (name_ar ILIKE ${like} OR name_en ILIKE ${like} OR code ILIKE ${like})
        ORDER BY updated_at DESC NULLS LAST LIMIT 12
      )
      UNION ALL
      (
        SELECT 'contact'::text AS type, c.id::text AS id,
          COALESCE(c.full_name_ar, c.full_name) AS label,
          COALESCE(c.job_title_ar, c.job_title, cl.name_ar) AS sublabel,
          '/contacts/' || c.id::text AS href
        FROM v_contacts_safe c
        LEFT JOIN v_clients_safe cl ON cl.id = c.client_id
        WHERE c.archived_at IS NULL
          AND (c.full_name ILIKE ${like} OR c.full_name_ar ILIKE ${like}
               OR c.job_title ILIKE ${like})
        ORDER BY c.updated_at DESC NULLS LAST LIMIT 12
      )
      UNION ALL
      (
        SELECT 'equipment'::text AS type, id::text AS id,
          (COALESCE(manufacturer || ' ', '') || model) AS label,
          code || ' · ' || category AS sublabel,
          '/equipment/' || id::text AS href
        FROM v_equipment_safe
        WHERE archived_at IS NULL
          AND (model ILIKE ${like} OR code ILIKE ${like}
               OR manufacturer ILIKE ${like} OR category ILIKE ${like})
        ORDER BY code ASC LIMIT 12
      )
      UNION ALL
      (
        SELECT 'profile'::text AS type, id::text AS id, display_name AS label,
          email AS sublabel, '/team/' || id::text AS href
        FROM v_team_safe
        WHERE status = 'active'
          AND (display_name ILIKE ${like} OR email ILIKE ${like})
        LIMIT 12
      )
      UNION ALL
      (
        SELECT 'freelancer'::text AS type, id::text AS id,
          COALESCE(full_name_ar, full_name) AS label, code AS sublabel,
          '/freelancers/' || id::text AS href
        FROM freelancers
        WHERE archived_at IS NULL AND active
          AND (full_name ILIKE ${like} OR full_name_ar ILIKE ${like} OR code ILIKE ${like})
        LIMIT 10
      )
      UNION ALL
      (
        SELECT 'talent'::text AS type, id::text AS id, display_name AS label,
          COALESCE(category, code) AS sublabel, '/talents'::text AS href
        FROM talents
        WHERE archived_at IS NULL AND active
          AND (display_name ILIKE ${like} OR code ILIKE ${like})
        LIMIT 10
      )
    `),
    )) as unknown as Row[];
  }

  const grouped = new Map<ResultType, Row[]>();
  for (const r of rows) {
    const arr = grouped.get(r.type) ?? [];
    arr.push(r);
    grouped.set(r.type, arr);
  }
  const total = rows.length;

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/search">
      <PageHeader
        eyebrow="Antagna · بحث شامل"
        title="البحث"
        subtitle="ابحث عبر كل النظام دفعة واحدة — مشاريع، عملاء، جهات اتصال، معدات، الفريق والمستقلّون."
      />

      <div className="mx-auto w-full max-w-3xl space-y-6">
        <SearchBox initialQuery={q} />

        {q.length < 1 ? (
          <Card>
            <EmptyState
              icon={<Search size={18} />}
              title="ابدأ بالكتابة"
              description="اكتب اسم مشروع، عميل، جهة اتصال، كود معدّة أو اسم زميل. تظهر النتائج مجمّعة حسب النوع."
            />
          </Card>
        ) : total === 0 ? (
          <Card>
            <EmptyState
              icon={<Search size={18} />}
              title="لا نتائج"
              description={`لم نجد شيئاً يطابق «${q}». جرّب كلمة أقصر أو تهجئة مختلفة.`}
            />
          </Card>
        ) : (
          <>
            <p className="text-[12px] text-[var(--text-muted)]">
              <span className="font-semibold text-[var(--text)]">{total}</span> نتيجة
              لـ «<span className="text-[var(--text)]">{q}</span>»
            </p>
            <div className="space-y-6">
              {GROUP_ORDER.filter((t) => grouped.has(t)).map((t) => {
                const items = grouped.get(t)!;
                const meta = GROUP_META[t];
                const Icon = meta.icon;
                return (
                  <section key={t} className="space-y-2">
                    <header className="flex items-center gap-2 px-1">
                      <Icon size={14} className="text-[var(--text-dim)]" />
                      <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-dim)]">
                        {meta.label}
                      </h2>
                      <span className="text-[11px] text-[var(--text-dim)]">
                        · {items.length}
                      </span>
                    </header>
                    <Card padded={false}>
                      <ul className="divide-y divide-[var(--line)]">
                        {items.map((r) => (
                          <li key={`${r.type}:${r.id}`}>
                            <Link
                              href={r.href}
                              className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface-hover)]"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[14px] text-[var(--text)] group-hover:text-[var(--accent)]">
                                  {r.label || '—'}
                                </p>
                                {r.sublabel && (
                                  <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
                                    {r.sublabel}
                                  </p>
                                )}
                              </div>
                              <ChevronLeft
                                size={15}
                                className="shrink-0 text-[var(--text-dim)] transition-transform group-hover:-translate-x-0.5 group-hover:text-[var(--accent)]"
                              />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  </section>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}
