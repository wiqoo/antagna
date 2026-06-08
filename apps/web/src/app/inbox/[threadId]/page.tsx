import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db, withProfileScope } from '@antagna/db';
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
import { getEffectiveProfileId, canAny } from '@/lib/authz';
import {
  summarizeThreadAction,
  generateNextActionsAction,
  classifyThreadFormAction,
} from '../actions';

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
  category: string | null;
  importance: string | null;
  replyStatus: string | null;
  isUrgent: boolean | null;
  urgentReason: string | null;
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
  open: 'info',
  in_progress: 'warning',
  waiting_client: 'warning',
  closed: 'success',
  spam: 'danger',
};

const STATUS_AR: Record<string, string> = {
  new: 'جديد',
  open: 'مفتوح',
  in_progress: 'قيد المعالجة',
  awaiting_reply: 'بانتظار الردّ',
  waiting_client: 'بانتظار العميل',
  replied: 'تمّ الردّ',
  closed: 'مؤرشف',
  archived: 'أرشيف',
  spam: 'مخفي',
};

const CATEGORY_AR: Record<string, string> = {
  actionable: 'يحتاج إجراء',
  marketing: 'تسويق',
  newsletter: 'نشرة',
  notification: 'إشعار',
  spam: 'سبام',
};
const CATEGORY_TONE: Record<string, 'neutral' | 'info' | 'warning' | 'success' | 'danger'> = {
  actionable: 'info',
  marketing: 'neutral',
  newsletter: 'neutral',
  notification: 'neutral',
  spam: 'danger',
};
const IMPORTANCE_AR: Record<string, string> = {
  high: 'عالية',
  medium: 'متوسطة',
  low: 'منخفضة',
};
const IMPORTANCE_TONE: Record<string, 'neutral' | 'warning' | 'danger'> = {
  high: 'danger',
  medium: 'warning',
  low: 'neutral',
};

const REPLY_LABEL: Record<string, string> = {
  needs_reply: 'محتاج رد',
  no_reply_needed: 'لا يحتاج رد',
  awaiting_them: 'بانتظارهم',
  handled_off_channel: 'عولج بقناة أخرى',
};
const REPLY_TONE: Record<string, 'info' | 'neutral' | 'warning' | 'success'> = {
  needs_reply: 'warning',
  no_reply_needed: 'neutral',
  awaiting_them: 'info',
  handled_off_channel: 'success',
};

