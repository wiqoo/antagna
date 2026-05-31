import Link from 'next/link';
import { redirect } from 'next/navigation';
import { eq, isNull } from 'drizzle-orm';
import {
  db,
  clients,
  profiles,
} from '@antagna/db';
import { PageHeader } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { ArrowLeft } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/authz';
import { createProject } from './actions';
import { IntakeForm } from './intake-form';

export const dynamic = 'force-dynamic';

export default async function NewProjectPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/projects/new');

  // Page guard: creating a project is gated on project.create.
  await requirePermission('project.create');

  const [clientList, profileList] = await Promise.all([
    db
      .select({
        id: clients.id,
        code: clients.code,
        nameAr: clients.nameAr,
        isAgency: clients.isAgency,
      })
      .from(clients)
      .where(isNull(clients.archivedAt))
      .orderBy(clients.nameAr),
    db
      .select({
        id: profiles.id,
        displayName: profiles.displayName,
        positionKey: profiles.positionKey,
      })
      .from(profiles)
      .where(eq(profiles.status, 'active'))
      .orderBy(profiles.displayName),
  ]);

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/projects">
      <div className="mx-auto max-w-4xl space-y-8">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
        >
          <ArrowLeft size={13} className="rtl:rotate-180" />
          المشاريع
        </Link>

        <PageHeader
          eyebrow="Project Intake"
          title="مشروع جديد"
          subtitle="ألصق برِيف العميل في الأعلى والـ AI يملا الحقول — أو املأها يدوياً. ٢٢ حقل في ٤ أقسام يغطّوا كل تفاصيل الإنتاج."
        />

        <IntakeForm
          clients={clientList}
          profiles={profileList}
          commitAction={createProject}
        />
      </div>
    </Shell>
  );
}
