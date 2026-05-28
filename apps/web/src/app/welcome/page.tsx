import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, profiles, userSkills } from '@antagna/db';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { WelcomeFlow } from './welcome-flow';

export const dynamic = 'force-dynamic';

export default async function WelcomePage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/welcome');

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.authUserId, user.id))
    .limit(1);

  if (!profile) redirect('/login?next=/welcome');

  // If already done, send them to dashboard. (They can still revisit
  // /welcome explicitly if they really want to — no guard there.)
  const state = (profile.onboardingState ?? {}) as { status?: string };
  if (state.status === 'completed' || state.status === 'skipped') {
    redirect('/dashboard');
  }

  const caps = await db
    .select({
      key: userSkills.skillKey,
      isPrimary: userSkills.isPrimary,
      proficiency: userSkills.proficiency,
    })
    .from(userSkills)
    .where(eq(userSkills.profileId, profile.id));

  // Friendly labels for known capability keys (Arabic).
  const capLabels: Record<string, string> = {
    production_manager: 'مدير إنتاج',
    project_manager: 'مدير مشروع',
    account_manager: 'مدير حساب',
    director: 'مخرج',
    shooter: 'مصور',
    editor: 'مونتير',
    ai_specialist: 'متخصص AI',
    equipment_manager: 'مسؤول معدات',
    procurement: 'مشتريات',
    talent: 'موهبة',
    approver: 'مصدّق',
    trainee: 'متدرب',
    hr: 'موارد بشرية',
    accounting: 'محاسبة',
  };

  return (
    <WelcomeFlow
      profile={{
        displayName: profile.displayName,
        displayNameEn: profile.displayNameEn,
        email: profile.email,
        role: profile.role,
        uiLanguage: profile.uiLanguage,
      }}
      capabilities={caps.map((c) => ({
        key: c.key,
        label: capLabels[c.key] ?? c.key,
        isPrimary: c.isPrimary,
        proficiency: c.proficiency,
      }))}
    />
  );
}
