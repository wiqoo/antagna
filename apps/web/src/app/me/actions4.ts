'use server';

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { requireOwner } from './auth';
import { generateDayPlan } from './planner';
import { todayRiyadh } from './data';

const str = (v: FormDataEntryValue | null, max = 200): string | null => {
  const s = (v == null ? '' : String(v)).trim();
  return s ? s.slice(0, max) : null;
};

const EVENT_KINDS = ['shoot', 'meeting', 'deep', 'admin', 'personal', 'event', 'block'];

export async function createEvent(formData: FormData): Promise<void> {
  const me = await requireOwner();
  const title = str(formData.get('title'), 160);
  const date = str(formData.get('date'), 12);
  if (!title || !date) return;
  const time = str(formData.get('time'), 5);
  const endTime = str(formData.get('end_time'), 5);
  const kind = EVENT_KINDS.includes(String(formData.get('kind'))) ? String(formData.get('kind')) : 'event';
  const location = str(formData.get('location'), 160);
  const startTs = time ? sql`(${date + ' ' + time})::timestamp AT TIME ZONE 'Asia/Riyadh'` : sql`(${date})::date AT TIME ZONE 'Asia/Riyadh'`;
  const endTs = time && endTime ? sql`(${date + ' ' + endTime})::timestamp AT TIME ZONE 'Asia/Riyadh'` : sql`NULL`;
  await db.execute(sql`
    INSERT INTO me_events (owner_id, title, kind, start_at, end_at, all_day, location, source)
    VALUES (${me.profileId}::uuid, ${title}, ${kind}, ${startTs}, ${endTs}, ${!time}, ${location}, 'manual')
  `);
  revalidatePath('/me/calendar');
  revalidatePath('/me');
}

export async function deleteEvent(eventId: string): Promise<void> {
  const me = await requireOwner();
  await db.execute(sql`DELETE FROM me_events WHERE id = ${eventId}::uuid AND owner_id = ${me.profileId}::uuid`);
  revalidatePath('/me/calendar');
  revalidatePath('/me');
}

export async function planDay(formData: FormData): Promise<void> {
  const me = await requireOwner();
  const date = str(formData.get('date'), 12) ?? todayRiyadh();
  await generateDayPlan(me.profileId, date);
  revalidatePath('/me');
  revalidatePath('/me/calendar');
}
