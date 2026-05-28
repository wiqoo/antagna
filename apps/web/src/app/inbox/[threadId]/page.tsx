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
  Mail,
  Sparkles,
  Clock,
  CheckCircle2,
  ArrowDownRight,
  ArrowUpRight,
  Paperclip,
} from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { summarizeThreadAction, generateNextActionsAction } from '../actions';

export const dynamic = 'force-dynamic';

const rows = <T,>(r: unknown): T[] => r as unknown as T[];

type Thread = {
  id: string;
  subject: string | null;
  status: string;
  messageCount: number;
  lastMessageAt: string | null;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  aiSummary: string | null;
  aiSummaryUpdatedAt: string | null;
  aiTopicTags: string[] | null;
  clientId: string | null;
  clientCode: string | null;
  clientNameAr: string | null;
  primaryContactName: string | null;
  projectId: string | null;
  projectCode: string | null;
  projectTitle: string | null;
  assignedName: string | null;
};

type Msg = {
  id: string;
  direction: string;
  fromEmail: string;
  fromName: string | null;
  toEmails: string[] | null;
  subject: string | null;
  bodyText: string | null;
  snippet: string | null;
  attachmentCount: number;
  aiSummary: string | null;
  aiSuggestedActions: unknown;
  sentAt: string;
};

const STATUS_TONE: Record<string, 'neutral' | 'info' | 'warning' | 'success' | 'danger'> = {
  new: 'info',
  in_progress: 'warning',
  awaiting_reply: 'warning',
  replied: 'success',
  archived: 'neutral',
  spam: 'danger',
};

const STATUS_AR: Record<string, string> = {
  new: 'جديد',
  in_progress: 'قيد المعالجة',
  awaiting_reply: 'بانتظار الردّ',
  replied: 'تمّ الردّ',
  archived: 'أرشيف',
  spam: 'سبام',
};

