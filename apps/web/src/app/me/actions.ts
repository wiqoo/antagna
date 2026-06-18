'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { getAnthropic, ANTHROPIC_MODELS, assertAiBudget, recordUsage } from '@antagna/ai';
import { requireOwner } from './auth';

const str = (v: FormDataEntryValue | null, max = 2000): string | null => {
  const s = (v == null ? '' : String(v)).trim();
  return s ? s.slice(0, max) : null;
};

// ── capture (frictionless — no AI, instant) ──────────────────────────────────
export async function captureItem(formData: FormData): Promise<void> {
  const me = await requireOwner();
  const content = str(formData.get('content'));
  if (!content) return;
  const source = ['text', 'voice', 'share', 'whatsapp'].includes(String(formData.get('source')))
    ? String(formData.get('source')) : 'text';
  await db.execute(sql`
    INSERT INTO me_inbox (owner_id, content, source) VALUES (${me.profileId}::uuid, ${content}, ${source})
  `);
  revalidatePath('/me/inbox');
  revalidatePath('/me');
}

// ── inbox triage (AI, on demand) ─────────────────────────────────────────────
export async function triageInboxItem(itemId: string): Promise<void> {
  const me = await requireOwner();
  const rows = (await db.execute(sql`
    SELECT content FROM me_inbox WHERE id = ${itemId}::uuid AND owner_id = ${me.profileId}::uuid
  `)) as unknown as Array<{ content: string }>;
  const content = rows[0]?.content;
  if (!content) return;

  const projects = (await db.execute(sql`
    SELECT id::text, title FROM me_projects WHERE owner_id = ${me.profileId}::uuid AND status = 'active' ORDER BY updated_at DESC LIMIT 30
  `)) as unknown as Array<{ id: string; title: string }>;

  try {
    await assertAiBudget({ userId: me.profileId, feature: 'me_triage' });
    const client = getAnthropic();
    const resp = await client.messages.create({
      model: ANTHROPIC_MODELS.haiku,
      max_tokens: 200,
      system: `You triage a personal capture note (Arabic). Output STRICT JSON only:
{"title":"<a clean, short actionable task title in Arabic>","is_task":true|false,"project_id":"<id from the list that best matches, or null>"}
is_task=false only for pure notes/ideas with no action. Pick project_id ONLY if clearly related.`,
      messages: [{
        role: 'user',
        content: `Capture: ${content}\n\nProjects:\n${projects.map((p) => `${p.id} = ${p.title}`).join('\n') || '(none)'}`,
      }],
    });
    await recordUsage({
      feature: 'me_triage', model: ANTHROPIC_MODELS.haiku,
      inputTokens: resp.usage.input_tokens, outputTokens: resp.usage.output_tokens,
    });
    const txt = resp.content.find((b) => b.type === 'text');
    const raw = txt && txt.type === 'text' ? txt.text : '{}';
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      const parsed = JSON.parse(m[0]) as { title?: string; is_task?: boolean; project_id?: string | null };
      const projectId = parsed.project_id && projects.some((p) => p.id === parsed.project_id) ? parsed.project_id : null;
      const suggestion = {
        title: String(parsed.title ?? content).slice(0, 200),
        type: parsed.is_task === false ? 'note' : 'task',
        projectId,
      };
      await db.execute(sql`
        UPDATE me_inbox SET ai_suggestion = ${JSON.stringify(suggestion)}::jsonb
        WHERE id = ${itemId}::uuid AND owner_id = ${me.profileId}::uuid
      `);
    }
  } catch {
    /* triage is best-effort */
  }
  revalidatePath('/me/inbox');
}

export async function convertInboxToTask(itemId: string, formData: FormData): Promise<void> {
  const me = await requireOwner();
  const title = str(formData.get('title'), 200);
  if (!title) return;
  const projectId = str(formData.get('project_id'), 40);
  await db.execute(sql`
    INSERT INTO me_tasks (owner_id, project_id, title)
    VALUES (${me.profileId}::uuid, ${projectId ? sql`${projectId}::uuid` : sql`NULL`}, ${title})
  `);
  await db.execute(sql`UPDATE me_inbox SET processed = true WHERE id = ${itemId}::uuid AND owner_id = ${me.profileId}::uuid`);
  revalidatePath('/me/inbox');
  revalidatePath('/me');
}

