import Link from 'next/link';
import { redirect } from 'next/navigation';
import { desc, eq, sql } from 'drizzle-orm';
import {
  db,
  withProfileScope,
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
import { getEffectiveProfileId, canAny } from '@/lib/authz';
import { InboxThreads, type InboxThreadRow } from './InboxThreads';

export const dynamic = 'force-dynamic';

type ThreadQueryRow = {
  id: string;
  subject: string | null;
  status: string;
  category: string | null;
  importance: string | null;
  isUrgent: boolean | null;
  replyStatus: string | null;
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

  // Read gate (D-037/D-039). Inbox is core, so we branch on either seeded comms
  // read perm rather than a single hard requirePermission — this is the same
  // OR-gate the triage actions use (requireInboxActor), and keeps the 2 admins
  // (Claude QA / GM + Mohammed / production_director, both hold read.all) in.
  // No perm at all → /dashboard. The row-level masking still happens in the
  // v_email_threads_safe WHERE clause regardless (crew/freelancers see 0 rows).
  const effectivePid = await getEffectiveProfileId();
  const canRead = await canAny([
    'email_threads.read.all',
    'email_threads.read.assigned',
  ]);
  if (!canRead) redirect('/dashboard');

  const [threadsRaw, drafts, whatsapps, queueDepth] = await Promise.all([
    // Masked read: route the thread list through v_email_threads_safe (row gate:
    // read.all OR read.assigned+assigned-to-thread/project) inside ONE
    // withProfileScope txn so current_effective_profile_id() resolves on the
    // pinned 6543 connection. Joined entities use their own safe views so their
    // column masks apply too (leftJoin + null-guard → "—" in the UI). The two
    // LATERALs hit email_messages (not a masked entity) for the latest inbound
    // sender + ai_suggested_actions[0] — the query builder can't express these
    // cleanly, so we keep raw SQL, now scoped to the masking txn. Window of 200
    // so the client-side noise filter still leaves plenty of actionable threads.
    withProfileScope(effectivePid, (tx) =>
      tx.execute(sql`
        SELECT
          et.id::text AS "id",
          et.subject AS "subject",
          et.status::text AS "status",
          tri.category AS "category",
          tri.importance AS "importance",
          tri.is_urgent AS "isUrgent",
          tri.reply_status AS "replyStatus",
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
        FROM v_email_threads_safe et
        -- category/importance are triage metadata the safe view intentionally
        -- omits; join the base row (already row-gated by the view above, so no
        -- leak) just for those two non-masked classification columns the noise
        -- filter + importance hints rely on.
        JOIN email_threads tri ON tri.id = et.id
        LEFT JOIN v_clients_safe  c  ON c.id  = et.client_id
        LEFT JOIN v_contacts_safe ct ON ct.id = et.primary_contact_id
        LEFT JOIN v_team_safe     pf ON pf.id = et.assigned_profile_id
        LEFT JOIN v_projects_safe p  ON p.id  = et.project_id
        LEFT JOIN LATERAL (
          SELECT from_name, from_email
          FROM email_messages
          WHERE thread_id = et.id AND direction = 'inbound'
          ORDER BY sent_at DESC LIMIT 1
        ) inb ON true
        LEFT JOIN LATERAL (
          -- actions come in two shapes: plain strings or {type, reason} objects;
          -- prefer the object's reason, else the raw string element.
          SELECT COALESCE(
            ai_suggested_actions->0->>'reason',
            ai_suggested_actions->>0
          ) AS next_action
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
    ),
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
        senderName: whatsappMessages.senderName,
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
  const urgentCount = cleanThreads.filter((t) => t.isUrgent).length;

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
  if (urgentCount > 0) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: `${urgentCount} محادثة عاجلة — تحتاج إنجازاً خلال ساعة`,
      insight: 'صنّفها الـ AI كعاجلة (عميل غاضب / موعد قريب). افتحها فوراً.',
      urgent: true,
      actions: [{ label: 'افتح العاجلة', href: '#threads', primary: true }],
    });
  }
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
                      {/* Prefer a real name (matched contact/profile, else the
                          WhatsApp display name); only show the raw id when we
                          have nothing, and label hidden @lid numbers nicely. */}
                      {(() => {
                        const name =
                          w.matchedContactName ?? w.matchedProfileName ?? w.senderName;
                        const idLabel = w.fromE164?.startsWith('lid:')
                          ? 'رقم محجوب (LID)'
                          : w.fromE164;
                        return name ? (
                          <>
                            <span className="text-xs text-[var(--text-muted)]">{name}</span>
                            <span className="font-mono text-[10px] text-[var(--text-dim)]">
                              {idLabel}
                            </span>
                          </>
                        ) : (
                          <span className="font-mono text-xs text-[var(--text-dim)]">
                            {idLabel}
                          </span>
                        );
                      })()}
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
