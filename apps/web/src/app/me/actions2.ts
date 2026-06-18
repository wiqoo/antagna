'use server';

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { requireOwner } from './auth';
import { seedChecklistFor } from './lib';
import { todayRiyadh } from './data';

const str = (v: FormDataEntryValue | null, max = 2000): string | null => {
  const s = (v == null ? '' : String(v)).trim();
  return s ? s.slice(0, max) : null;
};
const intOr = (v: FormDataEntryValue | null, d: number): number => {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : d;
};

// ── waiting-on ───────────────────────────────────────────────────────────────
export async function addWaiting(formData: FormData): Promise<void> {
  const me = await requireOwner();
  const what = str(formData.get('what'), 300);
  if (!what) return;
  const fu = str(formData.get('follow_up_date'), 30);
  await db.execute(sql`
    INSERT INTO me_waiting (owner_id, what, who, follow_up_date)
    VALUES (${me.profileId}::uuid, ${what}, ${str(formData.get('who'), 120)}, ${fu ? sql`${fu}::date` : sql`NULL`})
  `);
  revalidatePath('/me/waiting');
}
export async function resolveWaiting(id: string): Promise<void> {
  const me = await requireOwner();
  await db.execute(sql`UPDATE me_waiting SET resolved = true, resolved_at = now() WHERE id = ${id}::uuid AND owner_id = ${me.profileId}::uuid`);
  revalidatePath('/me/waiting');
}

// ── recurring ────────────────────────────────────────────────────────────────
export async function addRecurring(formData: FormData): Promise<void> {
  const me = await requireOwner();
  const title = str(formData.get('title'), 200);
  if (!title) return;
  const cadence = ['daily', 'weekdays', 'weekly'].includes(String(formData.get('cadence'))) ? String(formData.get('cadence')) : 'daily';
  await db.execute(sql`
    INSERT INTO me_recurring (owner_id, title, cadence, weekday)
    VALUES (${me.profileId}::uuid, ${title}, ${cadence}, ${cadence === 'weekly' ? intOr(formData.get('weekday'), 0) : sql`NULL`})
  `);
  revalidatePath('/me/recurring');
}
export async function deleteRecurring(id: string): Promise<void> {
  const me = await requireOwner();
  await db.execute(sql`DELETE FROM me_recurring WHERE id = ${id}::uuid AND owner_id = ${me.profileId}::uuid`);
  revalidatePath('/me/recurring');
}

// ── checklists ───────────────────────────────────────────────────────────────
export async function seedChecklist(projectId: string, stage: string): Promise<void> {
  const me = await requireOwner();
  await seedChecklistFor(me.profileId, projectId, stage);
  revalidatePath(`/me/projects/${projectId}`);
}
export async function toggleChecklistItem(itemId: string, projectId: string): Promise<void> {
  const me = await requireOwner();
  await db.execute(sql`UPDATE me_checklist SET is_done = NOT is_done WHERE id = ${itemId}::uuid AND owner_id = ${me.profileId}::uuid`);
  revalidatePath(`/me/projects/${projectId}`);
}
export async function addChecklistItem(projectId: string, stage: string, formData: FormData): Promise<void> {
  const me = await requireOwner();
  const item = str(formData.get('item'), 200);
  if (!item) return;
  await db.execute(sql`INSERT INTO me_checklist (owner_id, project_id, stage, item) VALUES (${me.profileId}::uuid, ${projectId}::uuid, ${stage}, ${item})`);
  revalidatePath(`/me/projects/${projectId}`);
}

// ── deliverables ─────────────────────────────────────────────────────────────
export async function addDeliverable(projectId: string, formData: FormData): Promise<void> {
  const me = await requireOwner();
  const title = str(formData.get('title'), 200);
  if (!title) return;
  await db.execute(sql`
    INSERT INTO me_deliverables (owner_id, project_id, title, link)
    VALUES (${me.profileId}::uuid, ${projectId}::uuid, ${title}, ${str(formData.get('link'), 1000)})
  `);
  revalidatePath(`/me/projects/${projectId}`);
}
export async function setDeliverableStatus(id: string, projectId: string, status: string): Promise<void> {
  const me = await requireOwner();
  if (!['pending', 'approved', 'revisions'].includes(status)) return;
  await db.execute(sql`UPDATE me_deliverables SET status = ${status} WHERE id = ${id}::uuid AND owner_id = ${me.profileId}::uuid`);
  revalidatePath(`/me/projects/${projectId}`);
}

