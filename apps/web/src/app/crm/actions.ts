'use server';

import { revalidatePath } from 'next/cache';
import { sql, eq } from 'drizzle-orm';
import { db, profiles } from '@antagna/db';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { writeActivity } from '@/lib/activity';

const LEAD_STATUSES = [
  'new',
  'qualified',
  'nurturing',
  'proposal_sent',
  'won',
  'lost',
  'ghosted',
];

const LEAD_STATUS_AR: Record<string, string> = {
  new: 'جديد',
  qualified: 'مؤهّل',
  nurturing: 'رعاية',
  proposal_sent: 'عرض مُرسَل',
  won: 'مكسوب',
  lost: 'مفقود',
  ghosted: 'متجاهَل',
};

async function actorId(): Promise<string | null> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const [a] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.authUserId, user.id))
    .limit(1);
  if (a) {
    await db.execute(sql`SELECT set_config('app.acting_as', ${a.id}, true)`);
  }
  return a?.id ?? null;
}

/** Move a lead through the funnel. Writes activity so the brain + timeline see it. */
export async function updateLeadStatus(
  leadId: string,
  nextStatus: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!LEAD_STATUSES.includes(nextStatus)) return { ok: false, error: 'invalid status' };
  const aid = await actorId();

  await db.execute(sql`
    UPDATE leads SET status = ${nextStatus}::lead_status, updated_at = now()
    WHERE id = ${leadId}::uuid
  `);

  await writeActivity({
    actorId: aid,
    entityType: 'lead',
    entityId: leadId,
    action: 'lead_status',
    summaryAr: `تغيّرت حالة الفرصة إلى «${LEAD_STATUS_AR[nextStatus] ?? nextStatus}»`,
    summaryEn: `Lead status → ${nextStatus}`,
    metadata: { status: nextStatus },
  });

  revalidatePath('/crm');
  return { ok: true };
}
