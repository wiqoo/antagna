'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { withActor, db, dailyTasks } from '@antagna/db';
import { getAnthropic, ANTHROPIC_MODELS, recordUsage, assertAiBudget } from '@antagna/ai';
import { requirePermissionAction } from '@/lib/authz';
import { loadRoutines, riyadhToday, routineSourceKey } from '@/lib/routines';
import { loadJobDescription } from '@/lib/job-descriptions';
import type { RoutineRow } from './routine';

/**
 * Idempotently materialize today's routine for `profileId`'s position. One
 * daily_tasks row per routine item per day, tagged with
 * source_key='routine:<item_key>:<YYYY-MM-DD>'. Re-running the same day is a
 * no-op (only the missing keys are inserted). The DB has no unique index on
 * (owner_id, source_key), so we read the existing keys first and insert the
 * gap — wrapped in withActor so the audit trigger sees the actor.
 *
 * Gated by daily_task.manage_self (every positioned user holds it). Rendered by
 * the My-Day section now merged into /dashboard.
 */
export async function ensureTodayRoutine(
  profileId: string,
  positionKey: string | null | undefined,
): Promise<void> {
  const items = loadRoutines(positionKey);
  if (items.length === 0) return;

  // The page passes the effective profile id and gates impersonation itself.
  // requirePermissionAction resolves the same effective profile as the acting
  // principal; the equality check is a defensive belt-and-braces so we never
  // write a routine row onto a profile other than the one acting.
  const actorId = await requirePermissionAction('daily_task.manage_self');
  if (actorId !== profileId) return;

  const day = riyadhToday();
  const wantKeys = items.map((it) => routineSourceKey(it.key, day));

  const existing = await db
    .select({ sourceKey: dailyTasks.sourceKey })
    .from(dailyTasks)
    .where(and(eq(dailyTasks.ownerId, actorId), inArray(dailyTasks.sourceKey, wantKeys)));
  const have = new Set(existing.map((r) => r.sourceKey));

  const toInsert = items
    .filter((it) => !have.has(routineSourceKey(it.key, day)))
    .map((it) => ({
      ownerId: actorId,
      title: it.titleAr,
      sourceKey: routineSourceKey(it.key, day),
      // Routine items live for the day; due at end of the Riyadh day.
      dueAt: new Date(`${day}T23:59:59+03:00`),
    }));

  if (toInsert.length === 0) return;

  await withActor(actorId, async (tx) => {
    // ON CONFLICT against the partial unique index (owner_id, source_key) —
    // race-safe if two /dashboard loads materialize the same day concurrently
    // (migration 056). The read above just trims the common no-op case.
    await tx
      .insert(dailyTasks)
      .values(toInsert)
      .onConflictDoNothing({ target: [dailyTasks.ownerId, dailyTasks.sourceKey] });
  });
  // No revalidatePath here: ensureTodayRoutine runs during the /dashboard render
  // (calling revalidatePath mid-render throws "Route used revalidatePath…"). The
  // page reads daily_tasks AFTER this call in the same render, so new rows show
  // immediately. revalidatePath stays in completeTask (a real action).
}

// ── AI daily routine ─────────────────────────────────────────────────────────

/** Real workload signals fed to the AI planner (built by the My-Day section). */
export type RoutineSignals = {
  positionNameAr: string | null;
  shoots: Array<{ label: string; time?: string | null; city?: string | null }>;
  tasksDue: Array<{ title: string; project?: string | null }>;
  dailyDue: Array<{ title: string }>;
  approvals: number;
  threads: Array<{ subject: string | null }>;
};

const ROUTINE_SYSTEM = `أنت مدير مكتب ذكي (chief of staff) لشركة إنتاج فيديو سعودية "Volt Production".
من وصف وظيفة الشخص + مسؤولياته + مؤشرات أدائه (KPIs) + أحمال عمله الفعلية اليوم، اكتب له **قائمة تركيز يوميّة** مرتّبة بالأولوية (3-6 بنود) لأهمّ ما يجب إنجازه اليوم.
أخرج JSON صارم فقط:
{ "items": [ { "title_ar": "إجراء واضح بصيغة الأمر", "when": "morning" | "midday" | "evening" | "anytime" } ] }
قواعد:
- بالعربية الفصحى، صيغة أمر، **ملموسة ومحدّدة**: أشِر للمشاريع/المحادثات/الموافقات الفعلية المذكورة بالاسم/الرقم حين تتوفّر.
- رتّب حسب الأولوية والأثر على المؤشرات (KPIs) والمسؤوليات.
- لا عموميات مثل "راجع البريد"؛ اربط كل بند بعمل حقيقي.
- 3-6 بنود فقط. لا نصّ خارج الـ JSON.`;

