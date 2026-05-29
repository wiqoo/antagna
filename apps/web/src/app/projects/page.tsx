import Link from 'next/link';
import { redirect } from 'next/navigation';
import { desc, eq, sql, and, isNull, type SQL } from 'drizzle-orm';
import {
  db,
  clients,
  profiles,
  projectStageEnum,
  withProfileScope,
  vProjectsSafe,
  vClientsSafe,
  vTeamSafe,
} from '@antagna/db';
import {

  PageHeader,
  Card,
  StatusPill,
  EmptyState,
  Avatar,
  Button,
  AIHints,
  type AIHint,
  MiniStat,
  CardsGrid,
} from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { Briefcase, Plus, Search, X, ArrowUpRight, Sparkles, Rows3, Columns3 } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getTranslations } from 'next-intl/server';
import { stageTone, stageLabelAr } from '@/lib/project-stage';
import { getEffectiveProfileId, requirePermission } from '@/lib/authz';
import { ProjectsBoard, type BoardRow } from './projects-board';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

type SearchParams = {
  stage?: string;
  pm?: string;
  client?: string;
  q?: string;
  page?: string;
  archived?: string;
  view?: string;
};

export default async function ProjectsListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const supabase = await getSupabaseServerClient();
  const t = await getTranslations('pages.projects');
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/projects');

  // Read gate (granular RBAC). Lacking project.read → redirect to /dashboard.
  await requirePermission('project.read');

  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const filters: SQL[] = [];

  if (sp.stage && (projectStageEnum.enumValues as readonly string[]).includes(sp.stage)) {
    filters.push(eq(vProjectsSafe.stage, sp.stage));
  }
  if (sp.pm) filters.push(eq(vProjectsSafe.projectManagerId, sp.pm));
  if (sp.client) filters.push(eq(vProjectsSafe.clientId, sp.client));
  if (sp.q) {
    const like = `%${sp.q}%`;
    filters.push(
      sql`(${vProjectsSafe.title} ILIKE ${like} OR ${vProjectsSafe.titleAr} ILIKE ${like} OR ${vProjectsSafe.code} ILIKE ${like})`,
    );
  }
  if (sp.archived !== '1') filters.push(isNull(vProjectsSafe.archivedAt));

  const where = filters.length ? and(...filters) : undefined;
  const hasFilters = !!(sp.q || sp.stage || sp.pm || sp.client || sp.archived === '1');
  const view = sp.view === 'board' ? 'board' : 'table';

  // Masking GUC scope: the safe views read current_effective_profile_id() from
  // the GUC set inside withProfileScope's tx. The per-row projects read (+ its
  // count and the board fetch) all go through ONE transaction against the safe
  // views so field masking (financials / internal) applies. The aux reads
  // (pmList / clientList filter dropdowns, aggregate signals) are non-masked
  // and stay on base tables. Keep this a SINGLE withProfileScope — no nesting.
  const pid = await getEffectiveProfileId();

  const [{ rows, countRows, boardRows }, pmList, clientList, signalsRows] = await Promise.all([
    withProfileScope(pid, async (tx) => {
      const rows = await tx
        .select({
          id: vProjectsSafe.id,
          code: vProjectsSafe.code,
          title: vProjectsSafe.title,
          titleAr: vProjectsSafe.titleAr,
          stage: vProjectsSafe.stage,
          deliveryDueAt: vProjectsSafe.deliveryDueAt,
          contractedValueSar: vProjectsSafe.contractedValueSar,
          aiRiskLevel: vProjectsSafe.aiRiskLevel,
          isAbuLukaContent: vProjectsSafe.isAbuLukaContent,
          pmName: vTeamSafe.displayName,
          clientNameAr: vClientsSafe.nameAr,
          clientCode: vClientsSafe.code,
        })
        .from(vProjectsSafe)
        .leftJoin(vTeamSafe, eq(vTeamSafe.id, vProjectsSafe.projectManagerId))
        .leftJoin(vClientsSafe, eq(vClientsSafe.id, vProjectsSafe.clientId))
        .where(where)
        .orderBy(desc(vProjectsSafe.updatedAt))
        .limit(PAGE_SIZE)
        .offset(offset);

      const countRows = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(vProjectsSafe)
        .where(where);

      // Board view fetches all matching projects (no pagination), grouped by stage.
      const boardRows: BoardRow[] =
        view === 'board'
          ? ((await tx
              .select({
                id: vProjectsSafe.id,
                code: vProjectsSafe.code,
                title: vProjectsSafe.title,
                titleAr: vProjectsSafe.titleAr,
                stage: vProjectsSafe.stage,
                deliveryDueAt: vProjectsSafe.deliveryDueAt,
                contractedValueSar: vProjectsSafe.contractedValueSar,
                aiRiskLevel: vProjectsSafe.aiRiskLevel,
                isAbuLukaContent: vProjectsSafe.isAbuLukaContent,
                pmName: vTeamSafe.displayName,
                clientNameAr: vClientsSafe.nameAr,
                clientCode: vClientsSafe.code,
              })
              .from(vProjectsSafe)
              .leftJoin(vTeamSafe, eq(vTeamSafe.id, vProjectsSafe.projectManagerId))
              .leftJoin(vClientsSafe, eq(vClientsSafe.id, vProjectsSafe.clientId))
              .where(where)
              .orderBy(desc(vProjectsSafe.updatedAt))
              .limit(300)) as unknown as BoardRow[])
          : [];

      return { rows, countRows, boardRows };
    }),
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
    db.execute<{
      overdue: number;
      due_soon: number;
      stalled: number;
      high_risk: number;
      total_active: number;
    }>(sql`
      SELECT
        (SELECT count(*)::int FROM projects WHERE archived_at IS NULL
          AND delivery_due_at IS NOT NULL AND delivery_due_at < now()
          AND stage NOT IN ('delivered','archived','lost','cancelled')) AS overdue,
        (SELECT count(*)::int FROM projects WHERE archived_at IS NULL
          AND delivery_due_at IS NOT NULL
          AND delivery_due_at BETWEEN now() AND now() + interval '3 days'
          AND stage NOT IN ('delivered','archived','lost','cancelled')) AS due_soon,
        (SELECT count(*)::int FROM projects WHERE archived_at IS NULL
          AND updated_at < now() - interval '5 days'
          AND stage IN ('lead','brief','quoted','planning')) AS stalled,
        (SELECT count(*)::int FROM projects WHERE archived_at IS NULL
          AND ai_risk_level = 'high'
          AND stage NOT IN ('delivered','archived','lost','cancelled')) AS high_risk,
        (SELECT count(*)::int FROM projects WHERE archived_at IS NULL
          AND stage NOT IN ('delivered','archived','lost','cancelled')) AS total_active
    `),
  ]);

  const count = countRows[0]?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(Number(count) / PAGE_SIZE));

  const signals = (signalsRows as unknown as Array<{
    overdue: number; due_soon: number; stalled: number; high_risk: number; total_active: number;
  }>)[0] ?? { overdue: 0, due_soon: 0, stalled: 0, high_risk: 0, total_active: 0 };

  const hints: AIHint[] = [];
  if (signals.overdue > 0) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: `${signals.overdue} مشروع متأخر عن التسليم`,
      insight: 'تحرّك في الـ delivery أو حدّث التاريخ مع العميل.',
      urgent: true,
      actions: [
        { label: 'اعرض المتأخرة', href: '/projects?stage=editing', primary: true },
      ],
    });
  }
  if (signals.due_soon > 0) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: `${signals.due_soon} مشروع تسليمه خلال ٣ أيام`,
      insight: 'راجع حالة المهام والـ deliverables قبل الـ deadline.',
      urgent: signals.due_soon >= 3,
      actions: [{ label: 'افحص الجدول', href: '/calendar', primary: true }],
    });
  }
  if (signals.stalled > 0) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: `${signals.stalled} مشروع متوقف ٥+ أيام`,
      insight: 'مرحلة pre/brief والـ updated_at قديم — يحتاج متابعة.',
      urgent: false,
      actions: [{ label: 'اعرض المتوقفة', href: '/projects?stage=brief' }],
    });
  }
  if (signals.high_risk > 0 && hints.length < 3) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: `${signals.high_risk} مشروع بمستوى مخاطر مرتفع`,
      insight: 'حدّد سبب المخاطرة في كل واحد قبل أن يتفاقم.',
      actions: [{ label: 'اعرض الكل', href: '/projects' }],
    });
  }

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/projects">
      {hints.length > 0 && (
        <AIHints
          context="Antagna AI · المشاريع"
          headline={`${signals.total_active} مشروع نشط — ${hints.length} بحاجة لانتباهك`}
          hints={hints}
          compact
        />
      )}
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('title')}
        subtitle={`${count} مشروع · صفحة ${page} من ${totalPages}`}
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/briefs/new"
              className="magnet hidden md:inline-flex h-9 items-center gap-2 rounded-md border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 text-[12px] font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/20"
            >
              <Sparkles size={13} />
              برِيف بالـ AI
            </Link>
            <Link
              href="/projects/new"
              className="magnet inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-[12px] font-semibold text-white"
              style={{ background: 'var(--accent-gradient)' }}
            >
              <Plus size={14} />
              مشروع جديد
            </Link>
          </div>
        }
      />

      {/* Stat tiles */}
      <CardsGrid>
        <MiniStat
          span={3}
          label="نشطة"
          value={signals.total_active}
          href="/projects"
          tone="accent"
        />
        <MiniStat
          span={3}
          label="متأخرة"
          value={signals.overdue}
          tone={signals.overdue > 0 ? 'danger' : 'default'}
          sub={signals.overdue > 0 ? 'تجاوزت موعد التسليم' : 'كل المواعيد محترمة'}
        />
        <MiniStat
          span={3}
          label="قريبة من التسليم"
          value={signals.due_soon}
          tone={signals.due_soon > 0 ? 'warning' : 'default'}
          sub="خلال ٣ أيام"
        />
        <MiniStat
          span={3}
          label="متوقفة"
          value={signals.stalled}
          tone={signals.stalled > 0 ? 'warning' : 'default'}
          sub="٥+ أيام بدون تحديث"
        />
      </CardsGrid>

      {/* Compact filters — single-line scrollable bar */}
      <form className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search
              size={13}
              className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]"
            />
            <input
              type="text"
              name="q"
              defaultValue={sp.q ?? ''}
              placeholder="ابحث في الـ code، العنوان، أو العميل…"
              className="h-9 w-full rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 pe-9 text-[12px] text-[var(--text)] placeholder:text-[var(--text-dim)] focus:border-[var(--accent)] focus:outline-none"
            />
          </div>
          <select
            name="stage"
            defaultValue={sp.stage ?? ''}
            className="h-9 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-2 text-[12px] focus:border-[var(--accent)] focus:outline-none"
            aria-label="المرحلة"
          >
            <option value="">المرحلة: الكل</option>
            {projectStageEnum.enumValues.map((s) => (
              <option key={s} value={s}>{stageLabelAr(s)}</option>
            ))}
          </select>
          <select
            name="pm"
            defaultValue={sp.pm ?? ''}
            className="h-9 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-2 text-[12px] focus:border-[var(--accent)] focus:outline-none"
            aria-label="المدير"
          >
            <option value="">المدير: الكل</option>
            {pmList.map((p) => (
              <option key={p.id} value={p.id}>{p.displayName}</option>
            ))}
          </select>
          <select
            name="client"
            defaultValue={sp.client ?? ''}
            className="h-9 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-2 text-[12px] focus:border-[var(--accent)] focus:outline-none"
            aria-label="العميل"
          >
            <option value="">العميل: الكل</option>
            {clientList.map((c) => (
              <option key={c.id} value={c.id}>{c.nameAr}</option>
            ))}
          </select>
          <label className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-2.5 text-[12px] cursor-pointer">
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
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--line)] px-2.5 text-[12px] text-[var(--text-muted)] hover:border-[var(--line-strong)] hover:text-[var(--text)]"
            >
              <X size={13} />
              مسح
            </Link>
          )}
        </div>
      </form>

      {/* View toggle */}
      <div className="flex items-center justify-end">
        <div className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--surface)] p-0.5">
          <Link
            href={{ pathname: '/projects', query: { ...sp, view: 'table' } }}
            className={
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium ' +
              (view === 'table'
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]')
            }
          >
            <Rows3 size={13} /> جدول
          </Link>
          <Link
            href={{ pathname: '/projects', query: { ...sp, view: 'board' } }}
            className={
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium ' +
              (view === 'board'
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]')
            }
          >
            <Columns3 size={13} /> لوحة
          </Link>
        </div>
      </div>

      {view === 'board' ? (
        boardRows.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Briefcase size={20} />}
              title="لا توجد مشاريع بهذه المعايير"
              description={
                hasFilters ? 'جرّب تعديل أو مسح الفلاتر.' : 'ابدأ بإنشاء مشروعك الأول.'
              }
            />
          </Card>
        ) : (
          <ProjectsBoard rows={boardRows} />
        )
      ) : (
      /* Table */
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
                      <Link href={`/projects/${r.id}`} className="block">
                        <div className="font-medium text-[var(--text)] group-hover:text-[var(--accent)]">
                          {r.titleAr ?? r.title}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--text-dim)]">
                          {r.titleAr && r.title && <span>{r.title}</span>}
                          {r.titleAr && r.title && <span>·</span>}
                          <span className="font-mono text-[10px] opacity-70">{r.code}</span>
                        </div>
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-[var(--text-muted)]">
                      {r.clientNameAr ? (
                        <>
                          <span className="font-mono text-[10px] text-[var(--text-dim)]">
                            {r.clientCode}
                          </span>
                          <span className="ms-2">{r.clientNameAr}</span>
                        </>
                      ) : r.isAbuLukaContent ? (
                        <span className="inline-flex items-center rounded-md bg-[var(--accent)]/10 px-2 py-0.5 text-xs font-medium text-[var(--accent)]">
                          محتوى أبو لوكا
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--text-dim)]">—</span>
                      )}
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
      )}

      {view === 'table' && totalPages > 1 && (
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
