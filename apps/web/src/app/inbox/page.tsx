import Link from 'next/link';
import { redirect } from 'next/navigation';
import { desc, eq, sql } from 'drizzle-orm';
import {
  db,
  emailDrafts,
  whatsappMessages,
  contacts,
  profiles,
  projects,
} from '@antagna/db';
import {

  PageHeader,
  Card,
  CardHeader,
  StatusPill,
  EmptyState,
  AIHints,
  type AIHint,
} from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { Mail, MessageCircle, Send } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { InboxThreads, type InboxThreadRow } from './InboxThreads';

export const dynamic = 'force-dynamic';

type ThreadQueryRow = {
  id: string;
  subject: string | null;
  status: string;
  category: string | null;
  importance: string | null;
  messageCount: number | null;
  lastMessageAt: string | null;
  aiSummary: string | null;
  clientNameAr: string | null;
  primaryContactName: string | null;
  assignedName: string | null;
  projectCode: string | null;
  projectId: string | null;
  fromName: string | null;
  fromEmail: string | null;
  nextAction: string | null;
};

const DRAFT_STATUS_TONE: Record<
  string,
  'info' | 'warning' | 'danger' | 'success' | 'neutral'
> = {
  draft: 'neutral',
  awaiting_review: 'warning',
  approved: 'info',
  queued: 'info',
  sent: 'success',
  failed: 'danger',
  cancelled: 'neutral',
};

