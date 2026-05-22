'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql, eq } from 'drizzle-orm';
import { db, profiles } from '@antagna/db';
import { getAnthropic, ANTHROPIC_MODELS, recordUsage } from '@antagna/ai';
import { getSupabaseServerClient } from '@/lib/supabase/server';

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
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/briefs/new');

  const [actor] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.authUserId, user.id))
    .limit(1);
  if (actor) {
    await db.execute(sql`SELECT set_config('app.acting_as', ${actor.id}, true)`);
  }

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
  const deliveryDue = formData.get('deliveryDueAt')?.toString() || null;
  const shootStarts = formData.get('shootStartsAt')?.toString() || null;
  const budget = formData.get('budgetSar')?.toString() || null;
  const sourceText = formData.get('sourceText')?.toString() || '';
  const parsedSummary = formData.get('parsedSummary')?.toString() || null;
  const completeness = Number(formData.get('completeness') ?? 0) || null;
  const missingFields = formData.get('missingFields')?.toString() ?? '';
  const parsedLanguages = formData.get('parsedLanguages')?.toString() ?? '';
  const parsedLocations = formData.get('parsedLocations')?.toString() ?? '';

  if (!clientId) throw new Error('clientId required');

  // 1. Insert the project
  const projRes = await db.execute<{ id: string }>(sql`
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
      ${budget ? sql`${budget}::numeric` : sql`NULL`},
      ${actor?.id ? sql`${actor.id}::uuid` : sql`NULL`}
    )
    RETURNING id
  `);
  const projectId = (projRes as unknown as Array<{ id: string }>)[0]?.id;
  if (!projectId) throw new Error('project insert failed');

  // 2. Insert the brief
  await db.execute(sql`
    INSERT INTO briefs (
      project_id, version, source_text, parsed_summary,
      parsed_deliverables_count, parsed_shoot_date, parsed_budget_sar,
      parsed_languages, parsed_locations,
      completeness_score, missing_fields, created_by
    )
    VALUES (
      ${projectId}::uuid, 1, ${sourceText}, ${parsedSummary},
      ${formData.get('deliverablesCount')?.toString() ?? null},
      ${shootStarts ? sql`${shootStarts}::timestamptz` : sql`NULL`},
      ${budget ? sql`${budget}::numeric` : sql`NULL`},
      string_to_array(NULLIF(${parsedLanguages}, ''), ','),
      string_to_array(NULLIF(${parsedLocations}, ''), ','),
      ${completeness},
      string_to_array(NULLIF(${missingFields}, ''), ','),
      ${actor?.id ? sql`${actor.id}::uuid` : sql`NULL`}
    )
  `);

  revalidatePath('/projects');
  redirect(`/projects/${projectId}`);
}