function buildRoutineContext(
  positionKey: string | null | undefined,
  signals: RoutineSignals,
): string {
  const jd = loadJobDescription(positionKey);
  const lines: string[] = [];
  if (jd) {
    lines.push(`الوظيفة: ${jd.titleAr}`);
    if (jd.missionAr) lines.push(`المهمة: ${jd.missionAr}`);
    if (jd.responsibilities.length) {
      lines.push('المسؤوليات:');
      for (const r of jd.responsibilities.slice(0, 8)) lines.push(`- ${r.titleAr}`);
    }
    if (jd.kpis.length) {
      lines.push('مؤشرات الأداء:');
      for (const k of jd.kpis.slice(0, 8)) lines.push(`- ${k.titleAr}`);
    }
  } else if (signals.positionNameAr) {
    lines.push(`الوظيفة: ${signals.positionNameAr}`);
  }

  lines.push('', 'أحمال اليوم الفعلية:');
  if (signals.shoots.length) {
    lines.push(
      `تصوير اليوم (${signals.shoots.length}): ` +
        signals.shoots
          .map((s) => `${s.label}${s.time ? ` ${s.time}` : ''}${s.city ? ` (${s.city})` : ''}`)
          .join('، '),
    );
  }
  if (signals.tasksDue.length) {
    lines.push(
      `مهام مستحقّة (${signals.tasksDue.length}): ` +
        signals.tasksDue.map((t) => `${t.title}${t.project ? ` [${t.project}]` : ''}`).join('، '),
    );
  }
  if (signals.dailyDue.length) {
    lines.push(`مهام يوميّة مستحقّة (${signals.dailyDue.length}): ` + signals.dailyDue.map((t) => t.title).join('، '));
  }
  if (signals.approvals > 0) lines.push(`موافقات تنتظرك: ${signals.approvals}`);
  if (signals.threads.length) {
    lines.push(
      `محادثات تنتظر ردّك (${signals.threads.length}): ` +
        signals.threads.slice(0, 6).map((t) => t.subject ?? '(بدون عنوان)').join('، '),
    );
  }
  const totalSignals =
    signals.shoots.length + signals.tasksDue.length + signals.dailyDue.length +
    signals.approvals + signals.threads.length;
  if (totalSignals === 0) {
    lines.push('لا أحمال محدّدة اليوم — اقترح أهمّ بنود استباقية حسب مسؤولياته ومؤشراته.');
  }
  lines.push('', 'أخرج خطة اليوم JSON فقط.');
  return lines.join('\n');
}

const VALID_WHEN = new Set(['morning', 'midday', 'evening', 'anytime']);

