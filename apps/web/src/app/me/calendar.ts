import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';

export interface CalItem {
  id: string;
  title: string;
  kind: string;
  date: string;          // YYYY-MM-DD (Riyadh)
  startHm: string;       // HH:MM (Riyadh) or '' for all-day
  endHm: string | null;
  startMin: number;      // minutes from midnight (for sorting/timeline); 0 if all-day
  allDay: boolean;
  location: string | null;
  project: string | null;
  source: 'manual' | 'antagna';
  ref: string;
}

const KIND_META: Record<string, { icon: string; color: string; label: string }> = {
  shoot:    { icon: '🎥', color: '#60A5FA', label: 'تصوير' },
  meeting:  { icon: '👥', color: '#A78BFA', label: 'اجتماع' },
  deep:     { icon: '🎯', color: '#FF6B1A', label: 'تركيز' },
  admin:    { icon: '🗂️', color: '#9C9CA8', label: 'إداري' },
  personal: { icon: '🌿', color: '#34D399', label: 'شخصي' },
  block:    { icon: '⏸️', color: '#6B6B78', label: 'بلوك' },
  event:    { icon: '📌', color: '#FBBF24', label: 'موعد' },
  task:     { icon: '🔗', color: '#60A5FA', label: 'انتجنا' },
};
export function kindMeta(kind: string) { return KIND_META[kind] ?? KIND_META.event!; }

/** Calendar items in a date range = manual me_events ∪ his due Antagna tasks. */
export async function getCalItems(ownerId: string, fromDate: string, toDate: string): Promise<CalItem[]> {
  const manual = (await db.execute(sql`
    SELECT e.id::text, e.title, e.kind, e.all_day AS "allDay", e.location, e.source_ref AS ref, e.source,
           to_char(e.start_at AT TIME ZONE 'Asia/Riyadh','YYYY-MM-DD') AS date,
           CASE WHEN e.all_day THEN '' ELSE to_char(e.start_at AT TIME ZONE 'Asia/Riyadh','HH24:MI') END AS "startHm",
           CASE WHEN e.end_at IS NULL THEN NULL ELSE to_char(e.end_at AT TIME ZONE 'Asia/Riyadh','HH24:MI') END AS "endHm",
           (extract(hour FROM e.start_at AT TIME ZONE 'Asia/Riyadh')*60 + extract(minute FROM e.start_at AT TIME ZONE 'Asia/Riyadh'))::int AS "startMin",
           p.title AS project
    FROM me_events e LEFT JOIN me_projects p ON p.id = e.project_id
    WHERE e.owner_id = ${ownerId}::uuid AND e.status <> 'cancelled'
      AND (e.start_at AT TIME ZONE 'Asia/Riyadh')::date BETWEEN ${fromDate}::date AND ${toDate}::date
    ORDER BY e.start_at
  `)) as unknown as Array<Omit<CalItem, 'id'> & { id: string }>;

  let antagnaRows: Array<{ id: string; title: string; project: string | null; date: string; startHm: string; startMin: number }> = [];
  try {
    antagnaRows = (await db.execute(sql`
      SELECT pt.id::text AS id, pt.title,
             COALESCE(p.title_ar, p.title) AS project,
             to_char(pt.due_at AT TIME ZONE 'Asia/Riyadh','YYYY-MM-DD') AS date,
             to_char(pt.due_at AT TIME ZONE 'Asia/Riyadh','HH24:MI') AS "startHm",
             (extract(hour FROM pt.due_at AT TIME ZONE 'Asia/Riyadh')*60 + extract(minute FROM pt.due_at AT TIME ZONE 'Asia/Riyadh'))::int AS "startMin"
      FROM project_tasks pt JOIN projects p ON p.id = pt.project_id
      WHERE pt.assignee_id = ${ownerId}::uuid
        AND pt.status IN ('pending','in_progress','blocked')
        AND pt.due_at IS NOT NULL
        AND (pt.due_at AT TIME ZONE 'Asia/Riyadh')::date BETWEEN ${fromDate}::date AND ${toDate}::date
      ORDER BY pt.due_at LIMIT 60
    `)) as unknown as Array<{ id: string; title: string; project: string | null; date: string; startHm: string; startMin: number }>;
  } catch { antagnaRows = []; }

  const items: CalItem[] = [
    ...manual.map((m) => ({ ...m, source: (m.source as 'manual' | 'antagna') ?? 'manual', endHm: m.endHm ?? null, ref: m.ref ?? m.id })),
    ...antagnaRows.map((a) => ({
      id: 'antagna:' + a.id, title: a.title, kind: 'task', date: a.date, startHm: a.startHm, endHm: null,
      startMin: a.startMin, allDay: false, location: null, project: a.project, source: 'antagna' as const, ref: a.id,
    })),
  ];
  return items.sort((x, y) => (x.date === y.date ? x.startMin - y.startMin : x.date < y.date ? -1 : 1));
}
