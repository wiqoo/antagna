import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import {
  PageHeader,
  Card,
  CardHeader,
  StatusPill,
  EmptyState,
  Avatar,
} from '@antagna/ui';
import { Shell } from '@/components/Shell';
import {
  ArrowLeft,
  CalendarDays,
  Users,
  CheckSquare,
  ExternalLink,
  Pencil,
  FileText,
} from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { can } from '@/lib/authz';
import { ActionItems, type ActionItem } from './ActionItems';
import { deleteMeeting } from '../actions';

export const dynamic = 'force-dynamic';

const rows = <T,>(r: unknown): T[] => r as unknown as T[];

type Meeting = {
  id: string;
  source: string;
  meetingTitle: string | null;
  meetingDate: string | null;
  attendeesText: string | null;
  noteContent: string | null;
  driveUrl: string | null;
  aiActionItems: unknown;
  createdAt: string;
  projectId: string | null;
  projectCode: string | null;
  projectTitle: string | null;
  clientId: string | null;
  clientCode: string | null;
  clientNameAr: string | null;
};

const SOURCE_AR: Record<string, string> = {
  manual: 'يدوي',
  gemini: 'Gemini',
  transcription_other: 'تفريغ',
};

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

function parseAttendees(txt: string | null): string[] {
  if (!txt) return [];
  return txt
    .split(/[,،\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/meetings/${id}`);

  const [mR, canEdit] = await Promise.all([
    db.execute(sql`
      SELECT
        mn.id::text AS id,
        mn.source,
        mn.meeting_title AS "meetingTitle",
        mn.meeting_date AS "meetingDate",
        mn.attendees_text AS "attendeesText",
        mn.note_content AS "noteContent",
        mn.drive_url AS "driveUrl",
        mn.ai_action_items AS "aiActionItems",
        mn.created_at AS "createdAt",
        p.id::text AS "projectId",
        p.code AS "projectCode",
        COALESCE(p.title_ar, p.title) AS "projectTitle",
        c.id::text AS "clientId",
        c.code AS "clientCode",
        c.name_ar AS "clientNameAr"
      FROM meeting_notes mn
      LEFT JOIN projects p ON p.id = mn.project_id
      LEFT JOIN clients  c ON c.id = mn.client_id
      WHERE mn.id = ${id}::uuid
      LIMIT 1
    `),
    can('project.update'),
  ]);

  const meeting = rows<Meeting>(mR)[0];
  if (!meeting) notFound();

  const attendees = parseAttendees(meeting.attendeesText);
  const actionItems: ActionItem[] = Array.isArray(meeting.aiActionItems)
    ? (meeting.aiActionItems as unknown[]).map((x) => {
        if (typeof x === 'string') return { text: x, done: false };
        const o = (x ?? {}) as { text?: unknown; done?: unknown };
        return { text: String(o.text ?? ''), done: o.done === true };
      })
    : [];
  const openCount = actionItems.filter((a) => !a.done).length;

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/meetings">
      <Link
        href="/meetings"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
      >
        <ArrowLeft size={14} className="rtl:rotate-180" /> محاضر الاجتماعات
      </Link>

      <PageHeader
        eyebrow="محضر اجتماع"
        title={meeting.meetingTitle ?? '(بدون عنوان)'}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 font-mono" dir="ltr">
              <CalendarDays size={12} /> {fmtDateTime(meeting.meetingDate)}
            </span>
            {meeting.clientNameAr && <span>· {meeting.clientNameAr}</span>}
            {meeting.projectCode && meeting.projectId && (
              <span>· مشروع {meeting.projectCode}</span>
            )}
          </span>
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone="neutral">{SOURCE_AR[meeting.source] ?? meeting.source}</StatusPill>
            {canEdit && (
              <Link
                href={`/meetings/${meeting.id}/edit`}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--line)] px-3 text-[12px] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                <Pencil size={13} /> تعديل
              </Link>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Main: notes + action items */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <FileText size={14} className="text-[var(--text-dim)]" /> الملاحظات
                </span>
              }
            />
            {meeting.noteContent ? (
              <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--text-muted)]">
                {meeting.noteContent}
              </p>
            ) : (
              <p className="mt-3 text-[12px] text-[var(--text-dim)]">لا ملاحظات مسجَّلة.</p>
            )}
            {meeting.driveUrl && (
              <a
                href={meeting.driveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-[var(--line)] px-3 py-1.5 text-[12px] text-[var(--accent)] hover:border-[var(--accent)]"
                dir="ltr"
              >
                <ExternalLink size={12} /> فتح ملف / تسجيل
              </a>
            )}
          </Card>

          <Card>
            <div className="flex items-start justify-between gap-3">
              <CardHeader
                title={
                  <span className="inline-flex items-center gap-2">
                    <CheckSquare size={14} className="text-[var(--accent)]" /> المهام المتفق
                    عليها
                  </span>
                }
                subtitle={
                  actionItems.length > 0
                    ? `${openCount} مفتوحة من ${actionItems.length}`
                    : undefined
                }
              />
            </div>
            <div className="mt-3">
              <ActionItems meetingId={meeting.id} items={actionItems} canEdit={canEdit} />
            </div>
          </Card>
        </div>

        {/* Side: attendees + links */}
        <div className="space-y-4">
          <Card>
            <CardHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <Users size={14} className="text-[var(--text-dim)]" /> الحضور
                </span>
              }
              subtitle={attendees.length > 0 ? `${attendees.length} حاضر` : undefined}
            />
            {attendees.length === 0 ? (
              <p className="mt-3 text-[12px] text-[var(--text-dim)]">لم يُسجَّل الحضور.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {attendees.map((a, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-[13px] text-[var(--text)]">
                    <Avatar name={a} size="sm" />
                    <span className="truncate">{a}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="مرتبط بـ" />
            <dl className="mt-3 space-y-2 text-[13px]">
              <Row
                k="العميل"
                v={
                  meeting.clientId && meeting.clientNameAr ? (
                    <Link
                      href={`/clients/${meeting.clientId}`}
                      className="text-[var(--accent)] hover:underline"
                    >
                      {meeting.clientNameAr}
                    </Link>
                  ) : (
                    '—'
                  )
                }
              />
              <Row
                k="المشروع"
                v={
                  meeting.projectId && meeting.projectCode ? (
                    <Link
                      href={`/projects/${meeting.projectId}`}
                      className="font-mono text-[var(--accent)] hover:underline"
                    >
                      {meeting.projectCode}
                    </Link>
                  ) : (
                    '—'
                  )
                }
              />
              <Row k="سُجِّل في" v={fmtDateTime(meeting.createdAt)} mono />
            </dl>
          </Card>

          {canEdit && (
            <Card>
              <CardHeader title="منطقة الخطر" subtitle="حذف المحضر نهائياً" />
              <form action={deleteMeeting.bind(null, meeting.id)} className="mt-3">
                <button
                  type="submit"
                  className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-red-500/30 px-3 text-[12px] font-medium text-red-400 hover:bg-red-500/10"
                >
                  حذف المحضر
                </button>
              </form>
            </Card>
          )}
        </div>
      </div>

      {actionItems.length === 0 && !meeting.noteContent && attendees.length === 0 && (
        <Card>
          <EmptyState
            icon={<FileText size={20} />}
            title="محضر فارغ"
            description="لم تُضَف ملاحظات أو حضور أو مهام بعد. عدّل المحضر لإكماله."
          />
        </Card>
      )}
    </Shell>
  );
}

function Row({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[var(--text-dim)]">{k}</dt>
      <dd
        className={'text-[var(--text)] ' + (mono ? 'font-mono text-[11px]' : '')}
        dir={mono ? 'ltr' : undefined}
      >
        {v}
      </dd>
    </div>
  );
}
