import Link from 'next/link';
import { redirect } from 'next/navigation';
import { eq, isNull, asc } from 'drizzle-orm';
import {
  db,
  clients,
  profiles,
  projectTemplates,
} from '@antagna/db';
import { PageHeader } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { ArrowLeft } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { createProject } from './actions';
import { IntakeForm } from './intake-form';

export const dynamic = 'force-dynamic';

export default async function NewProjectPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/projects/new');

  const [clientList, profileList, templateList] = await Promise.all([
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
      .select({ id: profiles.id, displayName: profiles.displayName })
      .from(profiles)
      .where(eq(profiles.status, 'active'))
      .orderBy(profiles.displayName),
    db
      .select({
        id: projectTemplates.id,
        nameAr: projectTemplates.nameAr,
        nameEn: projectTemplates.nameEn,
        useCount: projectTemplates.useCount,
      })
      .from(projectTemplates)
      .where(eq(projectTemplates.active, true))
      .orderBy(asc(projectTemplates.nameAr)),
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
          templates={templateList}
          commitAction={createProject}
        />
      </div>
    </Shell>
  );
}
