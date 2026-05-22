/**
 * Execute an APPROVED ai_suggestion — write the side-effect to the
 * source-of-truth table. Each suggestion_type has a handler.
 *
 * On success: marks the suggestion 'executed' and records the new
 * entity id (or update target) in execution_result. On failure: marks
 * 'failed' with an error message so the operator can retry.
 */
import {
  db,
  aiSuggestions,
  clients,
  contacts,
  contactMethods,
  projects,
  leads,
  emailThreads,
  projectTasks,
  dailyTasks,
  briefs,
} from '@antagna/db';
import { eq, sql } from 'drizzle-orm';
import type { ExecutionResult, ProposedData } from './types';

export async function executeSuggestion(
  suggestionId: string,
  actorProfileId: string,
): Promise<ExecutionResult> {
  const [s] = await db
    .select()
    .from(aiSuggestions)
    .where(eq(aiSuggestions.id, suggestionId))
    .limit(1);
  if (!s) return { ok: false, error: 'not_found' };
  if (s.status !== 'approved') {
    return { ok: false, error: 'not_approved' };
  }

  const proposed = s.proposedData as unknown as ProposedData;
  let result: ExecutionResult;

  try {
    switch (proposed.type) {
      case 'create_client':
        result = await execCreateClient(proposed, actorProfileId);
        break;
      case 'create_contact':
        result = await execCreateContact(proposed);
        break;
      case 'create_lead':
        result = await execCreateLead(proposed);
        break;
      case 'create_project':
        result = await execCreateProject(proposed, actorProfileId);
        break;
      case 'update_project':
        result = await execUpdateProject(proposed, actorProfileId);
        break;
      case 'create_task':
        result = await execCreateTask(proposed, actorProfileId);
        break;
      case 'link_thread_to_project':
        result = await execLinkThread(s.sourceThreadId, proposed);
        break;
      case 'reply_draft':
        // TODO: insert into email_drafts when reply-loop is built
        result = { ok: false, error: 'reply_draft_not_implemented' };
        break;
      case 'escalate_to_human':
        // TODO: send notification to recommended_recipient_profile_id
        result = { ok: true, created_entity_type: 'notification' };
        break;
      default:
        result = { ok: false, error: 'unknown_type' };
    }
  } catch (err) {
    result = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  await db
    .update(aiSuggestions)
    .set({
      status: result.ok ? 'executed' : 'failed',
      executedAt: new Date(),
      executionResult: result as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(eq(aiSuggestions.id, suggestionId));

  return result;
}

// ── per-type executors ───────────────────────────────────────────────────

async function execCreateClient(
  p: Extract<ProposedData, { type: 'create_client' }>,
  actor: string,
): Promise<ExecutionResult> {
  // Auto-generate a short uppercase code from the name (first 8 chars).
  const code = p.name_ar.replace(/[^A-Za-z0-9؀-ۿ]+/g, '').slice(0, 8) || 'NEW';
  const [row] = await db.execute<{ id: string }>(sql`
    INSERT INTO clients (code, name_ar, name_en, industry, country, city, website_url, created_by)
    VALUES (
      ${code}::text, ${p.name_ar}::text, ${p.name_en ?? null}::text,
      ${p.industry ?? null}::text, ${p.country ?? 'SA'}::text,
      ${p.city ?? null}::text, ${p.website_url ?? null}::text,
      ${actor}::uuid
    )
    ON CONFLICT (code) DO UPDATE SET name_ar = clients.name_ar
    RETURNING id::text AS id
  `) as unknown as Array<{ id: string }>;
  return { ok: true, created_entity_type: 'client', created_entity_id: row?.id };
}

async function execCreateContact(
  p: Extract<ProposedData, { type: 'create_contact' }>,
): Promise<ExecutionResult> {
  if (!p.client_id) return { ok: false, error: 'client_id_required' };
  const [contact] = await db
    .insert(contacts)
    .values({
      clientId: p.client_id,
      fullName: p.full_name,
      fullNameAr: p.full_name_ar ?? null,
      jobTitle: p.job_title ?? null,
      isPrimary: p.is_primary ?? false,
    })
    .returning({ id: contacts.id });
  if (!contact) return { ok: false, error: 'insert_failed' };

  // Add email + phone as contact_methods so future lookups match.
  if (p.email) {
    await db.insert(contactMethods).values({
      contactId: contact.id,
      methodType: 'email',
      value: p.email,
      normalizedValue: p.email.toLowerCase().trim(),
    });
  }
  if (p.phone_e164) {
    await db.insert(contactMethods).values({
      contactId: contact.id,
      methodType: 'phone',
      value: p.phone_e164,
      normalizedValue: p.phone_e164.replace(/[^0-9+]/g, ''),
    });
  }
  return { ok: true, created_entity_type: 'contact', created_entity_id: contact.id };
}

async function execCreateLead(
  p: Extract<ProposedData, { type: 'create_lead' }>,
): Promise<ExecutionResult> {
  const [row] = await db
    .insert(leads)
    .values({
      code: sql`fn_next_lead_code()`,
      source: 'email',
      unmatchedFromEmail: p.unmatched_from_email,
      unmatchedFromName: p.unmatched_from_name ?? null,
      clientId: p.client_id ?? null,
      aiSummary: p.ai_summary ?? null,
      temperatureScore: p.temperature_score ?? null,
      estimatedValueSar: p.estimated_value_sar?.toString() ?? null,
      status: 'new',
    })
    .returning({ id: leads.id });
  return { ok: !!row, created_entity_type: 'lead', created_entity_id: row?.id };
}

async function execCreateProject(
  p: Extract<ProposedData, { type: 'create_project' }>,
  actor: string,
): Promise<ExecutionResult> {
  if (!p.client_id) return { ok: false, error: 'client_id_required' };
  const [row] = await db.execute<{ id: string }>(sql`
    INSERT INTO projects (
      title, title_ar, description, client_id,
      project_type, stage,
      delivery_due_at, shoot_starts_at,
      contracted_value_sar,
      brief_received_at,
      created_by
    ) VALUES (
      ${p.title}::text, ${p.title_ar ?? null}::text, ${p.description ?? null}::text,
      ${p.client_id}::uuid,
      ${p.project_type}::project_type, 'brief'::project_stage,
      ${p.delivery_due_at_iso ?? null}::timestamptz,
      ${p.shoot_starts_at_iso ?? null}::timestamptz,
      ${p.contracted_value_sar?.toString() ?? null}::numeric,
      now(),
      ${actor}::uuid
    )
    RETURNING id::text AS id
  `) as unknown as Array<{ id: string }>;
  return { ok: !!row, created_entity_type: 'project', created_entity_id: row?.id };
}

async function execUpdateProject(
  p: Extract<ProposedData, { type: 'update_project' }>,
  actor: string,
): Promise<ExecutionResult> {
  const u = p.field_updates;
  await db.execute(sql`
    UPDATE projects SET
      delivery_due_at = COALESCE(${u.delivery_due_at_iso ?? null}::timestamptz, delivery_due_at),
      shoot_starts_at = COALESCE(${u.shoot_starts_at_iso ?? null}::timestamptz, shoot_starts_at),
      shoot_ends_at = COALESCE(${u.shoot_ends_at_iso ?? null}::timestamptz, shoot_ends_at),
      contracted_value_sar = COALESCE(${u.contracted_value_sar?.toString() ?? null}::numeric, contracted_value_sar),
      description = COALESCE(${u.description ?? null}::text, description),
      updated_at = now()
    WHERE id = ${p.project_id}::uuid
  `);

  // Append a brief note if provided
  if (p.brief_note) {
    await db.insert(briefs).values({
      projectId: p.project_id,
      version: 1,
      sourceText: p.brief_note,
      parsedSummary: p.brief_note,
      createdBy: actor,
    });
  }
  return { ok: true, created_entity_type: 'project', created_entity_id: p.project_id };
}

async function execCreateTask(
  p: Extract<ProposedData, { type: 'create_task' }>,
  actor: string,
): Promise<ExecutionResult> {
  if (p.project_id) {
    const [row] = await db
      .insert(projectTasks)
      .values({
        projectId: p.project_id,
        title: p.title,
        assigneeId: p.assignee_profile_id ?? null,
        dueAt: p.due_iso ? new Date(p.due_iso) : null,
        status: 'pending',
        createdBy: actor,
      })
      .returning({ id: projectTasks.id });
    return { ok: !!row, created_entity_type: 'project_task', created_entity_id: row?.id };
  }
  // Otherwise daily task
  const [row] = await db
    .insert(dailyTasks)
    .values({
      ownerId: p.assignee_profile_id ?? actor,
      assignerId: actor,
      title: p.title,
      dueAt: p.due_iso ? new Date(p.due_iso) : null,
      status: 'pending',
    })
    .returning({ id: dailyTasks.id });
  return { ok: !!row, created_entity_type: 'daily_task', created_entity_id: row?.id };
}

async function execLinkThread(
  threadId: string | null,
  p: Extract<ProposedData, { type: 'link_thread_to_project' }>,
): Promise<ExecutionResult> {
  if (!threadId) return { ok: false, error: 'no_thread' };
  await db
    .update(emailThreads)
    .set({ projectId: p.project_id, updatedAt: sql`now()` })
    .where(eq(emailThreads.id, threadId));
  return { ok: true, created_entity_type: 'email_thread_link', created_entity_id: threadId };
}
