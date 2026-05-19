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
import { AppShell, StatusPill } from '@antagna/ui';
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
        lastInboundAt: emailThreads.lastInboundAt,
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
        scheduledFor: emailDrafts.scheduledFor,
        sentAt: emailDrafts.sentAt,
        createdAt: emailDrafts.createdAt,
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
        messageType: whatsappMessages.messageType,
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

  const awaitingReview = queueDepth.find((q) => q.status === 'awaiting_review')?.count ?? 0;
  const failed = queueDepth.find((q) => q.status === 'failed')?.count ?? 0;

  return (
    <AppShell user={{ email: user.email ?? '' }} activePath="/inbox">
      <div className="space-y-5">
        <header>
          <h1 className="text-xl font-semibold">Inbox</h1>
          <p className="text-sm text-neutral-500">
            {threads.length} thread · {whatsapps.length} WhatsApp · {drafts.length} draft
            {awaitingReview > 0 && (
              <>
                {' '}·{' '}
                <span className="text-yellow-500">
                  {awaitingReview} في انتظار الموافقة
                </span>
              </>
            )}
            {failed > 0 && (
              <>
                {' '}· <span className="text-red-500">{failed} فشل إرسال</span>
              </>
            )}
          </p>
        </header>

        <section>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
            البريد الإلكتروني — Threads
          </h2>
          <div className="overflow-hidden rounded-md border border-neutral-800">
            {threads.length === 0 ? (
              <div className="bg-neutral-950 px-3 py-6 text-center text-xs text-neutral-500">
                لا threads بعد. Gmail Pub/Sub watch لسه manual setup.
              </div>
            ) : (
              <ul className="divide-y divide-neutral-800 bg-neutral-950 text-sm">
                {threads.map((t) => (
                  <li key={t.id} className="px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span>{t.subject ?? '(بدون عنوان)'}</span>
                          <StatusPill tone={THREAD_STATUS_TONE[t.status] ?? 'neutral'}>
                            {t.status}
                          </StatusPill>
                        </div>
                        <div className="mt-0.5 text-xs text-neutral-500">
                          {t.clientNameAr ?? '—'}
                          {t.primaryContactName && (
                            <>
                              {' '}· <span>{t.primaryContactName}</span>
                            </>
                          )}
                          {t.projectCode && t.projectId && (
                            <>
                              {' '}·{' '}
                              <a
                                href={`/projects/${t.projectId}`}
                                className="font-mono text-yellow-500 hover:underline"
                              >
                                {t.projectCode}
                              </a>
                            </>
                          )}
                          {t.assignedName && (
                            <>
                              {' '}· <span>{t.assignedName}</span>
                            </>
                          )}
                          {' '}· {t.messageCount} msg
                        </div>
                        {t.aiSummary && (
                          <p className="mt-1 text-xs text-neutral-400">{t.aiSummary}</p>
                        )}
                      </div>
                      <div className="text-right font-mono text-xs text-neutral-500">
                        {t.lastMessageAt
                          ? new Date(t.lastMessageAt).toISOString().slice(0, 16).replace('T', ' ')
                          : '—'}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section>
            <h2 className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
              مسودات الإرسال
            </h2>
            <div className="overflow-hidden rounded-md border border-neutral-800">
              {drafts.length === 0 ? (
                <div className="bg-neutral-950 px-3 py-6 text-center text-xs text-neutral-500">
                  لا مسودات.
                </div>
              ) : (
                <ul className="divide-y divide-neutral-800 bg-neutral-950 text-sm">
                  {drafts.map((d) => (
                    <li key={d.id} className="flex items-start justify-between gap-3 px-3 py-2">
                      <div className="flex-1">
                        <div>{d.subject}</div>
                        <div className="text-xs text-neutral-500">
                          to:{' '}
                          <span className="font-mono">{(d.toEmails ?? []).join(', ')}</span>
                          {' '}from <span className="font-mono">{d.sendFromAlias}</span>
                          {d.authorName && <> · {d.authorName}</>}
                        </div>
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
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
              WhatsApp (آخر 10)
            </h2>
            <div className="overflow-hidden rounded-md border border-neutral-800">
              {whatsapps.length === 0 ? (
                <div className="bg-neutral-950 px-3 py-6 text-center text-xs text-neutral-500">
                  WhatsApp/Baileys لسه manual setup (Pillar 8 / D-023).
                </div>
              ) : (
                <ul className="divide-y divide-neutral-800 bg-neutral-950 text-sm">
                  {whatsapps.map((w) => (
                    <li key={w.id} className="px-3 py-2">
                      <div className="flex items-center justify-between text-xs text-neutral-500">
                        <span>
                          <StatusPill tone={w.direction === 'inbound' ? 'info' : 'success'}>
                            {w.direction}
                          </StatusPill>{' '}
                          <span className="font-mono">{w.fromE164}</span>
                          {(w.matchedContactName || w.matchedProfileName) && (
                            <> · {w.matchedContactName ?? w.matchedProfileName}</>
                          )}
                          {w.projectCode && (
                            <>
                              {' '}· <span className="font-mono">{w.projectCode}</span>
                            </>
                          )}
                        </span>
                        <span className="font-mono">
                          {new Date(w.receivedAt).toISOString().slice(0, 16).replace('T', ' ')}
                        </span>
                      </div>
                      {w.bodyText && (
                        <p className="mt-1 truncate text-sm text-neutral-300">{w.bodyText}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
