import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { PageHeader, Card } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { ArrowLeft } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/authz';
import { createMeeting } from '../actions';
import { MeetingForm } from '../MeetingForm';

export const dynamic = 'force-dynamic';

const rows = <T,>(r: unknown): T[] => r as unknown as T[];

export default async function NewMeetingPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; clientId?: string; title?: string }>;
}) {
  // Page guard: signed-out → /login, lacking permission → /dashboard.
  await requirePermission('project.update');
  const sp = await searchParams;

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [projR, cliR] = await Promise.all([
    db.execute(sql`
      SELECT id::text AS id, code, COALESCE(title_ar, title) AS title
      FROM projects
      WHERE archived_at IS NULL
      ORDER BY created_at DESC
      LIMIT 300
    `),
    db.execute(sql`
      SELECT id::text AS id, name_ar AS name
      FROM clients
      WHERE archived_at IS NULL
      ORDER BY name_ar ASC
      LIMIT 300
    `),
  ]);

  const projectOptions = rows<{ id: string; code: string; title: string }>(projR).map((p) => ({
    id: p.id,
    label: `${p.code} · ${p.title}`,
  }));
  const clientOptions = rows<{ id: string; name: string }>(cliR).map((c) => ({
    id: c.id,
    label: c.name,
  }));

  return (
    <Shell user={{ email: user?.email ?? '' }} activePath="/meetings">
      <div className="mx-auto max-w-3xl space-y-8">
        <Link
          href="/meetings"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--accent)]"
        >
          <ArrowLeft size={14} className="rtl:rotate-180" /> محاضر الاجتماعات
        </Link>

        <PageHeader
          eyebrow="محضر جديد"
          title="تسجيل اجتماع"
          subtitle="العنوان مطلوب — البقية اختياري ويمكن تعديله لاحقاً."
        />

        <Card>
          <MeetingForm
            action={createMeeting}
            projectOptions={projectOptions}
            clientOptions={clientOptions}
            cancelHref="/meetings"
            submitLabel="إنشاء"
            initial={{
              meetingTitle: sp.title ?? '',
              projectId: sp.projectId ?? '',
              clientId: sp.clientId ?? '',
            }}
          />
        </Card>
      </div>
    </Shell>
  );
}
