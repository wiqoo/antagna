import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isNull } from 'drizzle-orm';
import { db, clients } from '@antagna/db';
import { PageHeader } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { ArrowLeft } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { commitBriefAsProject } from './actions';
import { BriefParseForm } from './parse-form';

export const dynamic = 'force-dynamic';

export default async function NewBriefPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/briefs/new');

  const clientList = await db
    .select({ id: clients.id, code: clients.code, nameAr: clients.nameAr })
    .from(clients)
    .where(isNull(clients.archivedAt))
    .orderBy(clients.nameAr);

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/projects">
      <div className="mx-auto max-w-3xl space-y-8">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
        >
          <ArrowLeft size={13} className="rtl:rotate-180" />
          المشاريع
        </Link>

        <PageHeader
          eyebrow="Brief Intake"
          title="برِيف جديد"
          subtitle="ألصق نص البرِيف من العميل. الذكاء الاصطناعي هيستخرج العنوان، نوع المشروع، التواريخ، الميزانية، والمواقع — وأنت تراجع وتعدّل قبل الإنشاء."
        />

        <BriefParseForm
          clients={clientList}
          commitAction={commitBriefAsProject}
        />
      </div>
    </Shell>
  );
}
