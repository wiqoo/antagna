'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { withActor } from '@antagna/db';
import { getAnthropic, ANTHROPIC_MODELS, recordUsage, assertAiBudget } from '@antagna/ai';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requirePermissionAction } from '@/lib/authz';
import { parseNum, parseDate } from '@/lib/parse';

const PARSE_SYSTEM = `You are Antagna's brief parser for a Saudi production agency (Volt Production).
Read the brief text and output STRICT JSON only. No prose.

Schema:
{
  "title": "<English title, short, title-case>",
  "title_ar": "<Arabic title>",
  "summary": "<one-paragraph Arabic summary>",
  "project_type": "shoot" | "edit_only" | "live_coverage" | "content_creation" | "consulting" | "other",
  "deliverables_count": <int or null>,
  "shoot_date_iso": "<YYYY-MM-DD or null>",
  "delivery_due_iso": "<YYYY-MM-DD or null>",
  "languages": ["ar","en",...] or [],
  "locations": ["...", ...] or [],
  "vehicles": ["...", ...] or [],
  "budget_sar": <number or null>,
  "completeness_score": <0-100 — how complete the brief looks>,
  "missing_fields": ["<short_label>",...]
}

If date is relative (e.g. "next Thursday"), resolve to ISO based on today: {{TODAY}}.
Output JSON only — nothing before or after.`;

export type ParsedBrief = {
  title: string;
  title_ar: string;
  summary: string;
  project_type:
    | 'shoot'
    | 'edit_only'
    | 'live_coverage'
    | 'content_creation'
    | 'consulting'
    | 'other';
  deliverables_count: number | null;
  shoot_date_iso: string | null;
  delivery_due_iso: string | null;
  languages: string[];
  locations: string[];
  vehicles: string[];
  budget_sar: number | null;
  completeness_score: number;
  missing_fields: string[];
};

export async function parseBrief(
  rawText: string,
): Promise<{ ok: true; parsed: ParsedBrief } | { ok: false; error: string }> {
  if (!rawText.trim()) {
    return { ok: false, error: 'empty' };
  }
  const actorId = await requirePermissionAction('brief.parse_ai');
  await assertAiBudget({ userId: actorId, feature: 'brief_parse' });
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const anthropic = getAnthropic();
  const today = new Date().toISOString().slice(0, 10);
  const system = PARSE_SYSTEM.replace('{{TODAY}}', today);

  try {
    const resp = await anthropic.messages.create({
      model: ANTHROPIC_MODELS.sonnet,
      max_tokens: 1200,
      system,
      messages: [{ role: 'user', content: rawText }],
    });

    await recordUsage({
      feature: 'brief_parse',
      model: ANTHROPIC_MODELS.sonnet,
      inputTokens: resp.usage.input_tokens,
      outputTokens: resp.usage.output_tokens,
      authUserId: user.id,
    });

    const text = resp.content.find((b) => b.type === 'text');
    const raw = text && text.type === 'text' ? text.text : '{}';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { ok: false, error: 'no_json_in_response' };
    }
    const parsed = JSON.parse(jsonMatch[0]) as ParsedBrief;
    return { ok: true, parsed };
  } catch (err) {
    console.error('[parseBrief]', err);
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' };
  }
}

export async function commitBriefAsProject(formData: FormData) {
  const pid = await requirePermissionAction('brief.create');

  const clientId = formData.get('clientId')?.toString();
  const title = formData.get('title')?.toString() || 'Untitled brief';
  const titleAr = formData.get('titleAr')?.toString() || null;
  const projectType = (formData.get('projectType')?.toString() ?? 'shoot') as
    | 'shoot'
    | 'edit_only'
    | 'live_coverage'
    | 'content_creation'
    | 'consulting'
    | 'other';
  const deliveryDue = parseDate(formData.get('deliveryDueAt'));
  const shootStarts = parseDate(formData.get('shootStartsAt'));
  const budget = parseNum(formData.get('budgetSar'));
  const sourceText = formData.get('sourceText')?.toString() || '';
  const parsedSummary = formData.get('parsedSummary')?.toString() || null;
  const completeness = parseNum(formData.get('completeness'));
  const deliverablesCount = parseNum(formData.get('deliverablesCount'));
  const missingFields = formData.get('missingFields')?.toString() ?? '';
  const parsedLanguages = formData.get('parsedLanguages')?.toString() ?? '';
  const parsedLocations = formData.get('parsedLocations')?.toString() ?? '';

  if (!clientId) throw new Error('clientId required');

  // Insert project + brief atomically, with the audit actor on the same conn.
  const projectId = await withActor(pid, async (tx) => {
    // 1. Insert the project
    const projRes = await tx.execute<{ id: string }>(sql`
      INSERT INTO projects (
        title, title_ar, client_id, project_type, stage,
        brief_received_at, delivery_due_at, shoot_starts_at,
        contracted_value_sar, created_by
      )
      VALUES (
        ${title}, ${titleAr}, ${clientId}::uuid,
        ${projectType}::project_type, 'brief'::project_stage,
        now(),
        ${deliveryDue ? sql`${deliveryDue}::timestamptz` : sql`NULL`},
        ${shootStarts ? sql`${shootStarts}::timestamptz` : sql`NULL`},
        ${budget != null ? sql`${budget}::numeric` : sql`NULL`},
        ${pid}::uuid
      )
      RETURNING id
    `);
    const newId = (projRes as unknown as Array<{ id: string }>)[0]?.id;
    if (!newId) throw new Error('project insert failed');

    // 2. Insert the brief
    await tx.execute(sql`
      INSERT INTO briefs (
        project_id, version, source_text, parsed_summary,
        parsed_deliverables_count, parsed_shoot_date, parsed_budget_sar,
        parsed_languages, parsed_locations,
        completeness_score, missing_fields, created_by
      )
      VALUES (
        ${newId}::uuid, 1, ${sourceText}, ${parsedSummary},
        ${deliverablesCount},
        ${shootStarts ? sql`${shootStarts}::timestamptz` : sql`NULL`},
        ${budget != null ? sql`${budget}::numeric` : sql`NULL`},
        string_to_array(NULLIF(${parsedLanguages}, ''), ','),
        string_to_array(NULLIF(${parsedLocations}, ''), ','),
        ${completeness},
        string_to_array(NULLIF(${missingFields}, ''), ','),
        ${pid}::uuid
      )
    `);

    return newId;
  });

  revalidatePath('/projects');
  redirect(`/projects/${projectId}`);
}