// Suggested actions are stored in two shapes: plain strings (from the manual
// "جدِّد" action) and {type, reason} objects (from the automatic worker pass).
// Normalize BOTH into a readable Arabic line so neither renders as
// "[object Object]".
const ACTION_LABEL: Record<string, string> = {
  reply: 'ردّ',
  follow_up: 'متابعة',
  create_lead: 'أنشئ فرصة',
  link_to_project: 'اربط بمشروع',
  create_task: 'أنشئ مهمة',
  create_project: 'أنشئ مشروع',
  escalate: 'تصعيد',
  archive: 'أرشفة',
  ignore: 'تجاهل',
};
function actionText(a: unknown): string {
  if (typeof a === 'string') return a;
  if (a && typeof a === 'object') {
    const o = a as { reason?: unknown; text?: unknown; action?: unknown; type?: unknown };
    const body = String(o.reason ?? o.text ?? o.action ?? '').trim();
    const label = typeof o.type === 'string' ? (ACTION_LABEL[o.type] ?? null) : null;
    if (body) return label ? `${label}: ${body}` : body;
    if (label) return label;
  }
  return String(a);
}

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

  // Read gate (D-037/D-039), mirrors the list page (apps/web/src/app/inbox/page.tsx):
  // either seeded comms read perm gets you in; no perm at all → /dashboard. The
  // row-level masking below (v_email_threads_safe WHERE) still applies regardless,
  // so read.assigned holders only resolve threads they're actually scoped to.
  const effectivePid = await getEffectiveProfileId();
  const canRead = await canAny([
    'email_threads.read.all',
    'email_threads.read.assigned',
  ]);
  if (!canRead) redirect('/dashboard');

  // Masked read: resolve the thread through v_email_threads_safe (row gate:
  // read.all OR read.assigned+assigned-to-thread/project) inside ONE
  // withProfileScope txn so current_effective_profile_id() resolves on the
  // pinned 6543 connection. Joined entities use their own safe views so their
  // column masks apply too. category/importance are triage metadata the safe
  // view omits — join the base email_threads row (already row-gated by the view
  // above, so no leak) just for those two non-masked classification columns.
  // If the safe view yields no row, the thread is either gone or not visible to
  // this actor → notFound() (no IDOR: we never touch raw email_threads to decide
  // visibility, and never load messages for an unconfirmed thread).
  const tR = await withProfileScope(effectivePid, (tx) =>
    tx.execute(sql`
      SELECT et.id::text AS id, et.subject, et.status::text AS status,
             et.message_count AS "messageCount",
             et.last_message_at AS "lastMessageAt",
             et.last_inbound_at AS "lastInboundAt",
             et.last_outbound_at AS "lastOutboundAt",
             et.ai_summary AS "aiSummary",
             et.ai_summary_updated_at AS "aiSummaryUpdatedAt",
             et.ai_topic_tags AS "aiTopicTags",
             tri.category AS "category",
             tri.importance AS "importance",
             tri.reply_status AS "replyStatus",
             tri.is_urgent AS "isUrgent",
             tri.urgent_reason AS "urgentReason",
             c.id::text AS "clientId", c.code AS "clientCode", c.name_ar AS "clientNameAr",
             ct.full_name AS "primaryContactName",
             p.id::text AS "projectId", p.code AS "projectCode",
             COALESCE(p.title_ar, p.title) AS "projectTitle",
             pf.display_name AS "assignedName"
      FROM v_email_threads_safe et
      JOIN email_threads tri ON tri.id = et.id
      LEFT JOIN v_clients_safe  c  ON c.id  = et.client_id
      LEFT JOIN v_contacts_safe ct ON ct.id = et.primary_contact_id
      LEFT JOIN v_projects_safe p  ON p.id  = et.project_id
      LEFT JOIN v_team_safe     pf ON pf.id = et.assigned_profile_id
      WHERE et.id = ${threadId}::uuid
      LIMIT 1`),
  );

  const thread = rows<Thread>(tR)[0];
  // Thread not visible via the safe view → don't leak its existence and, crucially,
  // never load its messages. Visibility is confirmed BEFORE the message read.
  if (!thread) notFound();

  // Only now that the safe view confirmed the thread is visible to this actor do
  // we load its raw messages. email_messages is not a masked entity, so we gate it
  // by reusing the already-confirmed thread.id (not the unvalidated route param).
  const mR = await db.execute(sql`
    SELECT id::text AS id, direction, from_email AS "fromEmail", from_name AS "fromName",
           to_emails AS "toEmails", subject, body_text AS "bodyText", snippet,
           attachment_count AS "attachmentCount",
           ai_summary AS "aiSummary", ai_suggested_actions AS "aiSuggestedActions",
           sent_at AS "sentAt"
    FROM email_messages
    WHERE thread_id = ${thread.id}::uuid
    ORDER BY sent_at ASC LIMIT 200`);

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
      suggestedActions = (a as unknown[])
        .map(actionText)
        .filter((s) => s && s !== '[object Object]')
        .slice(0, 6);
      break;
    }
  }

  // Newest-first for DISPLAY — when you open a thread you see the latest reply
  // first (matches the list's newest-first ordering + inbox triage flow). The
  // `messages` array stays chronological for the needs-reply + suggested-actions
  // logic above and is untouched by the AI pipeline (which queries separately).
  const messagesForDisplay = [...messages].reverse();

  // "Conversation with" — the external party/parties this thread is between
  // (inbound senders), most-recent first, de-duplicated by email.
  const externalParties = Array.from(
    new Map(
      messages
        .filter((m) => m.direction === 'inbound')
        .map((m) => [m.fromEmail, { name: m.fromName, email: m.fromEmail }]),
    ).values(),
  ).reverse();

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
            {thread.isUrgent && (
              <StatusPill tone="danger">
                ⚡ عاجل{thread.urgentReason ? ` · ${thread.urgentReason}` : ''}
              </StatusPill>
            )}
            {thread.replyStatus && REPLY_LABEL[thread.replyStatus] && (
              <StatusPill tone={REPLY_TONE[thread.replyStatus] ?? 'neutral'}>
                {REPLY_LABEL[thread.replyStatus]}
              </StatusPill>
            )}
            {thread.category && (
              <StatusPill tone={CATEGORY_TONE[thread.category] ?? 'neutral'}>
                {CATEGORY_AR[thread.category] ?? thread.category}
              </StatusPill>
            )}
            {thread.importance && (
              <StatusPill tone={IMPORTANCE_TONE[thread.importance] ?? 'neutral'}>
                أهمية {IMPORTANCE_AR[thread.importance] ?? thread.importance}
              </StatusPill>
            )}
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

      {/* Who the conversation is between — the external party/parties, shown simply */}
      {externalParties.length > 0 && (
        <div className="-mt-2 mb-2 flex flex-wrap items-center gap-2 text-[12px]">
          <span className="text-[var(--text-dim)]">محادثة مع</span>
          {externalParties.map((p, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1"
            >
              <span className="font-medium text-[var(--text)]">
                {p.name || p.email.split('@')[0]}
              </span>
              <span className="font-mono text-[10px] text-[var(--text-dim)]" dir="ltr">
                {p.email}
              </span>
            </span>
          ))}
        </div>
      )}

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
              <div className="flex items-center gap-2">
                <form action={classifyThreadFormAction.bind(null, thread.id)}>
                  <button
                    type="submit"
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--line)] px-3 text-[11px] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    <Sparkles size={12} /> صنِّف
                  </button>
                </form>
                <form action={summarizeThreadAction.bind(null, thread.id)}>
                  <button
                    type="submit"
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 text-[11px] font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/20"
                  >
                    <Sparkles size={12} /> لخّص الآن
                  </button>
                </form>
              </div>
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
                {messagesForDisplay.map((m) => {
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
                          <div
                            dir="auto"
                            className="mt-2 max-h-[440px] overflow-y-auto whitespace-pre-wrap rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)]/40 px-3.5 py-3 text-[13.5px] leading-[1.85] text-[var(--text)]"
                          >
                            {m.bodyText?.trim() || m.snippet || '(فارغة)'}
                          </div>
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
