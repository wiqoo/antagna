'use server';

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { requireOwner } from './auth';
import { refreshInsights, currentPeriod } from './insights-engine';
import { learnProfile } from './brain';
import { ensureAreas } from './areas';

export async function refreshInsightsAction(): Promise<void> {
  const me = await requireOwner();
  await ensureAreas(me.profileId);
  await refreshInsights(me.profileId);
  revalidatePath('/me/insights');
}

export async function selfRateArea(areaId: string, score: number): Promise<void> {
  const me = await requireOwner();
  const s = Math.max(0, Math.min(10, Math.round(score)));
  const period = currentPeriod();
  await db.execute(sql`
    INSERT INTO me_area_scores (owner_id, area_id, period, score, source)
    VALUES (${me.profileId}::uuid, ${areaId}::uuid, ${period}, ${s}, 'self')
    ON CONFLICT (owner_id, area_id, period, source) DO UPDATE SET score = EXCLUDED.score
  `);
  revalidatePath('/me/insights');
}

export async function learnNow(): Promise<void> {
  const me = await requireOwner();
  await learnProfile(me.profileId);
  revalidatePath('/me/insights');
}
