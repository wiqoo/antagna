'use server';

import { redirect } from 'next/navigation';
import { sql, eq } from 'drizzle-orm';
import { db, profiles } from '@antagna/db';
import { getAnthropic, ANTHROPIC_MODELS, recordUsage } from '@antagna/ai';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { writeActivity } from '@/lib/activity';

// ════════════════════════════════════════════════════════════════════════════
// AI PARSE — extract rich brief from any pasted text (email / WhatsApp / doc)
// ════════════════════════════════════════════════════════════════════════════

const PARSE_SYSTEM = `You are Antagna's brief parser for Volt Production (Saudi automotive content agency, Jeddah).
Read the brief text (any language, often Arabic mixed with English) and output STRICT JSON only.

Schema:
{
  "title_en": "<short English title, title-case>",
  "title_ar": "<Arabic title>",
  "objective": "<one Arabic sentence — why this video exists>",
  "target_audience": "<Arabic, e.g. السعوديين الذكور 18-24>",
  "tone_style": "cinematic" | "documentary" | "fast-cut-social" | "talking-head" | "mixed",
  "project_type": "shoot" | "edit_only" | "live_coverage" | "content_creation" | "consulting" | "other",
  "budget_bracket": "10-25k" | "25-50k" | "50-100k" | "100k+" | null,
  "budget_sar": <number or null>,
  "shoot_date_iso": "<YYYY-MM-DD or null>",
  "delivery_due_iso": "<YYYY-MM-DD or null>",
  "locations": [{"city":"<ar>","venue":"<ar or null>","permit_required":<bool>}],
  "languages": ["ar","en",...] or [],
  "deliverables": [
    {"format":"reel|short|long|photo|print","aspect_ratio":"9:16|16:9|1:1|4:5","duration_sec":<int or null>,"count":<int>,"platform":"instagram|tiktok|youtube|snapchat|print|other"}
  ],
  "vehicles": ["...", ...],
  "client_assets_provided": ["script","talent","wardrobe","vehicles",...],
  "post_production_scope": ["color","sound_mix","motion_graphics","subtitles_ar","subtitles_en"],
  "primary_contact_name": "<or null>",
  "primary_contact_role": "<or null>",
  "completeness_score": <0-100>,
  "missing_fields": ["<short labels for what's missing>"]
}

If date is relative ("next Thursday"), resolve to ISO based on TODAY: {{TODAY}}.
Be conservative — set null when unsure. Output JSON only.`;

export type ParsedBrief = {
  title_en: string;
  title_ar: string;
  objective: string;
  target_audience: string;
  tone_style: string;
  project_type: string;
  budget_bracket: string | null;
  budget_sar: number | null;
  shoot_date_iso: string | null;
  delivery_due_iso: string | null;
  locations: Array<{ city: string; venue: string | null; permit_required: boolean }>;
  languages: string[];
  deliverables: Array<{
    format: string;
    aspect_ratio: string;
    duration_sec: number | null;
    count: number;
    platform: string;
  }>;
  vehicles: string[];
  client_assets_provided: string[];
  post_production_scope: string[];
  primary_contact_name: string | null;
  primary_contact_role: string | null;
  completeness_score: number;
  missing_fields: string[];
};

export async function parseBriefRich(
  rawText: string,
): Promise<{ ok: true; parsed: ParsedBrief } | { ok: false; error: string }> {
  if (!rawText.trim()) return { ok: false, error: 'empty' };
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const today = new Date().toISOString().slice(0, 10);
  const system = PARSE_SYSTEM.replace('{{TODAY}}', today);

  try {
    const anthropic = getAnthropic();
    const resp = await anthropic.messages.create({
      model: ANTHROPIC_MODELS.sonnet,
      max_tokens: 2000,
      system,
      messages: [{ role: 'user', content: rawText }],
    });
    await recordUsage({
      feature: 'brief_parse_rich',
      model: ANTHROPIC_MODELS.sonnet,
      inputTokens: resp.usage.input_tokens,
      outputTokens: resp.usage.output_tokens,
      authUserId: user.id,
    });
    const text = resp.content.find((b) => b.type === 'text');
    const raw = text && text.type === 'text' ? text.text : '{}';
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { ok: false, error: 'no_json' };
    const parsed = JSON.parse(match[0]) as ParsedBrief;
    return { ok: true, parsed };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' };
  }
}

