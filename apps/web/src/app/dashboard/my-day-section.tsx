/**
 * "My Day" section — merged into /dashboard (the standalone /my-day route is
 * retired). Renders, for the effective (view-as aware) profile: the per-position
 * routine checklist + today's items (shoots, tasks due, approvals waiting on me,
 * threads needing my reply). Streams on its OWN Suspense lane so its ~7 queries
 * never block the briefing hero or the card board (and vice-versa).
 *
 * Returns null when there's nothing personal to show (admin with no position /
 * empty day) so the dashboard collapses cleanly to briefing + board.
 */
import { Suspense } from 'react';
import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { Card, CardHeader, StatusPill, EmptyState } from '@antagna/ui';
import {
  ListChecks, CalendarDays, CheckSquare, Inbox, ClipboardCheck, Camera,
} from 'lucide-react';
import { loadRoutines, routineSourceKey, riyadhToday } from '@/lib/routines';
import { ensureTodayRoutine } from './my-day-actions';
import { RoutineChecklist, type RoutineRow } from './routine';

const PRIORITY_TONE: Record<string, 'neutral' | 'info' | 'warning' | 'danger'> = {
  low: 'neutral',
  normal: 'info',
  high: 'warning',
  urgent: 'danger',
};

function fmtTime(d: Date): string {
  return new Intl.DateTimeFormat('ar-SA', {
    timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit',
  }).format(d);
}
function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat('ar-SA', {
    timeZone: 'Asia/Riyadh', day: 'numeric', month: 'short',
  }).format(d);
}

function MyDaySkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {Array.from({ length: 2 }).map((_, i) => (
        <div
          key={i}
          className="h-40 animate-pulse rounded-xl border border-[var(--line)] bg-[var(--surface)]/40"
        />
      ))}
    </div>
  );
}

