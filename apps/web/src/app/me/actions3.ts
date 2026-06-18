'use server';

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { requireOwner } from './auth';
import { runAssistant } from './assistant';
import { recordFeedback } from './brain';

/** Chat with the chief-of-staff (executes tools + answers). */
export async function sendAssistantMessage(formData: FormData): Promise<void> {
  const me = await requireOwner();
  const text = String(formData.get('message') ?? '').trim();
  if (!text) return;
  await runAssistant(me.profileId, text);
  revalidatePath('/me/assistant');
  revalidatePath('/me');
}

export async function clearAssistant(): Promise<void> {
  const me = await requireOwner();
  await db.execute(sql`DELETE FROM me_messages WHERE owner_id = ${me.profileId}::uuid`);
  revalidatePath('/me/assistant');
}

/** Teach the system — corrections become stored preferences fed back into context. */
export async function teach(formData: FormData): Promise<void> {
  const me = await requireOwner();
  const note = String(formData.get('note') ?? '').trim();
  const scope = String(formData.get('scope') ?? 'general');
  const signal = String(formData.get('signal') ?? 'note');
  if (!note) return;
  await recordFeedback(me.profileId, { scope, signal, note: note.slice(0, 400) });
  revalidatePath('/me/insights');
}

export async function dismissInsight(insightId: string): Promise<void> {
  const me = await requireOwner();
  await db.execute(sql`UPDATE me_insights SET dismissed = true WHERE id = ${insightId}::uuid AND owner_id = ${me.profileId}::uuid`);
  revalidatePath('/me/insights');
}
