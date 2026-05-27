import { redirect } from 'next/navigation';
import { PageHeader } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { SystemMap } from './system-map';

export const dynamic = 'force-dynamic';

export default async function SystemMapPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/system-map');

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/system-map">
      <PageHeader
        eyebrow="System Map"
        title="خريطة النظام"
        subtitle="الأقسام، تدفّق البيانات، الأتمتة، وربط الـ AI — رسم تفاعلي حي."
      />
      <SystemMap />
    </Shell>
  );
}
