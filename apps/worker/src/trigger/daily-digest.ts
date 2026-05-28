/**
 * Cross-cutting — daily digest notifier.
 *
 * Each morning, for every active profile, compose a tiny summary of "your
 * day": open tasks, tasks due today, unread email threads — POST it to
 * /api/internal/notify with event = daily_digest. The web's notify() honors
 * the recipient's channel prefs + ui_language.
 *
 * Piggybacked on daily-brief (04:30 UTC = 07:30 Asia/Riyadh), so it stays
 * under the Trigger.dev Pro 10-schedule cap.
 */
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';

type Person = { id: string; lang: string };

type DigestStats = {
  openTasks: number;
  dueToday: number;
  unread: number;
};

export async function runDailyDigest(): Promise<
  { sentTo: number; fanned: number } | { skipped: string }
> {
  const baseUrl = process.env.ANTAGNA_BASE_URL;
  const cronSecret = process.env.CRON_SECRET;
  if (!baseUrl || !cronSecret) return { skipped: 'env_missing' };

  // Anyone active. The notify() endpoint will silently skip recipients whose
  // notification_prefs disable daily_digest on every channel.
  const people = (await db.execute(sql`
    SELECT id::text AS id, COALESCE(ui_language, 'ar') AS lang
    FROM profiles
    WHERE active = true
  `)) as unknown as Person[];

  if (people.length === 0) return { sentTo: 0, fanned: 0 };

  // Pull everyone's stats in one round trip per metric.
  const openByPerson = new Map<string, number>();
  const dueTodayByPerson = new Map<string, number>();
  const unreadByPerson = new Map<string, number>();

  const openRows = (await db.execute(sql`
    SELECT assignee_id::text AS pid, count(*)::int AS n
    FROM project_tasks
    WHERE assignee_id IS NOT NULL AND status NOT IN ('completed','cancelled')
    GROUP BY assignee_id
  `)) as unknown as { pid: string; n: number }[];
  for (const r of openRows) openByPerson.set(r.pid, r.n);

  const dueRows = (await db.execute(sql`
    SELECT assignee_id::text AS pid, count(*)::int AS n
    FROM project_tasks
    WHERE assignee_id IS NOT NULL AND status NOT IN ('completed','cancelled')
      AND due_at::date = (now() AT TIME ZONE 'Asia/Riyadh')::date
    GROUP BY assignee_id
  `)) as unknown as { pid: string; n: number }[];
  for (const r of dueRows) dueTodayByPerson.set(r.pid, r.n);

  // Unread emails per assigned profile (best-effort — email_threads.assigned_profile_id).
  const unreadRows = (await db
    .execute(
      sql`SELECT assigned_profile_id::text AS pid, count(*)::int AS n
          FROM email_threads
          WHERE assigned_profile_id IS NOT NULL
            AND COALESCE(reply_state,'pending') = 'pending'
          GROUP BY assigned_profile_id`,
    )
    .catch(() => [] as unknown)) as unknown as { pid: string; n: number }[];
  for (const r of unreadRows) unreadByPerson.set(r.pid, r.n);

  const items = people
    .map((p) => {
      const stats: DigestStats = {
        openTasks: openByPerson.get(p.id) ?? 0,
        dueToday: dueTodayByPerson.get(p.id) ?? 0,
        unread: unreadByPerson.get(p.id) ?? 0,
      };
      // Don't ping people who have literally nothing to do.
      if (stats.openTasks === 0 && stats.dueToday === 0 && stats.unread === 0) {
        return null;
      }
      const ar = {
        title: 'موجز اليوم',
        body:
          `${stats.openTasks} مهمة مفتوحة` +
          (stats.dueToday ? ` · ${stats.dueToday} تستحق اليوم` : '') +
          (stats.unread ? ` · ${stats.unread} رسالة بريد بانتظار الرد` : ''),
      };
      const en = {
        title: 'Your day',
        body:
          `${stats.openTasks} open tasks` +
          (stats.dueToday ? ` · ${stats.dueToday} due today` : '') +
          (stats.unread ? ` · ${stats.unread} emails awaiting reply` : ''),
      };
      return {
        recipientId: p.id,
        event: 'daily_digest',
        content: { ar, en },
        linkUrl: '/tasks',
        metadata: stats,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (items.length === 0) return { sentTo: 0, fanned: 0 };

  const r = await fetch(`${baseUrl}/api/internal/notify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-cron-secret': cronSecret },
    body: JSON.stringify({ items }),
  });
  if (!r.ok) throw new Error(`notify ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const payload = (await r.json()) as { sent?: number };
  return { sentTo: items.length, fanned: payload.sent ?? 0 };
}
