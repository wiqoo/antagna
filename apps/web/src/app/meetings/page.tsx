import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import {
  PageHeader,
  Card,
  CardHeader,
  StatBox,
  EmptyState,
} from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { CalendarDays, Plus, CheckSquare, Users } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { can } from '@/lib/authz';
import { MeetingsList, type MeetingRow } from './MeetingsList';

export const dynamic = 'force-dynamic';

const rows = <T,>(r: unknown): T[] => r as unknown as T[];

type RawRow = {
  id: string;
  meetingTitle: string | null;
  meetingDate: string | null;
  attendeesText: string | null;
  noteContent: string | null;
  source: string;
  projectId: string | null;
  projectCode: string | null;
  projectTitle: string | null;
  clientId: string | null;
  clientNameAr: string | null;
  actionItemCount: number;
  openActionItemCount: number;
};

export default async function MeetingsPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/meetings');

  const [listR, canCreate] = await Promise.all([
    db.execute(sql`
      SELECT
        mn.id::text AS id,
        mn.meeting_title AS "meetingTitle",
        mn.meeting_date AS "meetingDate",
        mn.attendees_text AS "attendeesText",
        mn.note_content AS "noteContent",
        mn.source AS source,
        p.id::text AS "projectId",
        p.code AS "projectCode",
        COALESCE(p.title_ar, p.title) AS "projectTitle",
        c.id::text AS "clientId",
        c.name_ar AS "clientNameAr",
        COALESCE(jsonb_array_length(
          CASE WHEN jsonb_typeof(mn.ai_action_items) = 'array' THEN mn.ai_action_items ELSE '[]'::jsonb END
        ), 0) AS "actionItemCount",
        COALESCE((
          SELECT count(*)::int FROM jsonb_array_elements(
            CASE WHEN jsonb_typeof(mn.ai_action_items) = 'array' THEN mn.ai_action_items ELSE '[]'::jsonb END
          ) AS x
          WHERE COALESCE((x->>'done')::boolean, false) = false
        ), 0) AS "openActionItemCount"
      FROM meeting_notes mn
      LEFT JOIN projects p ON p.id = mn.project_id
      LEFT JOIN clients  c ON c.id = mn.client_id
      ORDER BY mn.meeting_date DESC NULLS LAST, mn.created_at DESC
      LIMIT 500
    `),
    can('project.update'),
  ]);

  const raw = rows<RawRow>(listR);
  const list: MeetingRow[] = raw.map((r) => ({
    id: r.id,
    meetingTitle: r.meetingTitle,
    meetingDate: r.meetingDate ? new Date(r.meetingDate).toISOString() : null,
    attendeesText: r.attendeesText,
    noteContent: r.noteContent,
    source: r.source,
    projectId: r.projectId,
    projectCode: r.projectCode,
    projectTitle: r.projectTitle,
    clientId: r.clientId,
    clientNameAr: r.clientNameAr,
    actionItemCount: Number(r.actionItemCount ?? 0),
    openActionItemCount: Number(r.openActionItemCount ?? 0),
  }));

  const total = list.length;
  const withActions = list.filter((m) => m.openActionItemCount > 0).length;
  const totalOpenActions = list.reduce((s, m) => s + m.openActionItemCount, 0);
  const upcomingOrRecent = list.filter((m) => {
    if (!m.meetingDate) return false;
    const days = (Date.now() - new Date(m.meetingDate).getTime()) / 86_400_000;
    return days >= -30 && days <= 7;
  }).length;

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/meetings">
      <PageHeader
        eyebrow="Meetings"
        title="محاضر الاجتماعات"
        subtitle={`${total} محضر · ${totalOpenActions} مهمة مفتوحة`}
        action={
          canCreate ? (
            <Link
              href="/meetings/new"
              className="magnet inline-flex h-9 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)]"
            >
              <Plus size={14} /> محضر جديد
            </Link>
          ) : undefined
        }
      />

      {total === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarDays size={22} />}
            title="لا محاضر اجتماعات بعد"
            description="سجّل أول محضر اجتماع — العنوان والتاريخ والملاحظات والحضور والمهام المتفق عليها. تُربط بمشروع أو عميل وتدخل ذاكرة الشركة."
            action={
              canCreate ? (
                <Link
                  href="/meetings/new"
                  className="magnet inline-flex h-9 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)]"
                >
                  <Plus size={14} /> محضر جديد
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatBox label="إجمالي المحاضر" value={total} icon={<CalendarDays size={16} />} />
            <StatBox label="آخر 30 يوم" value={upcomingOrRecent} icon={<CalendarDays size={16} />} />
            <StatBox label="فيها مهام مفتوحة" value={withActions} icon={<CheckSquare size={16} />} />
            <StatBox label="مهام مفتوحة" value={totalOpenActions} icon={<Users size={16} />} />
          </div>

          <Card padded={false}>
            <div className="p-6 pb-4">
              <CardHeader title="كل المحاضر" subtitle={`${total} محضر`} />
            </div>
            <div className="px-6 pb-6">
              <MeetingsList rows={list} />
            </div>
          </Card>
        </>
      )}
    </Shell>
  );
}
