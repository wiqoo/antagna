'use server';

import { revalidatePath } from 'next/cache';
import { db, profiles } from '@antagna/db';
import { eq, sql } from 'drizzle-orm';
import { getSupabaseServerClient } from '@/lib/supabase/server';

async function getMyProfileId(): Promise<string | null> {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [row] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.authUserId, user.id))
    .limit(1);
  return row?.id ?? null;
}

export async function completeOnboarding() {
  const id = await getMyProfileId();
  if (!id) throw new Error('unauthorized');
  await db
    .update(profiles)
    .set({
      onboardingState: sql`jsonb_build_object(
        'status', 'completed',
        'steps_done', '["welcome","profile","preferences"]'::jsonb,
        'completed_at', now()
      )`,
    })
    .where(eq(profiles.id, id));
  revalidatePath('/', 'layout');
}

export async function skipOnboarding() {
  const id = await getMyProfileId();
  if (!id) throw new Error('unauthorized');
  await db
    .update(profiles)
    .set({
      onboardingState: sql`jsonb_build_object(
        'status', 'skipped',
        'steps_done', '[]'::jsonb,
        'skipped_at', now()
      )`,
    })
    .where(eq(profiles.id, id));
  revalidatePath('/', 'layout');
}
