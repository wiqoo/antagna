import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { PageHeader, Card } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { ArrowLeft } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/authz';
import { updateMeeting } from '../../actions';
import { MeetingForm } from '../../MeetingForm';

export const dynamic = 'force-dynamic';

const rows = <T,>(r: unknown): T[] => r as unknown as T[];

type Row = {
  id: string;
  meetingTitle: string | null;
  meetingDate: string | null;
  attendeesText: string | null;
  noteContent: string | null;
  driveUrl: string | null;
  projectId: string | null;
  clientId: string | null;
  aiActionItems: unknown;
};

/** Build a datetime-local value (YYYY-MM-DDTHH:mm) from an ISO timestamp. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 16);
}

export default async function EditMeetingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requirePermission('project.update');

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [mR, projR, cliR] = await Promise.all([
    db.execute(sql`
      SELECT id::text AS id, meeting_title AS "meetingTitle", meeting_date AS "meetingDate",
             attendees_text AS "attendeesText", note_content AS "noteContent",
             drive_url AS "driveUrl", project_id::text AS "projectId",
             client_id::text AS "clientId", ai_action_items AS "aiActionItems"
      FROM meeting_notes WHERE id = ${id}::uuid LIMIT 1
    `),
    db.execute(sql`
      SELECT id::text AS id, code, COALESCE(title_ar, title) AS title
      FROM projects WHERE archived_at IS NULL ORDER BY created_at DESC LIMIT 300
    `),
    db.execute(sql`
      SELECT id::text AS id, name_ar AS name
      FROM clients WHERE archived_at IS NULL ORDER BY name_ar ASC LIMIT 300
    `),
  ]);

  const meeting = rows<Row>(mR)[0];
  if (!meeting) notFound();

  const projectOptions = rows<{ id: string; code: string; title: string }>(projR).map((p) => ({
    id: p.id,
    label: `${p.code} · ${p.title}`,
  }));
  const clientOptions = rows<{ id: string; name: string }>(cliR).map((c) => ({
    id: c.id,
    label: c.name,
  }));

  const actionItemsText = Array.isArray(meeting.aiActionItems)
    ? (meeting.aiActionItems as unknown[])
        .map((x) =>
          typeof x === 'string' ? x : String(((x ?? {}) as { text?: unknown }).text ?? ''),
        )
        .filter(Boolean)
        .join('\n')
    : '';

  return (
    <Shell user={{ email: user?.email ?? '' }} activePath="/meetings">
      <div className="mx-auto max-w-3xl space-y-8">
        <Link
          href={`/meetings/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--accent)]"
        >
          <ArrowLeft size={14} className="rtl:rotate-180" /> المحضر
        </Link>

        <PageHeader eyebrow="تعديل" title="تعديل محضر الاجتماع" subtitle="حدّث التفاصيل ثم احفظ." />

        <Card>
          <MeetingForm
            action={updateMeeting.bind(null, id)}
            projectOptions={projectOptions}
            clientOptions={clientOptions}
            cancelHref={`/meetings/${id}`}
            submitLabel="حفظ التعديلات"
            initial={{
              meetingTitle: meeting.meetingTitle,
              meetingDateLocal: toLocalInput(meeting.meetingDate),
              attendeesText: meeting.attendeesText,
              noteContent: meeting.noteContent,
              driveUrl: meeting.driveUrl,
              projectId: meeting.projectId,
              clientId: meeting.clientId,
              actionItemsText,
            }}
          />
        </Card>
      </div>
    </Shell>
  );
}
