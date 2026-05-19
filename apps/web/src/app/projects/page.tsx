import Link from 'next/link';
import { redirect } from 'next/navigation';
import { desc, eq, sql, ilike, and, isNull, type SQL } from 'drizzle-orm';
import {
  db,
  projects,
  clients,
  profiles,
  projectStageEnum,
} from '@antagna/db';
import { AppShell, StatusPill } from '@antagna/ui';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { stageTone, stageLabelAr, PROJECT_STAGE_ORDER } from '@/lib/project-stage';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

type SearchParams = {
  stage?: string;
  pm?: string;
  client?: string;
  q?: string;
  page?: string;
  archived?: string;
};

export default async function ProjectsListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/projects');

  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const filters: SQL[] = [];

  if (sp.stage && (projectStageEnum.enumValues as readonly string[]).includes(sp.stage)) {
    filters.push(eq(projects.stage, sp.stage as (typeof projectStageEnum.enumValues)[number]));
  }
  if (sp.pm) {
    filters.push(eq(projects.projectManagerId, sp.pm));
  }
  if (sp.client) {
    filters.push(eq(projects.clientId, sp.client));
  }
  if (sp.q) {
    const like = `%${sp.q}%`;
    const orExpr = sql`(${projects.title} ILIKE ${like} OR ${projects.titleAr} ILIKE ${like} OR ${projects.code} ILIKE ${like})`;
    filters.push(orExpr);
  }
  if (sp.archived !== '1') {
    filters.push(isNull(projects.archivedAt));
  }

  const where = filters.length ? and(...filters) : undefined;

  const [rows, countRows, pmList, clientList] = await Promise.all([
    db
      .select({
        id: projects.id,
        code: projects.code,
        title: projects.title,
        titleAr: projects.titleAr,
        stage: projects.stage,
        deliveryDueAt: projects.deliveryDueAt,
        contractedValueSar: projects.contractedValueSar,
        aiRiskLevel: projects.aiRiskLevel,
        pmName: profiles.displayName,
        clientNameAr: clients.nameAr,
        clientCode: clients.code,
      })
      .from(projects)
      .leftJoin(profiles, eq(profiles.id, projects.projectManagerId))
      .innerJoin(clients, eq(clients.id, projects.clientId))
      .where(where)
      .orderBy(desc(projects.updatedAt))
      .limit(PAGE_SIZE)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(projects)
      .where(where),
    db
      .select({ id: profiles.id, displayName: profiles.displayName })
      .from(profiles)
      .where(eq(profiles.status, 'active'))
      .orderBy(profiles.displayName),
    db
      .select({ id: clients.id, code: clients.code, nameAr: clients.nameAr })
      .from(clients)
      .where(isNull(clients.archivedAt))
      .orderBy(clients.nameAr),
  ]);

  const count = countRows[0]?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(Number(count) / PAGE_SIZE));

  return (
    <AppShell user={{ email: user.email ?? '' }} activePath="/projects">
      <div className="space-y-5">
        <header className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">المشاريع</h1>
            <p className="text-sm text-neutral-500">
              {count} project{Number(count) === 1 ? '' : 's'} ·{' '}
              <span className="text-neutral-400">page {page} / {totalPages}</span>
            </p>
          </div>
          <Link
            href="/projects/new"
            className="rounded-sm bg-yellow-500 px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-yellow-400"
          >
            + مشروع جديد
          </Link>
        </header>

        <form className="flex flex-wrap items-end gap-3 rounded-md border border-neutral-800 bg-neutral-900 p-3 text-xs">
          <label className="flex flex-col gap-1">
            <span className="text-neutral-500">بحث</span>
            <input
              type="text"
              name="q"
              defaultValue={sp.q ?? ''}
              placeholder="code / title"
              className="w-48 rounded-sm border border-neutral-800 bg-neutral-950 px-2 py-1 font-mono"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-neutral-500">stage</span>
            <select
              name="stage"
              defaultValue={sp.stage ?? ''}
              className="w-36 rounded-sm border border-neutral-800 bg-neutral-950 px-2 py-1"
            >
              <option value="">— الكل —</option>
              {projectStageEnum.enumValues.map((s) => (
                <option key={s} value={s}>
                  {stageLabelAr(s)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-neutral-500">PM</span>
            <select
              name="pm"
              defaultValue={sp.pm ?? ''}
              className="w-44 rounded-sm border border-neutral-800 bg-neutral-950 px-2 py-1"
            >
              <option value="">— الكل —</option>
              {pmList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-neutral-500">العميل</span>
            <select
              name="client"
              defaultValue={sp.client ?? ''}
              className="w-44 rounded-sm border border-neutral-800 bg-neutral-950 px-2 py-1"
            >
              <option value="">— الكل —</option>
              {clientList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameAr}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              name="archived"
              value="1"
              defaultChecked={sp.archived === '1'}
              className="h-3 w-3"
            />
            <span className="text-neutral-500">اعرض الأرشيف</span>
          </label>
          <button
            type="submit"
            className="rounded-sm border border-neutral-700 bg-neutral-800 px-3 py-1 text-xs hover:border-yellow-500"
          >
            تطبيق
          </button>
          {(sp.q || sp.stage || sp.pm || sp.client || sp.archived === '1') && (
            <Link
              href="/projects"
              className="rounded-sm border border-neutral-800 px-3 py-1 text-xs text-neutral-400 hover:text-yellow-500"
            >
              مسح
            </Link>
          )}
        </form>

        <div className="overflow-hidden rounded-md border border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-900 text-left text-[11px] uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-3 py-2 font-medium">code</th>
                <th className="px-3 py-2 font-medium">title</th>
                <th className="px-3 py-2 font-medium">client</th>
                <th className="px-3 py-2 font-medium">stage</th>
                <th className="px-3 py-2 font-medium">PM</th>
                <th className="px-3 py-2 font-medium">delivery</th>
                <th className="px-3 py-2 font-medium">value</th>
                <th className="px-3 py-2 font-medium">risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800 bg-neutral-950">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-12 text-center text-sm text-neutral-500">
                    لا توجد مشاريع بهذه المعايير.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-neutral-900">
                    <td className="px-3 py-2 font-mono text-xs text-neutral-400">
                      <Link href={`/projects/${r.id}`} className="hover:text-yellow-500">
                        {r.code}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/projects/${r.id}`} className="hover:text-yellow-500">
                        <div>{r.titleAr ?? r.title}</div>
                        {r.titleAr && r.title && (
                          <div className="text-xs text-neutral-500">{r.title}</div>
                        )}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs text-neutral-400">
                      <span className="font-mono text-neutral-500">{r.clientCode}</span>{' '}
                      <span>{r.clientNameAr}</span>
                    </td>
                    <td className="px-3 py-2">
                      <StatusPill tone={stageTone(r.stage)}>{stageLabelAr(r.stage)}</StatusPill>
                    </td>
                    <td className="px-3 py-2 text-xs text-neutral-400">
                      {r.pmName ?? <span className="text-neutral-600">—</span>}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-neutral-400">
                      {r.deliveryDueAt
                        ? new Date(r.deliveryDueAt).toISOString().slice(0, 10)
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-neutral-400">
                      {r.contractedValueSar
                        ? `${Number(r.contractedValueSar).toLocaleString('en-US')} ر.س`
                        : '—'}
                    </td>
                    <td className="px-3 py-2">
                      {r.aiRiskLevel ? (
                        <StatusPill
                          tone={
                            r.aiRiskLevel === 'red'
                              ? 'danger'
                              : r.aiRiskLevel === 'amber'
                                ? 'warning'
                                : 'success'
                          }
                        >
                          {r.aiRiskLevel}
                        </StatusPill>
                      ) : (
                        <span className="text-xs text-neutral-600">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <nav className="flex items-center justify-center gap-2 text-xs">
            {page > 1 && (
              <Link
                href={{ pathname: '/projects', query: { ...sp, page: String(page - 1) } }}
                className="rounded-sm border border-neutral-800 px-2 py-1 hover:border-yellow-500"
              >
                ← السابق
              </Link>
            )}
            <span className="font-mono text-neutral-500">
              {page} / {totalPages}
            </span>
            {page < totalPages && (
              <Link
                href={{ pathname: '/projects', query: { ...sp, page: String(page + 1) } }}
                className="rounded-sm border border-neutral-800 px-2 py-1 hover:border-yellow-500"
              >
                التالي →
              </Link>
            )}
          </nav>
        )}

        <details className="text-xs text-neutral-500">
          <summary className="cursor-pointer">stage legend</summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {PROJECT_STAGE_ORDER.map((s) => (
              <StatusPill key={s} tone={stageTone(s)}>
                {stageLabelAr(s)}
              </StatusPill>
            ))}
          </div>
        </details>
      </div>
    </AppShell>
  );
}
