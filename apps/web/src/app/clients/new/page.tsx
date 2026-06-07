import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { PageHeader, Card } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { ArrowLeft, Network } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/authz';
import { NewClientForm } from './new-client-form';

export const dynamic = 'force-dynamic';

export default async function NewClientPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; leadId?: string; agencyId?: string }>;
}) {
  const sp = await searchParams;
  const prefillName = typeof sp.name === 'string' ? sp.name : '';
  const leadId = typeof sp.leadId === 'string' ? sp.leadId : '';
  const agencyId = typeof sp.agencyId === 'string' ? sp.agencyId : '';

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/clients/new');

  await requirePermission('client.create');

  // Agencies for the inline "under agency" picker + the locked-agency banner.
  const agencyRows = (await db.execute(sql`
    SELECT id::text AS id, name_ar AS "nameAr"
    FROM clients
    WHERE is_agency = true AND archived_at IS NULL
    ORDER BY name_ar LIMIT 100
  `)) as unknown as Array<{ id: string; nameAr: string | null }>;
  const agencyName = agencyId ? (agencyRows.find((a) => a.id === agencyId)?.nameAr ?? null) : null;

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/crm">
      <div className="mx-auto max-w-3xl space-y-8">
        <Link
          href="/crm"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--accent)]"
        >
          <ArrowLeft size={14} className="rtl:rotate-180" />
          العملاء
        </Link>

        <PageHeader
          eyebrow="عميل جديد"
          title="إضافة عميل"
          subtitle="اكتب الاسم واضغط «ابحث بالـ AI» ليملأ الباقي — أو املأ يدوياً. الأساسيات فقط مطلوبة."
        />

        {leadId && (
          <div className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 py-3 text-[13px] text-[var(--text)]">
            تحويل فرصة (lead) إلى عميل — أكمل البيانات وسيُربط الـ lead بالعميل الجديد تلقائياً.
          </div>
        )}

        {agencyId && (
          <div className="inline-flex items-center gap-2 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 py-3 text-[13px] text-[var(--text)]">
            <Network size={15} className="text-[var(--accent)]" />
            عميل نهائي تحت وكالة{agencyName ? `: ${agencyName}` : ''} — سيُربط بها تلقائياً.
          </div>
        )}

        <Card>
          <NewClientForm
            agencies={agencyRows}
            prefillName={prefillName}
            leadId={leadId}
            lockedAgencyId={agencyId}
          />
        </Card>
      </div>
    </Shell>
  );
}