async function generateAiRoutineItems(
  actorId: string,
  positionKey: string | null | undefined,
  signals: RoutineSignals,
): Promise<Array<{ title_ar: string; when: string }>> {
  await assertAiBudget({ userId: actorId, feature: 'ai_daily_routine' });
  const client = getAnthropic();
  const resp = await client.messages.create({
    model: ANTHROPIC_MODELS.haiku,
    max_tokens: 600,
    system: ROUTINE_SYSTEM,
    messages: [{ role: 'user', content: buildRoutineContext(positionKey, signals) }],
  });
  await recordUsage({
    feature: 'ai_daily_routine',
    model: ANTHROPIC_MODELS.haiku,
    inputTokens: resp.usage.input_tokens ?? 0,
    outputTokens: resp.usage.output_tokens ?? 0,
    userId: actorId,
  });
  const txt = resp.content.find((b) => b.type === 'text');
  const raw = (txt && txt.type === 'text' ? txt.text : '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return [];
  const parsed = JSON.parse(m[0]) as { items?: Array<{ title_ar?: unknown; when?: unknown }> };
  return (parsed.items ?? [])
    .map((it) => ({
      title_ar: String(it.title_ar ?? '').trim(),
      when: VALID_WHEN.has(String(it.when)) ? String(it.when) : 'anytime',
    }))
    .filter((it) => it.title_ar.length > 2)
    .slice(0, 8);
}

/**
 * Build (or read the cached) AI-planned routine for today. Generated ONCE per
 * person per day — materialized into daily_tasks (source_key='ai_routine:<day>:<n>')
 * so it persists, shows on /tasks, and the second load of the day is instant.
 * Falls back to the static routines.yaml list if the AI yields nothing. When an
 * admin is viewing-as someone else, it only READS (never generates/writes).
 */
export async function ensureTodayAiRoutine(
  profileId: string,
  positionKey: string | null | undefined,
  isImpersonating: boolean,
  signals: RoutineSignals,
): Promise<RoutineRow[]> {
  const actorId = await requirePermissionAction('daily_task.manage_self');
  if (actorId !== profileId) return [];
  const day = riyadhToday();
  const prefix = `ai_routine:${day}:`;

  const readRows = async (): Promise<RoutineRow[]> => {
    const rs = await db.execute<{ id: string; title: string; status: string }>(sql`
      SELECT id::text, title, status::text AS status
      FROM daily_tasks
      WHERE owner_id = ${actorId}::uuid AND source_key LIKE ${prefix + '%'}
      ORDER BY source_key
    `);
    return (rs as unknown as Array<{ id: string; title: string; status: string }>).map((r) => ({
      id: r.id,
      title: r.title,
      when: 'anytime' as const,
      done: r.status === 'completed',
    }));
  };

  const cached = await readRows();
  if (cached.length > 0) return cached;
  if (isImpersonating) return [];

  let items: Array<{ title_ar: string; when: string }> = [];
  try {
    items = await generateAiRoutineItems(actorId, positionKey, signals);
  } catch (err) {
    console.error('[ensureTodayAiRoutine] generate', err);
  }
  // Fallback: the static routine so the user is never left with an empty list.
  if (items.length === 0) {
    items = loadRoutines(positionKey).map((it) => ({ title_ar: it.titleAr, when: it.when }));
  }
  if (items.length === 0) return [];

  const toInsert = items.slice(0, 8).map((it, i) => ({
    ownerId: actorId,
    title: it.title_ar.slice(0, 300),
    sourceKey: `${prefix}${i}`,
    dueAt: new Date(`${day}T23:59:59+03:00`),
  }));
  await withActor(actorId, async (tx) => {
    await tx
      .insert(dailyTasks)
      .values(toInsert)
      .onConflictDoNothing({ target: [dailyTasks.ownerId, dailyTasks.sourceKey] });
  });
  return readRows();
}

/**
 * Force a fresh AI plan for today: clear today's ai_routine rows then rebuild.
 * Bound to the "أعد التخطيط" button. Preserves nothing — it's an explicit redo.
 */
export async function regenerateAiRoutine(
  positionKey: string | null | undefined,
  signals: RoutineSignals,
): Promise<{ ok: boolean }> {
  const actorId = await requirePermissionAction('daily_task.manage_self');
  const day = riyadhToday();
  const prefix = `ai_routine:${day}:`;
  await withActor(actorId, async (tx) => {
    await tx.execute(sql`
      DELETE FROM daily_tasks
      WHERE owner_id = ${actorId}::uuid AND source_key LIKE ${prefix + '%'}
    `);
  });
  await ensureTodayAiRoutine(actorId, positionKey, false, signals);
  revalidatePath('/dashboard');
  return { ok: true };
}

/**
 * Toggle a daily task done/undone. Used by the routine checklist (optimistic on
 * the client). Only the owner can toggle their own rows. Returns {ok} so the
 * client island can confirm / roll back.
 */
export async function completeTask(
  taskId: string,
  done: boolean,
): Promise<{ ok: boolean }> {
  const actorId = await requirePermissionAction('daily_task.manage_self');

  await withActor(actorId, async (tx) => {
    await tx
      .update(dailyTasks)
      .set({
        status: done ? 'completed' : 'pending',
        completedAt: done ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(and(eq(dailyTasks.id, taskId), eq(dailyTasks.ownerId, actorId)));
  });

  revalidatePath('/dashboard');
  revalidatePath('/tasks');
  return { ok: true };
}
