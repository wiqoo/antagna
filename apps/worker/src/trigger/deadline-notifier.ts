/**
 * Cross-cutting — deadline notifier (worker side of the unified notification
 * service).
 *
 * Walks project_tasks whose due_at falls inside the next 48 hours and whose
 * assignee hasn't already been pinged in the last 24 hours, then POSTs each
 * one to /api/internal/notify with event = on_deadline. The web's notify()
 * fans out to in-app + email + WhatsApp according to the recipient's prefs
 * and renders in their ui_language — the worker never imports Resend or
 * WPPConnect directly.
 *
 * Runs every 2 hours.
 */
// Piggybacks on insights-scanner (every 2h) — same reason as the media scanner.
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';

const PER_RUN_LIMIT = 100;

type DeadlineRow = {
  id: string;
  title: string;
  dueAt: string;
  assigneeId: string;
  projectId: string;
  projectTitle: string;
};

function fmtDue(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const hours = Math.round((d.getTime() - now) / (1000 * 60 * 60));
  if (hours <= 0) return 'متأخرة';
  if (hours < 24) return `خلال ${hours} ساعة`;
  return `خلال ${Math.round(hours / 24)} يوم`;
}

export async function runDeadlineNotifier(): Promise<
  | { items: number; fanned: number }
  | { skipped: string }
> {
    const baseUrl = process.env.ANTAGNA_BASE_URL;
    const cronSecret = process.env.CRON_SECRET;
    if (!baseUrl || !cronSecret) {
      console.warn('[deadline-notifier] ANTAGNA_BASE_URL / CRON_SECRET missing');
      return { skipped: 'env_missing' };
    }

    // Tasks due within 48h, not done, not already pinged in last 24h.
    const dueSoon = (await db.execute(sql`
      SELECT pt.id::text AS id,
             pt.title,
             pt.due_at AS "dueAt",
             pt.assignee_id::text AS "assigneeId",
             pt.project_id::text AS "projectId",
             COALESCE(p.title_ar, p.title) AS "projectTitle"
      FROM project_tasks pt
      LEFT JOIN projects p ON p.id = pt.project_id
      WHERE pt.assignee_id IS NOT NULL
        AND pt.due_at IS NOT NULL
        AND pt.due_at <= now() + interval '48 hours'
        AND pt.status NOT IN ('completed','cancelled')
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.entity_type = 'project_task'
            AND n.entity_id = pt.id
            AND n.event = 'on_deadline'
            AND n.created_at >= now() - interval '24 hours'
        )
      ORDER BY pt.due_at ASC
      LIMIT ${PER_RUN_LIMIT}
    `)) as unknown as DeadlineRow[];

    if (dueSoon.length === 0) return { fanned: 0, items: 0 };

    const items = dueSoon.map((t) => ({
      recipientId: t.assigneeId,
      event: 'on_deadline',
      content: {
        ar: {
          title: `قرب موعد التسليم: ${t.title}`,
          body: `${t.projectTitle} — ${fmtDue(t.dueAt)}.`,
        },
        en: {
          title: `Deadline approaching: ${t.title}`,
          body: `${t.projectTitle} — due in ${Math.max(
            0,
            Math.round((new Date(t.dueAt).getTime() - Date.now()) / (1000 * 60 * 60)),
          )}h.`,
        },
      },
      linkUrl: `/projects/${t.projectId}/board`,
      entityType: 'project_task',
      entityId: t.id,
      metadata: { dueAt: t.dueAt },
    }));

    const r = await fetch(`${baseUrl}/api/internal/notify`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-cron-secret': cronSecret,
      },
      body: JSON.stringify({ items }),
    });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`notify ${r.status}: ${txt.slice(0, 200)}`);
    }
    const payload = (await r.json()) as { sent?: number };
    return { items: items.length, fanned: payload.sent ?? 0 };
}