export default async function InboxThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/inbox/${threadId}`);

  const [tR, mR] = await Promise.all([
    db.execute(sql`
      SELECT et.id::text AS id, et.subject, et.status::text AS status,
             et.message_count AS "messageCount",
             et.last_message_at AS "lastMessageAt",
             et.last_inbound_at AS "lastInboundAt",
             et.last_outbound_at AS "lastOutboundAt",
             et.ai_summary AS "aiSummary",
             et.ai_summary_updated_at AS "aiSummaryUpdatedAt",
             et.ai_topic_tags AS "aiTopicTags",
             c.id::text AS "clientId", c.code AS "clientCode", c.name_ar AS "clientNameAr",
             ct.full_name AS "primaryContactName",
             p.id::text AS "projectId", p.code AS "projectCode",
             COALESCE(p.title_ar, p.title) AS "projectTitle",
             pf.display_name AS "assignedName"
      FROM email_threads et
      LEFT JOIN clients  c  ON c.id  = et.client_id
      LEFT JOIN contacts ct ON ct.id = et.primary_contact_id
      LEFT JOIN projects p  ON p.id  = et.project_id
      LEFT JOIN profiles pf ON pf.id = et.assigned_profile_id
      WHERE et.id = ${threadId}::uuid
      LIMIT 1`),
    db.execute(sql`
      SELECT id::text AS id, direction, from_email AS "fromEmail", from_name AS "fromName",
             to_emails AS "toEmails", subject, body_text AS "bodyText", snippet,
             attachment_count AS "attachmentCount",
             ai_summary AS "aiSummary", ai_suggested_actions AS "aiSuggestedActions",
             sent_at AS "sentAt"
      FROM email_messages
      WHERE thread_id = ${threadId}::uuid
      ORDER BY sent_at ASC LIMIT 200`),
  ]);

  const thread = rows<Thread>(tR)[0];
  if (!thread) notFound();
  const messages = rows<Msg>(mR);

  // "Needs reply" = last message was inbound and hasn't been answered.
  const needsReply =
    !!thread.lastInboundAt &&
    (!thread.lastOutboundAt || thread.lastInboundAt > thread.lastOutboundAt);

  // Pick suggested actions to surface — prefer the latest message's list,
  // fall back to any earlier message that produced suggestions.
  let suggestedActions: string[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const a = messages[i]?.aiSuggestedActions;
    if (Array.isArray(a) && a.length > 0) {
      suggestedActions = (a as unknown[]).map(String).slice(0, 6);
      break;
    }
  }

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/inbox">
      <Link
        href="/inbox"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
      >
        <ArrowLeft size={14} className="rtl:rotate-180" /> الوارد
      </Link>

      <PageHeader
        eyebrow="بريد إلكتروني · محادثة"
        title={thread.subject ?? '(بدون عنوان)'}
        subtitle={`${thread.messageCount} رسالة${thread.clientNameAr ? ` · ${thread.clientNameAr}` : ''}${thread.projectCode && thread.projectId ? ` · مشروع ${thread.projectCode}` : ''}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={STATUS_TONE[thread.status] ?? 'neutral'}>
              {STATUS_AR[thread.status] ?? thread.status}
            </StatusPill>
            {needsReply && (
              <StatusPill tone="warning">
                <Clock size={11} /> بانتظار الردّ منك
              </StatusPill>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left/main: AI brain + messages */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <div className="flex items-start justify-between gap-3">
              <CardHeader
                title={
                  <span className="inline-flex items-center gap-2">
                    <Sparkles size={14} className="text-[var(--accent)]" /> ملخّص AI
                  </span>
                }
                subtitle={
                  thread.aiSummaryUpdatedAt
                    ? `محدَّث ${new Date(thread.aiSummaryUpdatedAt).toISOString().slice(0, 16).replace('T', ' ')}`
                    : 'لم يُلخَّص بعد'
                }
              />
              <form action={summarizeThreadAction.bind(null, thread.id)}>
                <button
                  type="submit"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 text-[11px] font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/20"
                >
                  <Sparkles size={12} /> لخّص الآن
                </button>
              </form>
            </div>
            {thread.aiSummary ? (
              <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--text-muted)]">
                {thread.aiSummary}
              </p>
            ) : (
              <p className="mt-3 text-[12px] text-[var(--text-dim)]">
                لا يوجد ملخص بعد. اضغط "لخّص الآن" ليُولِّد الـ AI ملخصاً للمحادثة.
              </p>
            )}
            {thread.aiTopicTags && thread.aiTopicTags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[var(--line)] pt-3">
                {thread.aiTopicTags.map((tag, i) => (
                  <span
                    key={i}
                    className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </Card>

          {/* AI next-action suggestions */}
          <Card>
            <div className="flex items-start justify-between gap-3">
              <CardHeader
                title={
                  <span className="inline-flex items-center gap-2">
                    <Sparkles size={14} className="text-[var(--accent)]" /> اقتراح AI
                    للخطوة التالية
                  </span>
                }
                subtitle="نصائح من سياق المحادثة + ذاكرة الشركة"
              />
              <form action={generateNextActionsAction.bind(null, thread.id)}>
                <button
                  type="submit"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--line)] px-3 text-[11px] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  جدِّد
                </button>
              </form>
            </div>
            {suggestedActions.length === 0 ? (
              <p className="mt-3 text-[12px] text-[var(--text-dim)]">
                لا اقتراحات بعد. اضغط "جدِّد" لاستخراج خطوات تالية مقترَحة.
              </p>
            ) : (
              <ol className="mt-3 space-y-2">
                {suggestedActions.map((a, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 rounded-md border border-[var(--accent)]/15 bg-[var(--accent)]/[0.04] p-2.5 text-[13px] leading-relaxed text-[var(--text)]"
                  >
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/20 font-mono text-[10px] font-semibold text-[var(--accent)]">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span>{a}</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          {/* Conversation */}
          <Card padded={false}>
            <div className="p-6 pb-4">
              <CardHeader
                title="المحادثة"
                subtitle={`${messages.length} من ${thread.messageCount}`}
              />
            </div>
            {messages.length === 0 ? (
              <EmptyState icon={<Mail size={20} />} title="لا رسائل" description="لم تُجلَب الرسائل بعد." />
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {messages.map((m) => {
                  const outbound = m.direction === 'outbound';
                  const fromLabel = m.fromName || m.fromEmail.split('@')[0];
                  return (
                    <li key={m.id} className="px-6 py-4">
                      <div className="flex items-start gap-3">
                        <Avatar name={fromLabel ?? '?'} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={
                                'inline-flex items-center gap-1 text-[11px] font-semibold ' +
                                (outbound ? 'text-[var(--success)]' : 'text-[var(--accent)]')
                              }
                            >
                              {outbound ? (
                                <ArrowUpRight size={11} />
                              ) : (
                                <ArrowDownRight size={11} />
                              )}
                              {outbound ? 'صادر' : 'وارد'}
                            </span>
                            <span className="text-[13px] font-medium text-[var(--text)]">
                              {fromLabel}
                            </span>
                            <span className="font-mono text-[10px] text-[var(--text-dim)]" dir="ltr">
                              {m.fromEmail}
                            </span>
                            <span className="ms-auto font-mono text-[10px] text-[var(--text-dim)]" dir="ltr">
                              {new Date(m.sentAt).toISOString().slice(0, 16).replace('T', ' ')}
                            </span>
                          </div>
                          {m.aiSummary && (
                            <p className="mt-2 rounded-md border border-[var(--accent)]/15 bg-[var(--accent)]/[0.04] px-2.5 py-1.5 text-[11px] italic text-[var(--text-muted)]">
                              <Sparkles size={9} className="inline" /> {m.aiSummary}
                            </p>
                          )}
                          <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--text-muted)]">
                            {m.bodyText?.slice(0, 1200) || m.snippet || '(فارغة)'}
                            {(m.bodyText?.length ?? 0) > 1200 && (
                              <span className="text-[var(--text-dim)]">… (مقتطعة)</span>
                            )}
                          </p>
                          {m.attachmentCount > 0 && (
                            <p className="mt-2 inline-flex items-center gap-1 text-[10px] text-[var(--text-dim)]">
                              <Paperclip size={10} /> {m.attachmentCount} مرفق
                            </p>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        {/* Right column: meta + follow-up */}
        <div className="space-y-4">
          <Card>
            <CardHeader title="المراسلات" subtitle="جهة الاتصال + الإسناد" />
            <dl className="mt-3 space-y-2 text-[13px]">
              <Row k="العميل" v={thread.clientNameAr ?? '—'} />
              <Row k="جهة الاتصال" v={thread.primaryContactName ?? '—'} />
              <Row
                k="المشروع"
                v={
                  thread.projectId && thread.projectCode ? (
                    <Link
                      href={`/projects/${thread.projectId}`}
                      className="font-mono text-[var(--accent)] hover:underline"
                    >
                      {thread.projectCode}
                    </Link>
                  ) : (
                    '—'
                  )
                }
              />
              <Row k="مسؤول" v={thread.assignedName ?? '—'} />
            </dl>
          </Card>

          <Card>
            <CardHeader title="حالة المتابعة" />
            <dl className="mt-3 space-y-2 text-[12px]">
              <Row
                k="آخر وارد"
                v={
                  thread.lastInboundAt
                    ? new Date(thread.lastInboundAt).toISOString().slice(0, 16).replace('T', ' ')
                    : '—'
                }
                mono
              />
              <Row
                k="آخر صادر"
                v={
                  thread.lastOutboundAt
                    ? new Date(thread.lastOutboundAt).toISOString().slice(0, 16).replace('T', ' ')
                    : '—'
                }
                mono
              />
            </dl>
            <p
              className={
                'mt-3 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium ' +
                (needsReply
                  ? 'bg-[var(--warning)]/10 text-[var(--warning)]'
                  : 'bg-[var(--success)]/10 text-[var(--success)]')
              }
            >
              {needsReply ? (
                <>
                  <Clock size={11} /> بانتظار ردّك
                </>
              ) : (
                <>
                  <CheckCircle2 size={11} /> الحالة محدَّثة
                </>
              )}
            </p>
          </Card>
        </div>
      </div>
    </Shell>
  );
}

function Row({
  k,
  v,
  mono,
}: {
  k: string;
  v: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[var(--text-dim)]">{k}</dt>
      <dd className={'text-[var(--text)] ' + (mono ? 'font-mono text-[11px]' : '')} dir={mono ? 'ltr' : undefined}>
        {v}
      </dd>
    </div>
  );
}
