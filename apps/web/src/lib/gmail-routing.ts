/**
 * Email-thread routing & linking — runs after AI summarization.
 *
 * For each freshly-summarized thread:
 *  1. Status from AI category — marketing/spam/notification/automated → 'closed'
 *     so they don't pollute "needs reply" views.
 *  2. Link to a client — by exact contact_methods email match (highest signal),
 *     then by clients.website_url domain match (heuristic).
 *  3. Evaluate active inbound_email_routes in `position` order — first match
 *     applies (assign_to_profile_id, set_status, create_lead_if_new).
 *  4. Auto-create a lead — if AI says category:business AND no client linked
 *     AND no lead exists for this thread yet.
 *
 * Idempotent: re-running won't duplicate links or leads.
 */
import {
  db,
  emailThreads,
  emailMessages,
  contactMethods,
  contacts,
  clients,
  leads,
  inboundEmailRoutes,
} from '@antagna/db';
import { eq, and, sql, isNull, asc } from 'drizzle-orm';

const AUTO_CLOSE_CATEGORIES = new Set([
  'category:marketing',
  'category:spam',
  'category:notification',
  'category:automated',
]);

export interface RoutingApplied {
  threadId: string;
  statusSet?: string;
  clientLinked?: string;
  contactLinked?: string;
  routeMatched?: string;
  leadCreated?: string;
}

export async function applyRoutingAndLinking(
  threadId: string,
): Promise<RoutingApplied> {
  const applied: RoutingApplied = { threadId };

  const [thread] = await db
    .select()
    .from(emailThreads)
    .where(eq(emailThreads.id, threadId))
    .limit(1);
  if (!thread) return applied;

  const tags = thread.aiTopicTags ?? [];

  // First inbound message — used for from_email/from_name and lead creation.
  const [firstInbound] = await db
    .select({
      id: emailMessages.id,
      gmailMessageId: emailMessages.gmailMessageId,
      fromEmail: emailMessages.fromEmail,
      fromName: emailMessages.fromName,
    })
    .from(emailMessages)
    .where(
      and(eq(emailMessages.threadId, threadId), eq(emailMessages.direction, 'inbound')),
    )
    .orderBy(asc(emailMessages.sentAt))
    .limit(1);

  // ── 1. Auto-close based on AI category ──────────────────────────────────
  const shouldAutoClose = tags.some((t) => AUTO_CLOSE_CATEGORIES.has(t));
  if (shouldAutoClose && thread.status === 'open') {
    await db
      .update(emailThreads)
      .set({ status: 'closed', updatedAt: sql`now()` })
      .where(eq(emailThreads.id, threadId));
    applied.statusSet = 'closed';
  }

  // ── 2. Link to client/contact via from_email ────────────────────────────
  if (!thread.clientId && firstInbound?.fromEmail) {
    const normalized = firstInbound.fromEmail.trim().toLowerCase();

    // Try exact contact_methods match first.
    const [methodMatch] = await db
      .select({ contactId: contactMethods.contactId, clientId: contacts.clientId })
      .from(contactMethods)
      .innerJoin(contacts, eq(contacts.id, contactMethods.contactId))
      .where(
        and(
          eq(contactMethods.methodType, 'email'),
          eq(contactMethods.normalizedValue, normalized),
        ),
      )
      .limit(1);

    if (methodMatch) {
      await db
        .update(emailThreads)
        .set({
          clientId: methodMatch.clientId,
          primaryContactId: methodMatch.contactId,
          updatedAt: sql`now()`,
        })
        .where(eq(emailThreads.id, threadId));
      applied.clientLinked = methodMatch.clientId;
      applied.contactLinked = methodMatch.contactId;
    } else {
      // Fallback: domain match against clients.website_url.
      const domain = extractDomain(normalized);
      if (domain) {
        const [clientMatch] = await db
          .select({ id: clients.id })
          .from(clients)
          .where(
            and(
              isNull(clients.archivedAt),
              sql`lower(${clients.websiteUrl}) LIKE ${'%' + domain + '%'}`,
            ),
          )
          .limit(1);
        if (clientMatch) {
          await db
            .update(emailThreads)
            .set({ clientId: clientMatch.id, updatedAt: sql`now()` })
            .where(eq(emailThreads.id, threadId));
          applied.clientLinked = clientMatch.id;
        }
      }
    }
  }

  // ── 3. Evaluate inbound_email_routes ────────────────────────────────────
  if (firstInbound?.fromEmail) {
    const fromEmail = firstInbound.fromEmail.toLowerCase();
    const domain = extractDomain(fromEmail);
    const subject = (thread.subject ?? '').toLowerCase();

    const routes = await db
      .select()
      .from(inboundEmailRoutes)
      .where(eq(inboundEmailRoutes.active, true))
      .orderBy(asc(inboundEmailRoutes.position));

    for (const route of routes) {
      let matched = true;
      if (route.matchFromContains) {
        matched =
          matched && fromEmail.includes(route.matchFromContains.toLowerCase());
      }
      if (route.matchDomain) {
        matched = matched && domain === route.matchDomain.toLowerCase();
      }
      if (route.matchSubjectRegex) {
        try {
          matched = matched && new RegExp(route.matchSubjectRegex, 'i').test(subject);
        } catch {
          matched = false; // bad regex in DB
        }
      }
      // match_to_contains skipped — the To: of our inbound is always us.

      if (matched) {
        const updates: Record<string, unknown> = { updatedAt: sql`now()` };
        if (route.assignToProfileId) updates.assignedProfileId = route.assignToProfileId;
        if (route.setStatus) updates.status = route.setStatus;
        if (Object.keys(updates).length > 1) {
          await db
            .update(emailThreads)
            .set(updates)
            .where(eq(emailThreads.id, threadId));
        }
        applied.routeMatched = route.id;
        break; // first match wins
      }
    }
  }

  // ── 4. Auto-create lead if business + unlinked + no existing lead ───────
  const isBusiness = tags.includes('category:business');
  if (
    isBusiness &&
    !applied.clientLinked &&
    !thread.clientId &&
    !thread.leadId &&
    firstInbound
  ) {
    // Check if a lead already exists for this thread's gmail id.
    const [existingLead] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(eq(leads.inboundThreadId, thread.gmailThreadId))
      .limit(1);

    if (!existingLead) {
      const [newLead] = await db
        .insert(leads)
        .values({
          // code has a DB-side default (fn_next_lead_code()); Drizzle's type
          // doesn't know about it, so emit the SQL default explicitly.
          code: sql`fn_next_lead_code()`,
          source: 'email',
          inboundThreadId: thread.gmailThreadId,
          inboundEmailMessageId: firstInbound.gmailMessageId,
          unmatchedFromEmail: firstInbound.fromEmail,
          unmatchedFromName: firstInbound.fromName,
          aiSummary: thread.aiSummary,
          status: 'new',
        })
        .returning({ id: leads.id });

      if (newLead) {
        await db
          .update(emailThreads)
          .set({ leadId: newLead.id, updatedAt: sql`now()` })
          .where(eq(emailThreads.id, threadId));
        applied.leadCreated = newLead.id;
      }
    }
  }

  return applied;
}

function extractDomain(email: string): string | null {
  const m = email.toLowerCase().match(/@([a-z0-9.-]+)/);
  return m?.[1] ?? null;
}