// ── notes ────────────────────────────────────────────────────────────────────
export async function addNote(formData: FormData): Promise<void> {
  const me = await requireOwner();
  const bodyTxt = str(formData.get('body'), 8000);
  if (!bodyTxt) return;
  await db.execute(sql`
    INSERT INTO me_notes (owner_id, title, body) VALUES (${me.profileId}::uuid, ${str(formData.get('title'), 200)}, ${bodyTxt})
  `);
  revalidatePath('/me/notes');
}
export async function deleteNote(id: string): Promise<void> {
  const me = await requireOwner();
  await db.execute(sql`DELETE FROM me_notes WHERE id = ${id}::uuid AND owner_id = ${me.profileId}::uuid`);
  revalidatePath('/me/notes');
}

// ── goals ────────────────────────────────────────────────────────────────────
export async function addGoal(formData: FormData): Promise<void> {
  const me = await requireOwner();
  const title = str(formData.get('title'), 200);
  if (!title) return;
  const td = str(formData.get('target_date'), 30);
  await db.execute(sql`
    INSERT INTO me_goals (owner_id, title, type, target_date)
    VALUES (${me.profileId}::uuid, ${title}, ${String(formData.get('type')) === 'career' ? 'career' : 'personal'}, ${td ? sql`${td}::date` : sql`NULL`})
  `);
  revalidatePath('/me/growth');
}
export async function setGoalProgress(id: string, progress: number): Promise<void> {
  const me = await requireOwner();
  const p = Math.max(0, Math.min(100, progress));
  await db.execute(sql`UPDATE me_goals SET progress = ${p}, status = ${p >= 100 ? 'done' : 'active'} WHERE id = ${id}::uuid AND owner_id = ${me.profileId}::uuid`);
  revalidatePath('/me/growth');
}

// ── habits ───────────────────────────────────────────────────────────────────
export async function addHabit(formData: FormData): Promise<void> {
  const me = await requireOwner();
  const title = str(formData.get('title'), 200);
  if (!title) return;
  await db.execute(sql`INSERT INTO me_habits (owner_id, title) VALUES (${me.profileId}::uuid, ${title})`);
  revalidatePath('/me/growth');
  revalidatePath('/me');
}
export async function toggleHabitToday(habitId: string, day: string): Promise<void> {
  const me = await requireOwner();
  const existing = (await db.execute(sql`SELECT 1 FROM me_habit_logs WHERE habit_id = ${habitId}::uuid AND log_date = ${day}::date`)) as unknown as unknown[];
  if (existing.length) {
    await db.execute(sql`DELETE FROM me_habit_logs WHERE habit_id = ${habitId}::uuid AND log_date = ${day}::date`);
  } else {
    await db.execute(sql`INSERT INTO me_habit_logs (habit_id, owner_id, log_date) VALUES (${habitId}::uuid, ${me.profileId}::uuid, ${day}::date) ON CONFLICT DO NOTHING`);
  }
  revalidatePath('/me/growth');
  revalidatePath('/me');
}
export async function deleteHabit(id: string): Promise<void> {
  const me = await requireOwner();
  await db.execute(sql`DELETE FROM me_habits WHERE id = ${id}::uuid AND owner_id = ${me.profileId}::uuid`);
  revalidatePath('/me/growth');
}

// ── time logs ────────────────────────────────────────────────────────────────
export async function logTime(formData: FormData): Promise<void> {
  const me = await requireOwner();
  const minutes = intOr(formData.get('minutes'), 0);
  if (minutes <= 0) return;
  await db.execute(sql`
    INSERT INTO me_time_logs (owner_id, project_id, minutes, note)
    VALUES (${me.profileId}::uuid, ${str(formData.get('project_id'), 40) ? sql`${String(formData.get('project_id'))}::uuid` : sql`NULL`}, ${minutes}, ${str(formData.get('note'), 200)})
  `);
  revalidatePath('/me/growth');
}

// ── weekly review ────────────────────────────────────────────────────────────
export async function saveWeeklyReview(formData: FormData): Promise<void> {
  const me = await requireOwner();
  const content = {
    done: str(formData.get('done'), 2000),
    stalled: str(formData.get('stalled'), 2000),
    lesson: str(formData.get('lesson'), 2000),
    next: str(formData.get('next'), 2000),
  };
  await db.execute(sql`
    INSERT INTO me_reviews (owner_id, type, review_date, content)
    VALUES (${me.profileId}::uuid, 'weekly', ${todayRiyadh()}::date, ${JSON.stringify(content)}::jsonb)
    ON CONFLICT (owner_id, type, review_date) DO UPDATE SET content = EXCLUDED.content
  `);
  revalidatePath('/me/review');
}
