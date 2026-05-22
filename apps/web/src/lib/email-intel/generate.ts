/**
 * Suggestion generator — turns one ExtractedEmail into 0..N AiSuggestion
 * rows. Each is independently approvable.
 *
 * Routing decisions (which suggestion type fires when) live here. Each
 * helper returns either an insert payload or null if nothing applies.
 */
import {
  db,
  emailExtractions,
  emailMessages,
  emailThreads,
  aiSuggestions,
  clients,
  contactMethods,
  contacts,
  projects,
  leads,
} from '@antagna/db';
import { eq, and, isNull, sql } from 'drizzle-orm';
import type { ExtractedEmail, SuggestionType, ProposedData } from './types';

interface SuggestionInsert {
  type: SuggestionType;
  data: Record<string, unknown>;
  summary: string;
  confidence: number;
}

export interface GenerateResult {
  ok: boolean;
  extractionId: string;
  generated: number;
  suggestionIds: string[];
  error?: string;
}

export async function generateSuggestionsForExtraction(
  extractionId: string,
): Promise<GenerateResult> {
  const [ex] = await db
    .select()
    .from(emailExtractions)
    .where(eq(emailExtractions.id, extractionId))
    .limit(1);
  if (!ex) return { ok: false, extractionId, generated: 0, suggestionIds: [], error: 'not_found' };

  const data = ex.data as unknown as ExtractedEmail;
  const [msg] = await db
    .select()
    .from(emailMessages)
    .where(eq(emailMessages.id, ex.messageId))
    .limit(1);
  if (!msg) {
    return { ok: false, extractionId, generated: 0, suggestionIds: [], error: 'no_message' };
  }
  const [thread] = await db
    .select()
    .from(emailThreads)
    .where(eq(emailThreads.id, ex.threadId))
    .limit(1);

  const suggestions: SuggestionInsert[] = [];

  // ── client / contact ─────────────────────────────────────────────────
  const senderEmail = (data.sender?.email ?? msg.fromEmail).trim().toLowerCase();
  const senderName = data.sender?.name ?? msg.fromName ?? null;
  const senderCompany = data.sender?.company ?? null;
  const domain = extractDomain(senderEmail);

  // Is there already a contact with this email?
  const [knownContact] = await db
    .select({ contactId: contactMethods.contactId, clientId: contacts.clientId })
    .from(contactMethods)
    .innerJoin(contacts, eq(contacts.id, contactMethods.contactId))
    .where(
      and(
        eq(contactMethods.methodType, 'email'),
        eq(contactMethods.normalizedValue, senderEmail),
      ),
    )
    .limit(1);

  // Is there a client with a matching domain?
  let domainClientId: string | null = null;
  if (!knownContact && domain) {
    const [c] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(
        and(
          isNull(clients.archivedAt),
          sql`lower(${clients.websiteUrl}) LIKE ${'%' + domain + '%'}`,
        ),
      )
      .limit(1);
    domainClientId = c?.id ?? null;
  }

  // → suggest create_client for unknown senders with a company hint
  if (!knownContact && !domainClientId && senderCompany && data.intent !== 'introduction'
      && data.intent !== 'other') {
    suggestions.push({
      type: 'create_client',
      data: {
        type: 'create_client',
        name_ar: senderCompany,
        name_en: senderCompany,
        industry: null,
        country: 'SA',
        website_url: domain ? `https://${domain}` : null,
        source_sender_email: senderEmail,
      },
      summary: `عميل جديد: ${senderCompany} (من ${senderEmail})`,
      confidence: clamp(data.confidence * 0.9, 0.4, 0.95),
    });
  }

  // → suggest create_contact when client is known but sender is new
  if (!knownContact && (domainClientId || senderCompany) && senderName) {
    suggestions.push({
      type: 'create_contact',
      data: {
        type: 'create_contact',
        client_id: domainClientId,
        full_name: senderName,
        full_name_ar: null,
        job_title: data.sender?.role ?? null,
        email: senderEmail,
        phone_e164: data.sender?.phone ?? null,
        is_primary: false,
      },
      summary: domainClientId
        ? `جهة اتصال جديدة: ${senderName} (لعميل موجود)`
        : `جهة اتصال جديدة: ${senderName}`,
      confidence: clamp(data.confidence * 0.85, 0.4, 0.95),
    });
  }

  // ── project signals ────────────────────────────────────────────────────
  if (data.project_signals?.is_new_project) {
    const title =
      data.project_signals.proposed_title_en ??
      data.project_signals.proposed_title_ar ??
      thread?.subject ??
      'مشروع جديد';
    suggestions.push({
      type: 'create_project',
      data: {
        type: 'create_project',
        client_id: domainClientId ?? knownContact?.clientId ?? null,
        title,
        title_ar: data.project_signals.proposed_title_ar ?? null,
        description: data.summary_ar,
        project_type: mapProjectType(data.project_signals.project_type),
        shoot_starts_at_iso: data.dates?.shoot_dates_iso?.[0] ?? null,
        delivery_due_at_iso: data.dates?.delivery_deadline_iso ?? null,
        contracted_value_sar: data.budget?.amount_sar ?? null,
        deliverables: (data.deliverables ?? []).map((d) => ({
          format: d.format,
          aspect_ratio: '16:9',
          duration_sec: d.duration_sec,
          count: d.count,
          platform: d.platform ?? '',
        })),
      },
      summary: `مشروع جديد مقترح: "${title}"`,
      confidence: clamp(data.confidence * 0.85, 0.4, 0.95),
    });
  }

  // ── update existing project (project_id hinted in body) ──────────────
  for (const hint of data.project_signals?.existing_project_hints ?? []) {
    const code = hint.match(/(PRJ-\d+)/i)?.[1]?.toUpperCase();
    if (!code) continue;
    const [proj] = await db
      .select({ id: projects.id, title: projects.title })
      .from(projects)
      .where(eq(projects.code, code))
      .limit(1);
    if (!proj) continue;

    // Build field updates from what the email mentions
    const fieldUpdates: Record<string, unknown> = {};
    if (data.dates?.delivery_deadline_iso) {
      fieldUpdates.delivery_due_at_iso = data.dates.delivery_deadline_iso;
    }
    if (data.dates?.shoot_dates_iso?.[0]) {
      fieldUpdates.shoot_starts_at_iso = data.dates.shoot_dates_iso[0];
    }
    if (data.budget?.amount_sar) {
      fieldUpdates.contracted_value_sar = data.budget.amount_sar;
    }

    if (Object.keys(fieldUpdates).length > 0 || data.action_items?.length) {
      suggestions.push({
        type: 'update_project',
        data: {
          type: 'update_project',
          project_id: proj.id,
          field_updates: fieldUpdates,
          brief_note: data.summary_ar,
        },
        summary: `تحديث مشروع ${code} (${proj.title})`,
        confidence: clamp(data.confidence * 0.9, 0.5, 0.97),
      });
    }

    // Also: link this thread to the project
    if (thread && !thread.projectId) {
      suggestions.push({
        type: 'link_thread_to_project',
        data: { type: 'link_thread_to_project', project_id: proj.id },
        summary: `ربط محادثة "${thread.subject ?? '(no subject)'}" بمشروع ${code}`,
        confidence: 0.93,
      });
    }
  }

  // ── action items → tasks ─────────────────────────────────────────────
  for (const item of data.action_items ?? []) {
    if (!item.description || item.description.length < 5) continue;
    suggestions.push({
      type: 'create_task',
      data: {
        type: 'create_task',
        project_id: null, // will be set during execution if linked thread
        assignee_profile_id: null,
        title: item.description.slice(0, 200),
        due_iso: item.due_iso,
        notes: item.owner_hint ? `Owner hint: ${item.owner_hint}` : null,
      },
      summary: `مهمة جديدة: ${item.description.slice(0, 80)}`,
      confidence: clamp(data.confidence * 0.7, 0.3, 0.85),
    });
  }

  // ── escalate when sentiment is concerning ────────────────────────────
  if (data.sentiment === 'angry' || (data.sentiment === 'concerned' && data.urgency === 'high')) {
    suggestions.push({
      type: 'escalate_to_human',
      data: {
        type: 'escalate_to_human',
        reason: `Sentiment: ${data.sentiment}, urgency: ${data.urgency}. ${data.summary_ar}`,
        recommended_recipient_profile_id: null,
      },
      summary: `تصعيد: ${data.sentiment === 'angry' ? 'عميل مستاء' : 'مشكلة عاجلة'} — ${(senderCompany ?? senderName ?? senderEmail)}`,
      confidence: 0.85,
    });
  }

  // Persist all suggestions
  const ids: string[] = [];
  for (const s of suggestions) {
    const [row] = await db
      .insert(aiSuggestions)
      .values({
        sourceType: 'email',
        sourceThreadId: ex.threadId,
        sourceMessageId: ex.messageId,
        sourceExtractionId: ex.id,
        suggestionType: s.type,
        proposedData: s.data,
        summaryAr: s.summary,
        confidence: s.confidence.toFixed(2),
      })
      .returning({ id: aiSuggestions.id });
    if (row) ids.push(row.id);
  }

  return {
    ok: true,
    extractionId,
    generated: ids.length,
    suggestionIds: ids,
  };
}

// ── helpers ──────────────────────────────────────────────────────────────

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function extractDomain(email: string): string | null {
  const m = email.toLowerCase().match(/@([a-z0-9.-]+)/);
  return m?.[1] ?? null;
}

function mapProjectType(
  t: ExtractedEmail['project_signals']['project_type'],
): 'shoot' | 'edit_only' | 'content_creation' | 'consulting' | 'other' {
  if (t === 'shoot') return 'shoot';
  if (t === 'edit') return 'edit_only';
  if (t === 'campaign') return 'content_creation';
  if (t === 'consulting') return 'consulting';
  return 'other';
}
