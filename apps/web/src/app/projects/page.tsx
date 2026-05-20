import Link from 'next/link';
import { redirect } from 'next/navigation';
import { desc, eq, sql, and, isNull, type SQL } from 'drizzle-orm';
import {
  db,
  projects,
  clients,
  profiles,
  projectStageEnum,
} from '@antagna/db';
import {
  
  PageHeader,
  Card,
  StatusPill,
  EmptyState,
  Avatar,
  Button,
} from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { Briefcase, Plus, Search, X, ArrowUpRight, Sparkles } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { stageTone, stageLabelAr } from '@/lib/project-stage';

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
  if (sp.pm) filters.push(eq(projects.projectManagerId, sp.pm));
  if (sp.client) filters.push(eq(projects.clientId, sp.client));
  if (sp.q) {
    const like = `%${sp.q}%`;
    filters.push(
      sql`(${projects.title} ILIKE ${like} OR ${projects.titleAr} ILIKE ${like} OR ${projects.code} ILIKE ${like})`,
    );
  }
  if (sp.archived !== '1') filters.push(isNull(projects.archivedAt));

  const where = filters.length ? and(...filters) : undefined;
  const hasFilters = !!(sp.q || sp.stage || sp.pm || sp.client || sp.archived === '1');

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
    <Shell user={{ email: user.email ?? '' }} activePath="/projects">
      <PageHeader
        eyebrow="Projects"
        title="المشاريع"
        subtitle={`${count} مشروع · صفحة ${page} من ${totalPages}`}
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/briefs/new"
              className="magnet inline-flex h-10 items-center gap-2 rounded-md border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-4 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/20"
            >
              <Sparkles size={14} />
              برِيف بالـ AI
            </Link>
            <Link
              href="/projects/new"
              className="magnet inline-flex h-10 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
            >
              <Plus size={16} />
              مشروع جديد
            </Link>
          </div>
        }
      />

      {/* Filters bar */}
      <Card padded={false} className="overflow-hidden">
        <form className="flex flex-wrap items-end gap-3 p-4">
          <label className="flex-1 min-w-[200px] space-y-1.5">
            <span className="block text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">
              بحث
            </span>
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]"
              />
              <input
                type="text"
                name="q"
                defaultValue={sp.q ?? ''}
                placeholder="code، title، أو العميل…"
                className="h-9 w-full rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 pe-9 text-sm text-[var(--text)] placeholder:text-[var(--text-dim)] focus:border-[var(--accent)] focus:outline-none"
              />
            </div>
          </label>

          <label className="space-y-1.5">
            <span className="block text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">
              المرحلة
            </span>
            <select
              name="stage"
              defaultValue={sp.stage ?? ''}
              className="h-9 w-40 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 text-sm focus:border-[var(--accent)] focus:outline-none"
            >
              <option value="">— الكل —</option>
              {projectStageEnum.enumValues.map((s) => (
                <option key={s} value={s}>
                  {stageLabelAr(s)}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="block text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">
              المدير
            </span>
            <select
              name="pm"
              defaultValue={sp.pm ?? ''}
              className="h-9 w-48 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 text-sm focus:border-[var(--accent)] focus:outline-none"
            >
              <option value="">— الكل —</option>
              {pmList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="block text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">
              العميل
            </span>
            <select
              name="client"
              defaultValue={sp.client ?? ''}
              className="h-9 w-48 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 text-sm focus:border-[var(--accent)] focus:outline-none"
            >
              <option value="">— الكل —</option>
              {clientList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameAr}
                </option>
              ))}
            </select>
          </label>

          <label className="flex h-9 items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 text-sm">
            <input
              type="checkbox"
              name="archived"
              value="1"
              defaultChecked={sp.archived === '1'}
              className="accent-[var(--accent)]"
            />
            <span className="text-[var(--text-muted)]">أرشيف</span>
          </label>

          <Button type="submit" variant="primary">
            تطبيق
          </Button>

          {hasFilters && (
            <Link
              href="/projects"
              className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm text-[var(--text-muted)] hover:bg-[var(--surface)]/80 hover:text-[var(--text)]"
            >
              <X size={14} />
              مسح
            </Link>
          )}
        </form>
      </Card>

      {/* Table */}
      <Card padded={false} className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            icon={<Briefcase size={20} />}
            title="لا توجد مشاريع بهذه المعايير"
            description={
              hasFilters
                ? 'جرّب تعديل أو مسح الفلاتر.'
                : 'ابدأ بإنشاء مشروعك الأول.'
            }
            action={
              <Link
                href={hasFilters ? '/projects' : '/projects/new'}
                className="inline-flex h-9 items-center rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
              >
                {hasFilters ? 'مسح الفلاتر' : '+ مشروع جديد'}
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--bg-elevated)]/40 text-start text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-dim)]">
                  <th className="px-5 py-3 font-medium text-start">code</th>
                  <th className="px-5 py-3 font-medium text-start">المشروع</th>
                  <th className="px-5 py-3 font-medium text-start">العميل</th>
                  <th className="px-5 py-3 font-medium text-start">المرحلة</th>
                  <th className="px-5 py-3 font-medium text-start">المدير</th>
                  <th className="px-5 py-3 font-medium text-start">التسليم</th>
                  <th className="px-5 py-3 font-medium text-start">القيمة</th>
                  <th className="px-5 py-3 font-medium text-start">الخطر</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {rows.map((r) => (
                  <tr key={r.id} className="group hover:bg-[var(--surface-hover)]">
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/projects/${r.id}`}
                        className="font-mono text-xs text-[var(--text-dim)] group-hover:text-[var(--accent)]"
                      >
                        {r.code}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5">
                      <Link href={`/projects/${r.id}`} className="block">
                        <div className="font-medium text-[var(--text)]">
                          {r.titleAr ?? r.title}
                        </div>
                        {r.titleAr && r.title && (
                          <div className="mt-0.5 text-xs text-[var(--text-dim)]">
                            {r.title}
                          </div>
                        )}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-[var(--text-muted)]">
                      <span className="font-mono text-[10px] text-[var(--text-dim)]">
                        {r.clientCode}
                      </span>
                      <span className="ms-2">{r.clientNameAr}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill tone={stageTone(r.stage)}>
                        {stageLabelAr(r.stage)}
                      </StatusPill>
                    </td>
                    <td className="px-5 py-3.5">
                      {r.pmName ? (
                        <div className="flex items-center gap-2">
                          <Avatar name={r.pmName} size="sm" />
                          <span className="text-sm text-[var(--text-muted)]">
                            {r.pmName}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--text-dim)]">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-[var(--text-muted)]">
                      {r.deliveryDueAt
                        ? new Date(r.deliveryDueAt).toISOString().slice(0, 10)
                        : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-end font-mono text-xs text-[var(--text-muted)]">
                      {r.contractedValueSar
                        ? `${Number(r.contractedValueSar).toLocaleString('en-US')} ر.س`
                        : '—'}
                    </td>
                    <td className="px-5 py-3.5">
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
                        <span className="text-xs text-[var(--text-dim)]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-2 text-xs">
          {page > 1 && (
            <Link
              href={{ pathname: '/projects', query: { ...sp, page: String(page - 1) } }}
              className="inline-flex h-8 items-center rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 hover:border-[var(--accent)]"
            >
              ← السابق
            </Link>
          )}
          <span className="font-mono text-[var(--text-dim)]">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={{ pathname: '/projects', query: { ...sp, page: String(page + 1) } }}
              className="inline-flex h-8 items-center rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 hover:border-[var(--accent)]"
            >
              التالي →
            </Link>
          )}
        </nav>
      )}

      {/* hide unused import warning */}
      <span className="hidden">
        <ArrowUpRight size={1} />
      </span>
    </Shell>
  );
}
