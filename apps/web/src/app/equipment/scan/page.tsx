import { redirect } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { PageHeader } from '@antagna/ui';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { ScannerClient } from './scanner-client';

export const dynamic = 'force-dynamic';

export default async function EquipmentScanPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/equipment/scan');

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/equipment">
      <PageHeader
        eyebrow="مسح QR"
        title="مسح ملصق المعدة"
        subtitle="وجِّه الكاميرا نحو ملصق QR ليفتح صفحة المعدة تلقائياً."
      />
      <ScannerClient />
    </Shell>
  );
}