async function MyDayInner({
  profileId,
  isImpersonating,
}: {
  profileId: string;
  isImpersonating: boolean;
}) {
  const me = profileId;

  const posRows = await db.execute<{ position_key: string | null; name_ar: string | null }>(
    sql`SELECT p.position_key,
               (SELECT name_ar FROM positions WHERE key = p.position_key) AS name_ar
        FROM profiles p WHERE p.id = ${me}::uuid`,
  );
  const positionKey =
    (posRows as unknown as { position_key: string | null }[])[0]?.position_key ?? null;
  const positionNameAr =
    (posRows as unknown as { name_ar: string | null }[])[0]?.name_ar ?? null;

  // Materialize today's routine (idempotent). Skip when an admin is viewing-as
  // someone else so testing never writes rows onto the impersonated profile.
  if (!isImpersonating) {
    await ensureTodayRoutine(me, positionKey).catch((err) => {
      console.error('[my-day-section] ensureTodayRoutine', err);
    });
  }

  const routineItems = loadRoutines(positionKey);
  const day = riyadhToday();
  const wantKeys = routineItems.map((it) => routineSourceKey(it.key, day));

  const [
    routineRowsArr,
    shootsArr,
    tasksDueArr,
    dailyDueArr,
    approvalsArr,
    threadsArr,
  ] = await Promise.all([
    wantKeys.length
      ? db.execute<{ id: string; source_key: string; status: string }>(sql`
          SELECT id::text, source_key, status::text AS status
          FROM daily_tasks
          WHERE owner_id = ${me}::uuid
            AND source_key = ANY(ARRAY[${sql.join(wantKeys.map((k) => sql`${k}`), sql`, `)}]::text[])
        `)
      : Promise.resolve([] as unknown as Array<{ id: string; source_key: string; status: string }>),

    db.execute<{ id: string; title_ar: string | null; title: string; starts_at: Date; city: string | null }>(sql`
      SELECT DISTINCT p.id::text, p.title_ar, p.title, p.shoot_starts_at AS starts_at, c.city
      FROM projects p
      LEFT JOIN clients c ON c.id = p.client_id
      LEFT JOIN project_assignments pa ON pa.project_id = p.id AND pa.profile_id = ${me}::uuid
      WHERE p.shoot_starts_at IS NOT NULL
        AND p.archived_at IS NULL
        AND (p.shoot_starts_at AT TIME ZONE 'Asia/Riyadh')::date
            = (now() AT TIME ZONE 'Asia/Riyadh')::date
        AND (
          pa.profile_id IS NOT NULL
          OR p.project_manager_id = ${me}::uuid
          OR p.production_manager_id = ${me}::uuid
          OR p.account_manager_id = ${me}::uuid
        )
      ORDER BY p.shoot_starts_at
      LIMIT 10
    `),

    db.execute<{ id: string; title: string; priority: string; due_at: Date | null; project_id: string; project_code: string; project_title_ar: string | null; project_title: string }>(sql`
      SELECT t.id::text, t.title, t.priority::text AS priority, t.due_at,
             p.id::text AS project_id, p.code AS project_code,
             p.title_ar AS project_title_ar, p.title AS project_title
      FROM project_tasks t
      INNER JOIN projects p ON p.id = t.project_id
      WHERE t.assignee_id = ${me}::uuid
        AND t.status IN ('pending','in_progress','blocked')
        AND t.due_at IS NOT NULL
        AND (t.due_at AT TIME ZONE 'Asia/Riyadh')::date
            <= (now() AT TIME ZONE 'Asia/Riyadh')::date
      ORDER BY t.due_at ASC
      LIMIT 12
    `),

    db.execute<{ id: string; title: string; priority: string; due_at: Date | null }>(sql`
      SELECT id::text, title, priority::text AS priority, due_at
      FROM daily_tasks
      WHERE owner_id = ${me}::uuid
        AND status IN ('pending','in_progress','blocked')
        AND (source_key IS NULL OR source_key NOT LIKE 'routine:%')
        AND due_at IS NOT NULL
        AND (due_at AT TIME ZONE 'Asia/Riyadh')::date
            <= (now() AT TIME ZONE 'Asia/Riyadh')::date
      ORDER BY due_at ASC
      LIMIT 12
    `),

    db.execute<{ id: string; stage: string; deliverable_title: string | null; project_id: string | null; project_code: string | null; submitted_at: Date }>(sql`
      SELECT ia.id::text, ia.stage::text AS stage,
             d.title AS deliverable_title,
             pr.id::text AS project_id, pr.code AS project_code,
             ia.submitted_at
      FROM internal_approvals ia
      LEFT JOIN deliverables d ON d.id = ia.deliverable_id
      LEFT JOIN projects pr ON pr.id = d.project_id
      WHERE ia.reviewer_profile_id = ${me}::uuid
        AND ia.status = 'pending'
      ORDER BY ia.submitted_at ASC
      LIMIT 12
    `),

    db.execute<{ id: string; subject: string | null; ai_summary: string | null; status: string; last_message_at: Date | null }>(sql`
      SELECT id::text, subject, ai_summary, status, last_message_at
      FROM email_threads
      WHERE assigned_profile_id = ${me}::uuid
        AND status IN ('open','waiting_client')
      ORDER BY last_message_at DESC NULLS LAST
      LIMIT 10
    `),
  ]);

  const statusBySourceKey = new Map<string, { id: string; status: string }>();
  for (const r of routineRowsArr as unknown as Array<{ id: string; source_key: string; status: string }>) {
    statusBySourceKey.set(r.source_key, { id: r.id, status: r.status });
  }
  const routineRows: RoutineRow[] = routineItems
    .map((it) => {
      const hit = statusBySourceKey.get(routineSourceKey(it.key, day));
      if (!hit) return null;
      return {
        id: hit.id,
        title: it.titleAr,
        when: it.when,
        done: hit.status === 'completed',
      } satisfies RoutineRow;
    })
    .filter((r): r is RoutineRow => r !== null);

  const shoots = shootsArr as unknown as Array<{ id: string; title_ar: string | null; title: string; starts_at: Date; city: string | null }>;
  const tasksDue = tasksDueArr as unknown as Array<{ id: string; title: string; priority: string; due_at: Date | null; project_id: string; project_code: string; project_title_ar: string | null; project_title: string }>;
  const dailyDue = dailyDueArr as unknown as Array<{ id: string; title: string; priority: string; due_at: Date | null }>;
  const approvals = approvalsArr as unknown as Array<{ id: string; stage: string; deliverable_title: string | null; project_id: string | null; project_code: string | null; submitted_at: Date }>;
  const threads = threadsArr as unknown as Array<{ id: string; subject: string | null; ai_summary: string | null; status: string; last_message_at: Date | null }>;

  const totalItems =
    shoots.length + tasksDue.length + dailyDue.length + approvals.length + threads.length;

  // Nothing personal to show → render nothing (board-only dashboard).
  if (routineRows.length === 0 && totalItems === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2 pt-1 text-[11px] uppercase tracking-[0.18em] text-[var(--text-dim)]">
        <ListChecks size={13} />
        <span>
          {['مهامك اليوم', positionNameAr, totalItems ? `${totalItems} عنصر` : null]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </div>

      {routineRows.length > 0 && (
        <Card>
          <CardHeader
            title="روتين اليوم"
            subtitle={positionNameAr ? `قائمة ${positionNameAr} اليوميّة` : 'قائمتك اليوميّة'}
          />
          <RoutineChecklist initial={routineRows} />
        </Card>
      )}

      {totalItems > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Shoots today */}
          <Card padded={false} as="section">
            <div className="p-6 pb-4">
              <CardHeader title="تصوير اليوم" subtitle={`${shoots.length} موعد`} />
            </div>
            {shoots.length === 0 ? (
              <EmptyState icon={<Camera size={20} />} title="لا تصوير اليوم" description="لا جلسات تصوير مجدولة لك اليوم." />
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {shoots.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-6 py-3 hover:bg-[var(--surface-hover)]">
                    <CalendarDays size={16} className="shrink-0 text-[var(--text-dim)]" />
                    <Link href={`/projects/${s.id}`} className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--text)]">{s.title_ar ?? s.title}</p>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                        <span className="font-mono">{fmtTime(new Date(s.starts_at))}</span>
                        {s.city ? ` · ${s.city}` : ''}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Tasks due */}
          <Card padded={false} as="section">
            <div className="p-6 pb-4">
              <CardHeader title="مهام مستحقّة اليوم" subtitle={`${tasksDue.length + dailyDue.length} مهمة`} />
            </div>
            {tasksDue.length + dailyDue.length === 0 ? (
              <EmptyState icon={<CheckSquare size={20} />} title="لا مهام مستحقّة" description="لا مهام مشاريع أو يوميّة مستحقّة عليك اليوم." />
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {tasksDue.map((t) => (
                  <li key={`p-${t.id}`} className="flex items-center gap-3 px-6 py-3 hover:bg-[var(--surface-hover)]">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--text)]">{t.title}</p>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                        <Link href={`/projects/${t.project_id}`} className="font-mono text-[var(--text-dim)] hover:text-[var(--accent)]">
                          {t.project_code}
                        </Link>{' '}
                        · {t.project_title_ar ?? t.project_title}
                        {t.due_at ? ` · ${fmtDate(new Date(t.due_at))}` : ''}
                      </p>
                    </div>
                    <StatusPill tone={PRIORITY_TONE[t.priority] ?? 'info'}>{t.priority}</StatusPill>
                  </li>
                ))}
                {dailyDue.map((t) => (
                  <li key={`d-${t.id}`} className="flex items-center gap-3 px-6 py-3 hover:bg-[var(--surface-hover)]">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--text)]">{t.title}</p>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                        مهمة يوميّة{t.due_at ? ` · ${fmtDate(new Date(t.due_at))}` : ''}
                      </p>
                    </div>
                    <StatusPill tone={PRIORITY_TONE[t.priority] ?? 'info'}>{t.priority}</StatusPill>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Approvals waiting on me */}
          <Card padded={false} as="section">
            <div className="p-6 pb-4">
              <CardHeader title="موافقات تنتظرك" subtitle={`${approvals.length} عنصر`} />
            </div>
            {approvals.length === 0 ? (
              <EmptyState icon={<ClipboardCheck size={20} />} title="لا موافقات معلّقة" description="لا شيء بانتظار مراجعتك الآن." />
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {approvals.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-6 py-3 hover:bg-[var(--surface-hover)]">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--text)]">
                        {a.deliverable_title ?? 'عنصر تسليم'}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                        {a.project_id ? (
                          <Link href={`/projects/${a.project_id}`} className="font-mono text-[var(--text-dim)] hover:text-[var(--accent)]">
                            {a.project_code}
                          </Link>
                        ) : null}{' '}
                        · مرحلة {a.stage} · {fmtDate(new Date(a.submitted_at))}
                      </p>
                    </div>
                    <StatusPill tone="warning">مراجعة</StatusPill>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Threads needing reply */}
          <Card padded={false} as="section">
            <div className="p-6 pb-4">
              <CardHeader title="محادثات تنتظر ردّك" subtitle={`${threads.length} محادثة`} />
            </div>
            {threads.length === 0 ? (
              <EmptyState icon={<Inbox size={20} />} title="صندوقك نظيف" description="لا محادثات مفتوحة مسندة إليك تنتظر الرد." />
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {threads.map((th) => (
                  <li key={th.id} className="flex items-center gap-3 px-6 py-3 hover:bg-[var(--surface-hover)]">
                    <Link href={`/inbox/${th.id}`} className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--text)]">
                        {th.subject ?? th.ai_summary ?? '(بدون عنوان)'}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                        {th.status === 'waiting_client' ? 'بانتظار العميل' : 'مفتوحة'}
                        {th.last_message_at ? ` · ${fmtDate(new Date(th.last_message_at))}` : ''}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </section>
  );
}

/** My-Day section, streamed on its own Suspense lane. Renders nothing when the
 *  profile has no routine and an empty day. */
export function StreamedMyDay(props: {
  profileId: string;
  isImpersonating: boolean;
}) {
  return (
    <Suspense fallback={<MyDaySkeleton />}>
      <MyDayInner {...props} />
    </Suspense>
  );
}
