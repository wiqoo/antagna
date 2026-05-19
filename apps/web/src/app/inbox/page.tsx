import { redirect } from 'next/navigation';
import { desc, eq, sql } from 'drizzle-orm';
import {
  db,
  emailThreads,
  emailDrafts,
  whatsappMessages,
  clients,
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
  Avatar,
} from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { Mail, MessageCircle, Send } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const THREAD_STATUS_TONE: Record<
  string,
  'info' | 'warning' | 'danger' | 'success' | 'neutral'
> = {
  open: 'info',
  in_progress: 'warning',
  waiting_client: 'warning',
  closed: 'success',
  spam: 'danger',
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

  const [threads, drafts, whatsapps, queueDepth] = await Promise.all([
    db
      .select({
        id: emailThreads.id,
        subject: emailThreads.subject,
        status: emailThreads.status,
        messageCount: emailThreads.messageCount,
        lastMessageAt: emailThreads.lastMessageAt,
        aiSummary: emailThreads.aiSummary,
        clientNameAr: clients.nameAr,
        primaryContactName: contacts.fullName,
        assignedName: profiles.displayName,
        projectCode: projects.code,
        projectId: projects.id,
      })
      .from(emailThreads)
      .leftJoin(clients, eq(clients.id, emailThreads.clientId))
      .leftJoin(contacts, eq(contacts.id, emailThreads.primaryContactId))
      .leftJoin(profiles, eq(profiles.id, emailThreads.assignedProfileId))
      .leftJoin(projects, eq(projects.id, emailThreads.projectId))
      .orderBy(desc(emailThreads.lastMessageAt))
      .limit(30),
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

  const awaitingReview =
    queueDepth.find((q) => q.status === 'awaiting_review')?.count ?? 0;
  const failed = queueDepth.find((q) => q.status === 'failed')?.count ?? 0;

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/inbox">
      <PageHeader
        eyebrow="Inbox"
        title="الوارد"
        subtitle={
          <>
            {threads.length} thread · {whatsapps.length} WhatsApp · {drafts.length}{' '}
            draft
            {awaitingReview > 0 && (
              <span className="ms-2 text-[--accent]">
                · {awaitingReview} في انتظار الموافقة
              </span>
            )}
            {failed > 0 && (
              <span className="ms-2 text-red-400">· {failed} فشل إرسال</span>
            )}
          </>
        }
      />

      {/* Threads */}
      <Card padded={false}>
        <div className="p-6 pb-4">
          <CardHeader
            title="البريد الإلكتروني"
            subtitle="آخر 30 thread"
            action={
              <span className="inline-flex items-center gap-1 text-xs text-[--text-dim]">
                <Mail size={12} />
                {threads.length}
              </span>
            }
          />
        </div>
        {threads.length === 0 ? (
          <EmptyState
            icon={<Mail size={20} />}
            title="لا threads بعد"
            description="Gmail Pub/Sub watch لسه manual setup. لما يتفعّل هتظهر الـ threads هنا."
          />
        ) : (
          <ul className="divide-y divide-[--line]">
            {threads.map((t) => (
              <li
                key={t.id}
                className="flex items-start gap-3 px-6 py-3.5 hover:bg-[--surface-hover]"
              >
                <Avatar name={t.clientNameAr ?? t.primaryContactName ?? '?'} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-[--text]">
                      {t.subject ?? '(بدون عنوان)'}
                    </p>
                    <StatusPill tone={THREAD_STATUS_TONE[t.status] ?? 'neutral'}>
                      {t.status}
                    </StatusPill>
                  </div>
                  <p className="mt-0.5 text-xs text-[--text-muted]">
                    {t.clientNameAr ?? '—'}
                    {t.primaryContactName && <> · {t.primaryContactName}</>}
                    {t.projectCode && t.projectId && (
                      <>
                        {' '}·{' '}
                        <a
                          href={`/projects/${t.projectId}`}
                          className="font-mono text-[--accent] hover:underline"
                        >
                          {t.projectCode}
                        </a>
                      </>
                    )}
                    {t.assignedName && <> · {t.assignedName}</>}{' '}
                    · {t.messageCount} msg
                  </p>
                  {t.aiSummary && (
                    <p className="mt-1 text-xs text-[--text]">{t.aiSummary}</p>
                  )}
                </div>
                <div className="font-mono text-[10px] text-[--text-dim]">
                  {t.lastMessageAt
                    ? new Date(t.lastMessageAt)
                        .toISOString()
                        .slice(0, 16)
                        .replace('T', ' ')
                    : '—'}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card padded={false}>
          <div className="p-6 pb-4">
            <CardHeader
              title="مسودات الإرسال"
              subtitle="في الـ queue"
              action={<Send size={12} className="text-[--text-dim]" />}
            />
          </div>
          {drafts.length === 0 ? (
            <EmptyState
              icon={<Send size={20} />}
              title="لا مسودات"
              description="هتظهر هنا لما يبدأ الـ AI يبعت مسودات أو يبعتها أحد المستخدمين."
            />
          ) : (
            <ul className="divide-y divide-[--line]">
              {drafts.map((d) => (
                <li
                  key={d.id}
                  className="flex items-start gap-3 px-6 py-3 hover:bg-[--surface-hover]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[--text]">
                      {d.subject}
                    </p>
                    <p className="mt-0.5 text-xs text-[--text-muted]">
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
              action={<MessageCircle size={12} className="text-[--text-dim]" />}
            />
          </div>
          {whatsapps.length === 0 ? (
            <EmptyState
              icon={<MessageCircle size={20} />}
              title="WhatsApp لسه manual setup"
              description="هيشتغل عبر Baileys self-hosted (D-023) بعد إعداد الـ VPS."
            />
          ) : (
            <ul className="divide-y divide-[--line]">
              {whatsapps.map((w) => (
                <li key={w.id} className="px-6 py-3 hover:bg-[--surface-hover]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <StatusPill
                        tone={w.direction === 'inbound' ? 'info' : 'success'}
                      >
                        {w.direction}
                      </StatusPill>
                      <span className="font-mono text-xs text-[--text-dim]">
                        {w.fromE164}
                      </span>
                      {(w.matchedContactName || w.matchedProfileName) && (
                        <span className="text-xs text-[--text-muted]">
                          · {w.matchedContactName ?? w.matchedProfileName}
                        </span>
                      )}
                      {w.projectCode && (
                        <span className="font-mono text-xs text-[--accent]">
                          {w.projectCode}
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[10px] text-[--text-dim]">
                      {new Date(w.receivedAt)
                        .toISOString()
                        .slice(0, 16)
                        .replace('T', ' ')}
                    </span>
                  </div>
                  {w.bodyText && (
                    <p className="mt-1 truncate text-sm text-[--text]">
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