export async function archiveInboxItem(itemId: string): Promise<void> {
  const me = await requireOwner();
  await db.execute(sql`UPDATE me_inbox SET processed = true WHERE id = ${itemId}::uuid AND owner_id = ${me.profileId}::uuid`);
  revalidatePath('/me/inbox');
}

// ── tasks ────────────────────────────────────────────────────────────────────
export async function createTask(formData: FormData): Promise<void> {
  const me = await requireOwner();
  const title = str(formData.get('title'), 200);
  if (!title) return;
  const projectId = str(formData.get('project_id'), 40);
  const due = str(formData.get('due_date'), 30);
  const isToday = String(formData.get('is_today')) === '1';
  await db.execute(sql`
    INSERT INTO me_tasks (owner_id, project_id, title, priority, due_date, is_today)
    VALUES (
      ${me.profileId}::uuid, ${projectId ? sql`${projectId}::uuid` : sql`NULL`}, ${title},
      ${['low', 'normal', 'high'].includes(String(formData.get('priority'))) ? String(formData.get('priority')) : 'normal'},
      ${due ? sql`${due}::date` : sql`NULL`}, ${isToday}
    )
  `);
  revalidatePath('/me');
  revalidatePath('/me/inbox');
}

export async function toggleTask(taskId: string): Promise<void> {
  const me = await requireOwner();
  await db.execute(sql`
    UPDATE me_tasks SET
      status = CASE WHEN status = 'done' THEN 'todo' ELSE 'done' END,
      completed_at = CASE WHEN status = 'done' THEN NULL ELSE now() END
    WHERE id = ${taskId}::uuid AND owner_id = ${me.profileId}::uuid
  `);
  revalidatePath('/me');
}

export async function setTaskToday(taskId: string, value: boolean): Promise<void> {
  const me = await requireOwner();
  await db.execute(sql`
    UPDATE me_tasks SET is_today = ${value} WHERE id = ${taskId}::uuid AND owner_id = ${me.profileId}::uuid
  `);
  revalidatePath('/me');
}

export async function deleteTask(taskId: string): Promise<void> {
  const me = await requireOwner();
  await db.execute(sql`DELETE FROM me_tasks WHERE id = ${taskId}::uuid AND owner_id = ${me.profileId}::uuid`);
  revalidatePath('/me');
}

// ── projects ─────────────────────────────────────────────────────────────────
export async function createProject(formData: FormData): Promise<void> {
  const me = await requireOwner();
  const title = str(formData.get('title'), 160);
  if (!title) return;
  const type = String(formData.get('type')) === 'personal' ? 'personal' : 'work';
  const deadline = str(formData.get('deadline'), 30);
  const rows = (await db.execute(sql`
    INSERT INTO me_projects (owner_id, title, type, stage, deadline)
    VALUES (${me.profileId}::uuid, ${title}, ${type}, ${type === 'work' ? 'planning' : sql`NULL`},
            ${deadline ? sql`${deadline}::date` : sql`NULL`})
    RETURNING id::text AS id
  `)) as unknown as Array<{ id: string }>;
  revalidatePath('/me/projects');
  const id = rows[0]?.id;
  if (id) redirect(`/me/projects/${id}`);
  redirect('/me/projects');
}

export async function updateProject(projectId: string, formData: FormData): Promise<void> {
  const me = await requireOwner();
  const deadline = str(formData.get('deadline'), 30);
  await db.execute(sql`
    UPDATE me_projects SET
      title = COALESCE(${str(formData.get('title'), 160)}, title),
      stage = ${str(formData.get('stage'), 40)},
      status = ${['active', 'done', 'archived'].includes(String(formData.get('status'))) ? String(formData.get('status')) : 'active'},
      deadline = ${deadline ? sql`${deadline}::date` : sql`NULL`},
      notes = ${str(formData.get('notes'))},
      updated_at = now()
    WHERE id = ${projectId}::uuid AND owner_id = ${me.profileId}::uuid
  `);
  revalidatePath(`/me/projects/${projectId}`);
  revalidatePath('/me/projects');
}