export default async function InboxPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/inbox');

  const [threadsRaw, drafts, whatsapps, queueDepth] = await Promise.all([
    // Raw SQL: we need the latest inbound message's sender + the latest
    // message's ai_suggested_actions[0] as the "next action", which the query
    // builder can't express cleanly. Pull a generous window (200) so the
    // client-side noise filter still leaves plenty of actionable threads.
    db.execute(sql`
      SELECT
        et.id::text AS "id",
        et.subject AS "subject",
        et.status::text AS "status",
        et.category AS "category",
        et.importance AS "importance",
        et.message_count AS "messageCount",
        et.last_message_at AS "lastMessageAt",
        et.ai_summary AS "aiSummary",
        c.name_ar AS "clientNameAr",
        ct.full_name AS "primaryContactName",
        pf.display_name AS "assignedName",
        p.code AS "projectCode",
        p.id::text AS "projectId",
        inb.from_name AS "fromName",
        inb.from_email AS "fromEmail",
        na.next_action AS "nextAction"
      FROM email_threads et
      LEFT JOIN clients  c  ON c.id  = et.client_id
      LEFT JOIN contacts ct ON ct.id = et.primary_contact_id
      LEFT JOIN profiles pf ON pf.id = et.assigned_profile_id
      LEFT JOIN projects p  ON p.id  = et.project_id
      LEFT JOIN LATERAL (
        SELECT from_name, from_email
        FROM email_messages
        WHERE thread_id = et.id AND direction = 'inbound'
        ORDER BY sent_at DESC LIMIT 1
      ) inb ON true
      LEFT JOIN LATERAL (
        SELECT (ai_suggested_actions->>0) AS next_action
        FROM email_messages
        WHERE thread_id = et.id
          AND ai_suggested_actions IS NOT NULL
          AND jsonb_typeof(ai_suggested_actions) = 'array'
          AND jsonb_array_length(ai_suggested_actions) > 0
        ORDER BY sent_at DESC LIMIT 1
      ) na ON true
      ORDER BY et.last_message_at DESC NULLS LAST
      LIMIT 200
    `),
    db
      .select({
        id: emailDrafts.id,
        subject: emailDrafts.subject,
        status: emailDrafts.status,
        toEmails: emailDrafts.toEmails,
        sendFromAlias: emailDrafts.sendFromAlias,
        sendError: emailDrafts.sendError,
        authorName: profiles.displayName,
      })
      .from(emailDrafts)
      .leftJoin(profiles, eq(profiles.id, emailDrafts.authorProfileId))
      .orderBy(desc(emailDrafts.createdAt))
      .limit(15),
    db
      .select({
        id: whatsappMessages.id,
        direction: whatsappMessages.direction,
        fromE164: whatsappMessages.fromE164,
        bodyText: whatsappMessages.bodyText,
        receivedAt: whatsappMessages.receivedAt,
        matchedContactName: contacts.fullName,
        matchedProfileName: profiles.displayName,
        projectCode: projects.code,
      })
      .from(whatsappMessages)
      .leftJoin(contacts, eq(contacts.id, whatsappMessages.matchedContactId))
      .leftJoin(profiles, eq(profiles.id, whatsappMessages.matchedProfileId))
      .leftJoin(projects, eq(projects.id, whatsappMessages.projectId))
      .orderBy(desc(whatsappMessages.receivedAt))
      .limit(10),
    db
      .select({
        status: emailDrafts.status,
        count: sql<number>`count(*)::int`,
      })
      .from(emailDrafts)
      .groupBy(emailDrafts.status),
  ]);

  const threads = threadsRaw as unknown as ThreadQueryRow[];

  const threadRows: InboxThreadRow[] = threads.map((t) => ({
    id: t.id,
    subject: t.subject,
    status: t.status,
    category: t.category,
    importance: t.importance,
    messageCount: t.messageCount,
    lastMessageAt: t.lastMessageAt ? new Date(t.lastMessageAt).toISOString() : null,
    aiSummary: t.aiSummary,
    nextAction: t.nextAction,
    clientNameAr: t.clientNameAr,
    primaryContactName: t.primaryContactName,
    fromName: t.fromName,
    fromEmail: t.fromEmail,
    assignedName: t.assignedName,
    projectCode: t.projectCode,
    projectId: t.projectId,
  }));

  const NOISE = new Set(['marketing', 'newsletter', 'spam']);
  const isNoise = (t: ThreadQueryRow) =>
    t.status === 'spam' || (t.category != null && NOISE.has(t.category));
  const cleanThreads = threads.filter((t) => !isNoise(t));
  const noiseCount = threads.length - cleanThreads.length;
  const unclassified = threads.filter((t) => t.category == null).length;
  const highImportance = cleanThreads.filter((t) => t.importance === 'high').length;

  const awaitingReview =
    queueDepth.find((q) => q.status === 'awaiting_review')?.count ?? 0;
  const failed = queueDepth.find((q) => q.status === 'failed')?.count ?? 0;

  const openThreads = cleanThreads.filter((t) => t.status === 'open');
  const waitingClientThreads = cleanThreads.filter((t) => t.status === 'waiting_client').length;
  const oldOpen = openThreads.filter((t) => {
    if (!t.lastMessageAt) return false;
    return Date.now() - new Date(t.lastMessageAt).getTime() > 3 * 86_400_000;
  });

  const hints: AIHint[] = [];
  if (awaitingReview > 0) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: `${awaitingReview} draft في انتظار موافقتك للإرسال`,
      insight: 'Claude اقترح صياغات — راجعها وأرسل أو عدّل.',
      urgent: true,
      actions: [{ label: 'افتح الـ drafts', href: '#drafts', primary: true }],
    });
  }
  if (failed > 0) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: `${failed} رسالة فشل إرسالها`,
      insight: 'تحقق من السبب وأعد المحاولة.',
      urgent: true,
      actions: [{ label: 'اعرض الفاشلة', href: '#drafts', primary: true }],
    });
  }
  if (unclassified > 0 && hints.length < 3) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: `${unclassified} محادثة غير مُصنَّفة`,
      insight: 'شغّل "صنِّف بالـ AI" ليفرز الوارد ويخفي التسويق والسبام تلقائياً.',
      actions: [{ label: 'اذهب للوارد', href: '#threads', primary: true }],
    });
  }
  if (highImportance > 0 && hints.length < 3) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: `${highImportance} محادثة عالية الأهمية تحتاج انتباهك`,
      insight: 'صنّفها الـ AI كأولوية — افتحها أولاً.',
      urgent: true,
      actions: [{ label: 'افتحها', href: '#threads', primary: true }],
    });
  }
  if (oldOpen.length > 0 && hints.length < 3) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: `${oldOpen.length} thread مفتوح بدون رد ٣+ أيام`,
      insight: 'متابعة أو أغلق المحادثة.',
      actions: [{ label: 'افتح القديمة', href: '#threads' }],
    });
  }

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/inbox">
      {hints.length > 0 && (
        <AIHints
          context="Antagna AI · الوارد"
          headline={`${cleanThreads.length} يحتاج انتباهك · ${noiseCount} ضوضاء مخفية`}
          hints={hints}
          compact
        />
      )}
      <PageHeader
        eyebrow="Inbox"
        title="الوارد"
        subtitle={
          <>
            {cleanThreads.length} يحتاج انتباهك · {noiseCount} ضوضاء مخفية ·{' '}
            {whatsapps.length} WhatsApp · {drafts.length} draft
            {highImportance > 0 && (
              <span className="ms-2 text-[var(--danger)]">
                · {highImportance} عالية الأهمية
              </span>
            )}
            {awaitingReview > 0 && (
              <span className="ms-2 text-[var(--accent)]">
                · {awaitingReview} في انتظار الموافقة
              </span>
            )}
            {failed > 0 && (
              <span className="ms-2 text-red-400">· {failed} فشل إرسال</span>
            )}
          </>
        }
      />

      {/* Threads — AI-triaged workspace */}
      <Card padded={false}>
        <div id="threads" className="p-6 pb-4">
          <CardHeader
            title="البريد — مفروز بالـ AI"
            subtitle="مُصنَّف تلقائياً · الضوضاء مخفية افتراضياً"
            action={
              <span className="inline-flex items-center gap-1 text-xs text-[var(--text-dim)]">
                <Mail size={12} />
                {cleanThreads.length}
              </span>
            }
          />
        </div>
        <div className="px-6 pb-6">
          <InboxThreads rows={threadRows} />
        </div>
      </Card>

      <div id="drafts" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card padded={false}>
          <div className="p-6 pb-4">
            <CardHeader
              title="مسودات الإرسال"
              subtitle="في الـ queue"
              action={<Send size={12} className="text-[var(--text-dim)]" />}
            />
          </div>
          {drafts.length === 0 ? (
            <EmptyState
              icon={<Send size={20} />}
              title="لا مسودات"
              description="ستظهر هنا عندما يبدأ الذكاء الاصطناعي يرسل مسودات أو يرسلها أحد المستخدمين."
            />
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {drafts.map((d) => (
                <li
                  key={d.id}
                  className="flex items-start gap-3 px-6 py-3 hover:bg-[var(--surface-hover)]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--text)]">
                      {d.subject}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      to:{' '}
                      <span className="font-mono">
                        {(d.toEmails ?? []).join(', ')}
                      </span>
                      {d.authorName && <> · {d.authorName}</>}
                    </p>
                    {d.sendError && (
                      <p className="mt-1 text-xs text-red-400">⚠ {d.sendError}</p>
                    )}
                  </div>
                  <StatusPill tone={DRAFT_STATUS_TONE[d.status] ?? 'neutral'}>
                    {d.status}
                  </StatusPill>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card padded={false}>
          <div className="p-6 pb-4">
            <CardHeader
              title="WhatsApp"
              subtitle="آخر 10 رسائل"
              action={
                <Link
                  href="/whatsapp"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent)] hover:underline"
                >
                  <MessageCircle size={12} /> كل المحادثات
                </Link>
              }
            />
          </div>
          {whatsapps.length === 0 ? (
            <EmptyState
              icon={<MessageCircle size={20} />}
              title="لا رسائل WhatsApp بعد"
              description="ستظهر هنا فور وصول أول رسالة على خط Volt."
            />
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {whatsapps.map((w) => (
                <li key={w.id} className="px-6 py-3 hover:bg-[var(--surface-hover)]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <StatusPill
                        tone={w.direction === 'inbound' ? 'info' : 'success'}
                      >
                        {w.direction}
                      </StatusPill>
                      <span className="font-mono text-xs text-[var(--text-dim)]">
                        {w.fromE164}
                      </span>
                      {(w.matchedContactName || w.matchedProfileName) && (
                        <span className="text-xs text-[var(--text-muted)]">
                          · {w.matchedContactName ?? w.matchedProfileName}
                        </span>
                      )}
                      {w.projectCode && (
                        <span className="font-mono text-xs text-[var(--accent)]">
                          {w.projectCode}
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[10px] text-[var(--text-dim)]">
                      {new Date(w.receivedAt)
                        .toISOString()
                        .slice(0, 16)
                        .replace('T', ' ')}
                    </span>
                  </div>
                  {w.bodyText && (
                    <p className="mt-1 truncate text-sm text-[var(--text)]">
                      {w.bodyText}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </Shell>
  );
}
