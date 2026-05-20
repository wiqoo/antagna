'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql, eq } from 'drizzle-orm';
import { db, profiles } from '@antagna/db';
import { getSupabaseServerClient } from '@/lib/supabase/server';

async function withActor() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/admin');
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

export async function toggleAlertRule(ruleId: string) {
  await withActor();
  await db.execute(sql`
    UPDATE alert_rules SET active = NOT active, updated_at = now()
    WHERE id = ${ruleId}::uuid
  `);
  revalidatePath('/admin');
}

export async function updateAlertCooldown(formData: FormData) {
  await withActor();
  const ruleId = formData.get('ruleId')?.toString();
  const minutes = Number(formData.get('cooldownMinutes') ?? 60);
  if (!ruleId || Number.isNaN(minutes)) return;
  await db.execute(sql`
    UPDATE alert_rules
    SET cooldown_minutes = ${minutes}::int, updated_at = now()
    WHERE id = ${ruleId}::uuid
  `);
  revalidatePath('/admin');
}

export async function toggleKpi(key: string) {
  await withActor();
  await db.execute(sql`
    UPDATE kpi_definitions SET active = NOT active
    WHERE key = ${key}
  `);
  revalidatePath('/admin');
  revalidatePath('/kpis');
}
