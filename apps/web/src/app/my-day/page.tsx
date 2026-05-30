import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import {
  PageHeader,
  Card,
  CardHeader,
  StatusPill,
  EmptyState,
} from '@antagna/ui';
import {
  ListChecks, CalendarDays, CheckSquare, Inbox, ClipboardCheck,
  Camera, Sun,
} from 'lucide-react';
import { Shell } from '@/components/Shell';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/view-as';
import { loadRoutines } from '@/lib/routines';
import { StreamedBoard } from '../dashboard/board-section';
import { ensureTodayRoutine } from './actions';
import { routineSourceKey, riyadhToday } from '@/lib/routines';
import { RoutineChecklist, type RoutineRow } from './routine';

export const dynamic = 'force-dynamic';
// Headroom for the streamed position board's cold-start query fan-out.
export const maxDuration = 30;

const PRIORITY_TONE: Record<string, 'neutral' | 'info' | 'warning' | 'danger'> = {
  low: 'neutral',
  normal: 'info',
  high: 'warning',
  urgent: 'danger',
};

function fmtTime(d: Date): string {
  return new Intl.DateTimeFormat('ar-SA', {
    timeZone: 'Asia/Riyadh',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat('ar-SA', {
    timeZone: 'Asia/Riyadh',
    day: 'numeric',
    month: 'short',
  }).format(d);
}

export default async function MyDayPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/my-day');

  // Effective (view-as aware) profile — an admin "viewing as" someone sees
  // THAT person's day, which is the point of testing per-position landings.
  const current = await getCurrentProfile();
  if (!current) redirect('/login?next=/my-day');
  const me = current.id;

  // Position drives both the routine and the embedded board.
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
  // someone else — we don't want testing to write rows into their day. (The
  // effective profile here IS the impersonated one, so without this guard the
  // write would land on them.) Their already-materialized rows still render.
  if (!current.isImpersonating) {
    await ensureTodayRoutine(me, positionKey).catch((err) => {
      console.error('[my-day] ensureTodayRoutine', err);
    });
  }

  const routineItems = loadRoutines(positionKey);
  const day = riyadhToday();
  const wantKeys = routineItems.map((it) => routineSourceKey(it.key, day));

  // ── TODAY's items scoped to me — one round trip ────────────────────────────
  const [
    routineRowsArr,
    shootsArr,
    tasksDueArr,
    dailyDueArr,
    approvalsArr,
    threadsArr,
  ] = await Promise.all([
    // Today's routine rows (materialized above) → status for the checklist.
    wantKeys.length
      ? db.execute<{ id: string; source_key: string; status: string }>(sql`
          SELECT id::text, source_key, status::text AS status
          FROM daily_tasks
          WHERE owner_id = ${me}::uuid
            AND source_key = ANY(ARRAY[${sql.join(wantKeys.map((k) => sql`${k}`), sql`, `)}]::text[])
        `)
      : Promise.resolve([] as unknown as Array<{ id: string; source_key: string; status: string }>),

    // Shoots TODAY (Riyadh) on projects I'm assigned to, manage, or account for.
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

    // Project tasks due today-or-overdue, assigned to me, not done.
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

    // Daily tasks due today-or-overdue, owned by me, not done, NOT routine rows
    // (routine is its own checklist above).
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

    // Internal approvals waiting on me (I'm the reviewer, still pending).
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

    // Email threads I own that need a reply (open / waiting_client).
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
      if (!hit) return null; // not materialized (e.g. admin impersonating) → skip
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

  const hour = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Riyadh', hour: '2-digit', hour12: false }).format(new Date()),
  );
  const greeting = hour < 12 ? 'صباح الخير' : hour < 18 ? 'مرحباً' : 'مساء الخير';
  const firstName = current.displayName?.trim().split(/\s+/)[0] ?? '';
  const dateStr = new Intl.DateTimeFormat('ar-SA', {
    timeZone: 'Asia/Riyadh',
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date());

  return (
    <Shell
      user={{ email: current.email, displayName: current.displayName }}
      activePath="/my-day"
    >
      <PageHeader
        eyebrow={`${greeting} ${firstName}`.trim()}
        title="يومك"
        subtitle={
          [positionNameAr, dateStr, `${totalItems} عنصر على طاولتك اليوم`]
            .filter(Boolean)
            .join(' · ')
        }
      />

      {/* ── Routine checklist ──────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="روتين اليوم"
          subtitle={positionNameAr ? `قائمة ${positionNameAr} اليوميّة` : 'قائمتك اليوميّة'}
        />
        {routineRows.length === 0 ? (
          <EmptyState
            icon={<Sun size={20} />}
            title="لا روتين محدّد لمنصبك بعد"
            description="سيظهر هنا روتين يومي تلقائي حسب منصبك. أضِف منصبك أو راجع config/routines.yaml."
          />
        ) : (
          <RoutineChecklist initial={routineRows} />
        )}
      </Card>

      {/* ── Today's items ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Shoots today */}
        <Card padded={false} as="section">
          <div className="p-6 pb-4">
            <CardHeader title="تصوير اليوم" subtitle={`${shoots.length} موعد`} />
          </div>
          {shoots.length === 0 ? (
            <EmptyState
              icon={<Camera size={20} />}
              title="لا تصوير اليوم"
              description="لا توجد جلسات تصوير مجدولة لك اليوم."
            />
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

        {/* Tasks due (project + daily merged) */}
        <Card padded={false} as="section">
          <div className="p-6 pb-4">
            <CardHeader
              title="مهام مستحقّة اليوم"
              subtitle={`${tasksDue.length + dailyDue.length} مهمة`}
            />
          </div>
          {tasksDue.length + dailyDue.length === 0 ? (
            <EmptyState
              icon={<CheckSquare size={20} />}
              title="لا مهام مستحقّة"
              description="لا توجد مهام مشاريع أو يوميّة مستحقّة عليك اليوم."
            />
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
            <EmptyState
              icon={<ClipboardCheck size={20} />}
              title="لا موافقات معلّقة"
              description="لا شيء بانتظار مراجعتك الآن."
            />
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

        {/* Email threads needing reply */}
        <Card padded={false} as="section">
          <div className="p-6 pb-4">
            <CardHeader title="محادثات تنتظر ردّك" subtitle={`${threads.length} محادثة`} />
          </div>
          {threads.length === 0 ? (
            <EmptyState
              icon={<Inbox size={20} />}
              title="صندوقك نظيف"
              description="لا محادثات مفتوحة مسندة إليك تنتظر الرد."
            />
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

      {/* ── Embedded position card board ───────────────────────────────── */}
      <div className="flex items-center gap-2 pt-2 text-[11px] uppercase tracking-[0.18em] text-[var(--text-dim)]">
        <ListChecks size={13} />
        <span>لوحة منصبك</span>
      </div>
      {/* Position board — streamed behind Suspense (shared with /dashboard) so
          its ~10 queries never block the page from opening. */}
      <StreamedBoard profileId={me} role={current.role} />
    </Shell>
  );
}
