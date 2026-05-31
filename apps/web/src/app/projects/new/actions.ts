'use server';

import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db, withActor } from '@antagna/db';
import { getAnthropic, ANTHROPIC_MODELS, recordUsage, assertAiBudget } from '@antagna/ai';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { writeActivity } from '@/lib/activity';
import { requirePermissionAction } from '@/lib/authz';
import { parseDate } from '@/lib/parse';
import { ensureProjectFolderTree } from '@/lib/drive';

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
  const actorId = await requirePermissionAction('brief.parse_ai');
  if (!rawText.trim()) return { ok: false, error: 'empty' };
  await assertAiBudget({ userId: actorId, feature: 'brief_parse_rich' });
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

/**
 * Same brief extraction as parseBriefRich, but from UPLOADED FILES — images go
 * to Claude as vision blocks, PDFs as document blocks (Claude reads both
 * natively, no server-side text extraction needed). Up to 8 files.
 */
export async function parseBriefFromFiles(
  files: { name: string; type: string; dataBase64: string }[],
): Promise<{ ok: true; parsed: ParsedBrief } | { ok: false; error: string }> {
  const actorId = await requirePermissionAction('brief.parse_ai');
  if (!files?.length) return { ok: false, error: 'empty' };
  await assertAiBudget({ userId: actorId, feature: 'brief_parse_files' });
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const today = new Date().toISOString().slice(0, 10);
  const system = PARSE_SYSTEM.replace('{{TODAY}}', today);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blocks: any[] = [];
  for (const f of files.slice(0, 8)) {
    if (f.type.startsWith('image/')) {
      blocks.push({ type: 'image', source: { type: 'base64', media_type: f.type, data: f.dataBase64 } });
    } else if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
      blocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.dataBase64 } });
    }
  }
  if (!blocks.length) return { ok: false, error: 'no_supported_files' };
  blocks.push({ type: 'text', text: 'استخرج بيانات البريف من الملفات المرفقة (صور و/أو مستندات). أخرج JSON فقط حسب الـ schema.' });

  try {
    const anthropic = getAnthropic();
    const resp = await anthropic.messages.create({
      model: ANTHROPIC_MODELS.sonnet,
      max_tokens: 2000,
      system,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: [{ role: 'user', content: blocks as any }],
    });
    await recordUsage({
      feature: 'brief_parse_files',
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
  const pid = await requirePermissionAction('project.create');

  // ── Basics ─────────────────────────────────────────────────────────────
  const clientId = formData.get('clientId')?.toString();
  const title = formData.get('title')?.toString() || 'Untitled';
  const titleAr = formData.get('titleAr')?.toString() || null;
  const description = formData.get('description')?.toString() || null;
  const projectType = (formData.get('projectType')?.toString() ?? 'shoot') as
    | 'shoot' | 'edit_only' | 'live_coverage' | 'content_creation' | 'consulting' | 'other';
  // Sub-brand: Volt (production) vs محتوى أبو لوكا — drives the "is_abu_luka_content" flag.
  const isAbuLuka = formData.get('forBrandUnit')?.toString() === 'abu_luka';

  if (!clientId) throw new Error('clientId required');

  // ── Section 1: Client & Commercial ────────────────────────────────────
  const agencyId = formData.get('agencyId')?.toString() || null;
  const quoteNumber = formData.get('quoteNumber')?.toString().trim() || null;

  // ── Section 2: Creative ───────────────────────────────────────────────
  const objective = formData.get('objective')?.toString() || null;
  const toneStyle = formData.get('toneStyle')?.toString() || null;

  // ── Section 3: Logistics ──────────────────────────────────────────────
  const shootStartsAt = parseDate(formData.get('shootStartsAt'));
  const shootEndsAt = parseDate(formData.get('shootEndsAt'));
  const deliveryDueAt = parseDate(formData.get('deliveryDueAt'));

  const locationsJson = formData.get('locations')?.toString() || '[]';
  const clientAssetsCsv = formData.get('clientAssetsProvided')?.toString() || '';

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
  if (toneStyle) customFields.tone_style = toneStyle;
  if (quoteNumber) customFields.quote_number = quoteNumber;
  if (clientAssetsCsv) customFields.client_assets_provided = clientAssetsCsv.split(',').map((s) => s.trim()).filter(Boolean);
  if (locationsJson && locationsJson !== '[]') {
    try { customFields.locations = JSON.parse(locationsJson); } catch {}
  }

  // ════════════════════════════════════════════════════════════════════════
  // INSERT — one atomic transaction (audit actor set + all rows). A mid-flight
  // error rolls back the whole thing, so there's no orphan project.
  // ════════════════════════════════════════════════════════════════════════
  const newId = await withActor(pid, async (tx) => {
    let id = '';

    {
      const res = await tx.execute<{ id: string }>(sql`
        INSERT INTO projects (
          title, title_ar, description, client_id, agency_id,
          project_type, stage, is_abu_luka_content,
          project_manager_id, account_manager_id, production_manager_id,
          delivery_due_at, shoot_starts_at, shoot_ends_at,
          brief_received_at,
          custom_fields,
          created_by
        ) VALUES (
          ${title}, ${titleAr}, ${description},
          ${clientId}::uuid,
          ${agencyId ? sql`${agencyId}::uuid` : sql`NULL`},
          ${projectType}::project_type, 'brief'::project_stage, ${isAbuLuka},
          ${pmId ? sql`${pmId}::uuid` : sql`NULL`},
          ${amId ? sql`${amId}::uuid` : sql`NULL`},
          ${productionManagerId ? sql`${productionManagerId}::uuid` : sql`NULL`},
          ${deliveryDueAt ? sql`${deliveryDueAt}::timestamptz` : sql`NULL`},
          ${shootStartsAt ? sql`${shootStartsAt}::timestamptz` : sql`NULL`},
          ${shootEndsAt ? sql`${shootEndsAt}::timestamptz` : sql`NULL`},
          ${sourceText ? sql`now()` : sql`NULL`},
          ${JSON.stringify(customFields)}::jsonb,
          ${pid}::uuid
        )
        RETURNING id::text AS id
      `);
      id = (res as unknown as Array<{ id: string }>)[0]?.id ?? '';
    }

    if (!id) throw new Error('project insert failed');

    // ── Brief row (if there was source text) ─────────────────────────────
    if (sourceText) {
      await tx.execute(sql`
        INSERT INTO briefs (
          project_id, version, source_text, parsed_summary,
          parsed_languages, parsed_budget_sar, parsed_shoot_date,
          completeness_score, missing_fields, created_by
        ) VALUES (
          ${id}::uuid, 1, ${sourceText}, ${parsedSummary},
          NULL,
          NULL,
          ${shootStartsAt ? sql`${shootStartsAt}::timestamptz` : sql`NULL`},
          ${completeness},
          string_to_array(NULLIF(${missingFields}, ''), ','),
          ${pid}::uuid
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
        const groupRes = await tx.execute<{ id: string }>(sql`
          INSERT INTO deliverable_groups (project_id, name_ar, kind)
          VALUES (${id}::uuid, ${groupName}, ${fmt})
          RETURNING id::text AS id
        `);
        const groupId = (groupRes as unknown as Array<{ id: string }>)[0]?.id;
        if (!groupId) continue;

        // One deliverable per row (quantity field removed). For photo formats
        // the duration value carries a photo count; for video it's an average
        // length in seconds.
        let n = 1;
        for (const item of items) {
          const itemNum = `${fmt.toUpperCase()}-${String(n).padStart(2, '0')}`;
          const isPhoto = fmt === 'photo' || fmt === 'image' || fmt === 'صور';
          const detail = item.duration_sec
            ? isPhoto
              ? ` · ${item.duration_sec} صورة`
              : ` · ${item.duration_sec}s`
            : '';
          const titleStr = `${item.aspect_ratio}${detail}`;
          await tx.execute(sql`
            INSERT INTO deliverables (
              group_id, project_id, item_number, title, status, position
            ) VALUES (
              ${groupId}::uuid, ${id}::uuid,
              ${itemNum}, ${titleStr}, 'draft'::deliverable_status, ${n}
            )
          `);
          n++;
        }
      }
    }

    // ── Crew assignments (inline) ─────────────────────────────────────────
    // Each insert runs in its own SAVEPOINT so an invalid role/FK is skipped
    // without aborting the surrounding transaction.
    for (const c of crewArr) {
      if (!c.profile_id || !c.role) continue;
      try {
        await tx.transaction(async (sp) => {
          await sp.execute(sql`
            INSERT INTO project_assignments (
              project_id, profile_id, role, created_by
            ) VALUES (
              ${id}::uuid, ${c.profile_id}::uuid,
              ${c.role}::project_assignment_role,
              ${pid}::uuid
            )
          `);
        });
      } catch {
        // Skip invalid role (FK / enum mismatch)
      }
    }

    return id;
  });

  // ════════════════════════════════════════════════════════════════════════
  // DRIVE — create the project folder tree NOW (synchronously) so it appears
  // at creation rather than waiting for the ~2-min idempotent cron backstop.
  // The project's code is generated by the DB on insert, so we SELECT it back
  // (plus the client code + creation year). Best-effort: a Drive outage must
  // NEVER block project creation — any error here is swallowed and the cron
  // (POST /api/integrations/drive/scan) remains the backstop.
  // ════════════════════════════════════════════════════════════════════════
  try {
    const metaRes = await db.execute<{
      code: string;
      title: string;
      client_code: string | null;
      created_year: number;
    }>(sql`
      SELECT
        p.code,
        p.title,
        c.code AS client_code,
        EXTRACT(YEAR FROM p.created_at)::int AS created_year
      FROM projects p
      LEFT JOIN clients c ON c.id = p.client_id
      WHERE p.id = ${newId}::uuid
    `);
    const meta = (metaRes as unknown as Array<{
      code: string;
      title: string;
      client_code: string | null;
      created_year: number;
    }>)[0];

    if (meta?.code) {
      const tree = await ensureProjectFolderTree({
        projectCode: meta.code,
        projectTitle: meta.title ?? title,
        clientCode: meta.client_code,
        year: meta.created_year ?? new Date().getFullYear(),
      });
      await db.execute(sql`
        UPDATE projects
        SET drive_folder_id = ${tree.projectFolderId},
            drive_folder_url = ${tree.projectFolderUrl},
            updated_at = now()
        WHERE id = ${newId}::uuid
      `);
    }
  } catch {
    // Drive outage / API error — swallow. The idempotent cron backstop
    // (POST /api/integrations/drive/scan) will create the folder later.
  }

  await writeActivity({
    actorId: pid,
    entityType: 'project',
    entityId: newId,
    projectId: newId,
    action: 'project_created',
    summaryAr: `أُنشئ مشروع جديد: ${titleAr ?? title}`,
    summaryEn: `New project created: ${title}`,
    metadata: { project_type: projectType },
  });

  redirect(`/projects/${newId}`);
}
