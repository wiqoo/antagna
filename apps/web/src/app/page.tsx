import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, profiles } from '@antagna/db';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { roleLanding } from '@/lib/role-landing';

export const dynamic = 'force-dynamic';

export default async function RootPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [p] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.authUserId, user.id))
    .limit(1);

  redirect(roleLanding(p?.role));
}