// ════════════════════════════════════════════════════════════════════════════
// COMMIT — create project + brief + deliverables + assignments in one go
// ════════════════════════════════════════════════════════════════════════════

export async function createProject(formData: FormData) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/projects/new');

  const [actor] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.authUserId, user.id))
    .limit(1);

  if (actor) {
    await db.execute(sql`SELECT set_config('app.acting_as', ${actor.id}, true)`);
  }

  // ── Basics ─────────────────────────────────────────────────────────────
  const clientId = formData.get('clientId')?.toString();
  const title = formData.get('title')?.toString() || 'Untitled';
  const titleAr = formData.get('titleAr')?.toString() || null;
  const description = formData.get('description')?.toString() || null;
  const projectType = (formData.get('projectType')?.toString() ?? 'shoot') as
    | 'shoot' | 'edit_only' | 'live_coverage' | 'content_creation' | 'consulting' | 'other';
  const templateId = formData.get('templateId')?.toString() || null;

  if (!clientId) throw new Error('clientId required');

  // ── Section 1: Client & Commercial ────────────────────────────────────
  const agencyId = formData.get('agencyId')?.toString() || null;
  const budgetSar = formData.get('budgetSar')?.toString() || null;

  // ── Section 2: Creative ───────────────────────────────────────────────
  const objective = formData.get('objective')?.toString() || null;
  const targetAudience = formData.get('targetAudience')?.toString() || null;
  const toneStyle = formData.get('toneStyle')?.toString() || null;

  // ── Section 3: Logistics ──────────────────────────────────────────────
  const shootStartsAt = formData.get('shootStartsAt')?.toString() || null;
  const shootEndsAt = formData.get('shootEndsAt')?.toString() || null;
  const deliveryDueAt = formData.get('deliveryDueAt')?.toString() || null;

  const locationsJson = formData.get('locations')?.toString() || '[]';
  const languagesCsv = formData.get('languages')?.toString() || '';
  const vehiclesCsv = formData.get('vehicles')?.toString() || '';
  const clientAssetsCsv = formData.get('clientAssetsProvided')?.toString() || '';
  const postScopeCsv = formData.get('postProductionScope')?.toString() || '';

  // ── Section 4: Ownership ──────────────────────────────────────────────
  const pmId = formData.get('pmId')?.toString() || null;
  const amId = formData.get('amId')?.toString() || null;
  const productionManagerId =
    formData.get('productionManagerId')?.toString() || null;

  // ── Deliverables array (inline) ───────────────────────────────────────
  const deliverablesJson = formData.get('deliverables')?.toString() || '[]';
  let deliverablesArr: Array<{
    format: string;
    aspect_ratio: string;
    duration_sec: number | null;
    count: number;
    platform: string;
  }> = [];
  try { deliverablesArr = JSON.parse(deliverablesJson); } catch {}

  // ── Crew array (inline) ───────────────────────────────────────────────
  const crewJson = formData.get('crew')?.toString() || '[]';
  let crewArr: Array<{ profile_id: string; role: string }> = [];
  try { crewArr = JSON.parse(crewJson); } catch {}

  // ── Brief source ──────────────────────────────────────────────────────
  const sourceText = formData.get('sourceText')?.toString() || null;
  const parsedSummary = formData.get('parsedSummary')?.toString() || null;
  const completeness = Number(formData.get('completeness') ?? 0) || null;
  const missingFields = formData.get('missingFields')?.toString() || '';

  // Build customFields jsonb from the soft fields
  const customFields: Record<string, unknown> = {};
  if (objective) customFields.objective = objective;
  if (targetAudience) customFields.target_audience = targetAudience;
  if (toneStyle) customFields.tone_style = toneStyle;
  if (clientAssetsCsv) customFields.client_assets_provided = clientAssetsCsv.split(',').map((s) => s.trim()).filter(Boolean);
  if (postScopeCsv) customFields.post_production_scope = postScopeCsv.split(',').map((s) => s.trim()).filter(Boolean);
  if (vehiclesCsv) customFields.vehicles = vehiclesCsv.split(',').map((s) => s.trim()).filter(Boolean);
  if (locationsJson && locationsJson !== '[]') {
    try { customFields.locations = JSON.parse(locationsJson); } catch {}
  }

  // ════════════════════════════════════════════════════════════════════════
  // INSERT — wrap in a transaction
  // ════════════════════════════════════════════════════════════════════════
  let newId = '';

  if (templateId) {
    const res = await db.execute<{ id: string }>(
      sql`SELECT public.fn_create_project_from_template(
        ${templateId}::uuid, ${clientId}::uuid, ${title}::text,
        ${projectType}::project_type
      ) AS id`,
    );
    newId = (res as unknown as Array<{ id: string }>)[0]?.id ?? '';
  } else {
    const res = await db.execute<{ id: string }>(sql`
      INSERT INTO projects (
        title, title_ar, description, client_id, agency_id,
        project_type, stage,
        project_manager_id, account_manager_id, production_manager_id,
        contracted_value_sar,
        delivery_due_at, shoot_starts_at, shoot_ends_at,
        brief_received_at,
        custom_fields,
        created_by
      ) VALUES (
        ${title}, ${titleAr}, ${description},
        ${clientId}::uuid,
        ${agencyId ? sql`${agencyId}::uuid` : sql`NULL`},
        ${projectType}::project_type, 'brief'::project_stage,
        ${pmId ? sql`${pmId}::uuid` : sql`NULL`},
        ${amId ? sql`${amId}::uuid` : sql`NULL`},
        ${productionManagerId ? sql`${productionManagerId}::uuid` : sql`NULL`},
        ${budgetSar ? sql`${budgetSar}::numeric` : sql`NULL`},
        ${deliveryDueAt ? sql`${deliveryDueAt}::timestamptz` : sql`NULL`},
        ${shootStartsAt ? sql`${shootStartsAt}::timestamptz` : sql`NULL`},
        ${shootEndsAt ? sql`${shootEndsAt}::timestamptz` : sql`NULL`},
        ${sourceText ? sql`now()` : sql`NULL`},
        ${JSON.stringify(customFields)}::jsonb,
        ${actor?.id ? sql`${actor.id}::uuid` : sql`NULL`}
      )
      RETURNING id::text AS id
    `);
    newId = (res as unknown as Array<{ id: string }>)[0]?.id ?? '';
  }

  if (!newId) throw new Error('project insert failed');

  // Patch template path with PM/AM (function only sets a subset)
  if (templateId) {
    await db.execute(sql`
      UPDATE projects SET
        title_ar = ${titleAr},
        description = ${description},
        agency_id = ${agencyId ? sql`${agencyId}::uuid` : sql`NULL`},
        project_manager_id = ${pmId ? sql`${pmId}::uuid` : sql`NULL`},
        account_manager_id = ${amId ? sql`${amId}::uuid` : sql`NULL`},
        production_manager_id = ${productionManagerId ? sql`${productionManagerId}::uuid` : sql`NULL`},
        contracted_value_sar = ${budgetSar ? sql`${budgetSar}::numeric` : sql`NULL`},
        delivery_due_at = ${deliveryDueAt ? sql`${deliveryDueAt}::timestamptz` : sql`NULL`},
        shoot_starts_at = ${shootStartsAt ? sql`${shootStartsAt}::timestamptz` : sql`NULL`},
        shoot_ends_at = ${shootEndsAt ? sql`${shootEndsAt}::timestamptz` : sql`NULL`},
        custom_fields = COALESCE(custom_fields, '{}'::jsonb) || ${JSON.stringify(customFields)}::jsonb
      WHERE id = ${newId}::uuid
    `);
  }

  // ── Brief row (if there was source text) ─────────────────────────────
  if (sourceText) {
    await db.execute(sql`
      INSERT INTO briefs (
        project_id, version, source_text, parsed_summary,
        parsed_languages, parsed_budget_sar, parsed_shoot_date,
        completeness_score, missing_fields, created_by
      ) VALUES (
        ${newId}::uuid, 1, ${sourceText}, ${parsedSummary},
        string_to_array(NULLIF(${languagesCsv}, ''), ','),
        ${budgetSar ? sql`${budgetSar}::numeric` : sql`NULL`},
        ${shootStartsAt ? sql`${shootStartsAt}::timestamptz` : sql`NULL`},
        ${completeness},
        string_to_array(NULLIF(${missingFields}, ''), ','),
        ${actor?.id ? sql`${actor.id}::uuid` : sql`NULL`}
      )
    `);
  }

  // ── Deliverables (one default group per format kind) ─────────────────
  if (deliverablesArr.length > 0) {
    const byFormat = new Map<string, typeof deliverablesArr>();
    for (const d of deliverablesArr) {
      const k = d.format || 'other';
      if (!byFormat.has(k)) byFormat.set(k, []);
      byFormat.get(k)!.push(d);
    }
    for (const [fmt, items] of byFormat.entries()) {
      const groupName =
        fmt === 'reel' ? 'ريلز' :
        fmt === 'short' ? 'فيديوهات قصيرة' :
        fmt === 'long' ? 'فيديوهات طويلة' :
        fmt === 'photo' ? 'صور' :
        fmt === 'print' ? 'طباعة' : 'مخرجات أخرى';
      const groupRes = await db.execute<{ id: string }>(sql`
        INSERT INTO deliverable_groups (project_id, name_ar, kind)
        VALUES (${newId}::uuid, ${groupName}, ${fmt})
        RETURNING id::text AS id
      `);
      const groupId = (groupRes as unknown as Array<{ id: string }>)[0]?.id;
      if (!groupId) continue;

      // Expand by count
      let n = 1;
      for (const item of items) {
        for (let i = 0; i < item.count; i++) {
          const itemNum = `${fmt.toUpperCase()}-${String(n++).padStart(2, '0')}`;
          const titleStr = `${item.aspect_ratio}${item.duration_sec ? ` · ${item.duration_sec}s` : ''}${item.platform ? ` · ${item.platform}` : ''}`;
          await db.execute(sql`
            INSERT INTO deliverables (
              group_id, project_id, item_number, title, status, position
            ) VALUES (
              ${groupId}::uuid, ${newId}::uuid,
              ${itemNum}, ${titleStr}, 'draft'::deliverable_status, ${n}
            )
          `);
        }
      }
    }
  }

  // ── Crew assignments (inline) ─────────────────────────────────────────
  for (const c of crewArr) {
    if (!c.profile_id || !c.role) continue;
    try {
      await db.execute(sql`
        INSERT INTO project_assignments (
          project_id, profile_id, role, created_by
        ) VALUES (
          ${newId}::uuid, ${c.profile_id}::uuid,
          ${c.role}::project_assignment_role,
          ${actor?.id ? sql`${actor.id}::uuid` : sql`NULL`}
        )
      `);
    } catch {
      // Skip invalid role (FK / enum mismatch)
    }
  }

  await writeActivity({
    actorId: actor?.id ?? null,
    entityType: 'project',
    entityId: newId,
    projectId: newId,
    action: 'project_created',
    summaryAr: `أُنشئ مشروع جديد: ${titleAr ?? title}`,
    summaryEn: `New project created: ${title}`,
    metadata: { project_type: projectType, from_template: !!templateId },
  });

  redirect(`/projects/${newId}`);
}
