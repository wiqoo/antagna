import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { todayRiyadh } from './data';

/**
 * Materialise today's recurring items into me_tasks (idempotent via source_key).
 * Called on the Today page render. daily = every day; weekdays = Sun–Thu (the
 * KSA work week); weekly = a specific weekday.
 */
export async function ensureTodayRecurring(ownerId: string): Promise<void> {
  const today = todayRiyadh();
  // weekday in Riyadh (0=Sun … 6=Sat)
  const wd = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Riyadh' }),
  ).getDay();
  const isWorkday = wd >= 0 && wd <= 4; // Sun–Thu

  const recs = (await db.execute(sql`
    SELECT id::text, project_id::text AS "projectId", title, cadence, weekday
    FROM me_recurring WHERE owner_id = ${ownerId}::uuid AND active = true
  `)) as unknown as Array<{ id: string; projectId: string | null; title: string; cadence: string; weekday: number | null }>;

  for (const r of recs) {
    const due =
      r.cadence === 'daily' ||
      (r.cadence === 'weekdays' && isWorkday) ||
      (r.cadence === 'weekly' && r.weekday === wd);
    if (!due) continue;
    await db.execute(sql`
      INSERT INTO me_tasks (owner_id, project_id, title, is_today, source_key, recurring_id, due_date)
      VALUES (${ownerId}::uuid, ${r.projectId ? sql`${r.projectId}::uuid` : sql`NULL`}, ${r.title}, true,
              ${'recur:' + r.id + ':' + today}, ${r.id}::uuid, ${today}::date)
      ON CONFLICT (owner_id, source_key) WHERE source_key IS NOT NULL DO NOTHING
    `);
  }
}

const STAGE_TEMPLATES: Record<string, string[]> = {
  planning: ['استلام/كتابة البريف', 'تحديد الميزانية', 'المرجع/المود بورد', 'جدول مبدئي'],
  shooting: ['تأكيد اللوكيشن', 'تجهيز المعدات', 'call sheet', 'تأكيد الفريق'],
  editing: ['تنزيل الفوتيج', 'أول كت', 'ريتاتش/تلوين', 'مراجعة داخلية'],
  delivery: ['preview للعميل', 'تجميع الملاحظات', 'الاعتماد', 'التسليم + الأرشفة'],
};

/** Seed a project's stage checklist from the template (once per stage). */
export async function seedChecklistFor(ownerId: string, projectId: string, stage: string): Promise<void> {
  const items = STAGE_TEMPLATES[stage];
  if (!items) return;
  const existing = (await db.execute(sql`
    SELECT count(*)::int AS n FROM me_checklist WHERE project_id = ${projectId}::uuid AND stage = ${stage}
  `)) as unknown as Array<{ n: number }>;
  if ((existing[0]?.n ?? 0) > 0) return;
  let pos = 0;
  for (const item of items) {
    await db.execute(sql`
      INSERT INTO me_checklist (owner_id, project_id, stage, item, position)
      VALUES (${ownerId}::uuid, ${projectId}::uuid, ${stage}, ${item}, ${pos++})
    `);
  }
}
