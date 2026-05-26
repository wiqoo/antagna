'use server';

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { requirePermissionAction } from '@/lib/authz';

/**
 * Gate every automation write on `automation.manage` (A1 RBAC) + set the audit
 * actor. The workers read alert_rules / kpi_definitions every run, so edits here
 * take effect with no redeploy. `kpi_definitions.compute_sql` is intentionally
 * NOT editable here — it is executed SQL (injection risk), kept code-managed.
 */
async function guard(): Promise<string> {
  const pid = await requirePermissionAction('automation.manage');
  await db.execute(sql`SELECT set_config('app.acting_as', ${pid}, true)`);
  return pid;
}

export async function toggleAlertRule(ruleId: string) {
  await guard();
  await db.execute(sql`
    UPDATE alert_rules SET active = NOT active, updated_at = now()
    WHERE id = ${ruleId}::uuid
  `);
  revalidatePath('/admin');
  revalidatePath('/admin/automation');
}

export async function updateAlertCooldown(formData: FormData) {
  await guard();
  const ruleId = formData.get('ruleId')?.toString();
  const minutes = Number(formData.get('cooldownMinutes') ?? 60);
  if (!ruleId || Number.isNaN(minutes)) return;
  await db.execute(sql`
    UPDATE alert_rules
    SET cooldown_minutes = ${minutes}::int, updated_at = now()
    WHERE id = ${ruleId}::uuid
  `);
  revalidatePath('/admin');
  revalidatePath('/admin/automation');
}

export async function toggleKpi(key: string) {
  await guard();
  await db.execute(sql`
    UPDATE kpi_definitions SET active = NOT active WHERE key = ${key}
  `);
  revalidatePath('/admin');
  revalidatePath('/admin/automation');
  revalidatePath('/kpis');
}

/** Full alert-rule edit: labels, description, recipients, cooldown, trigger_spec, active. */
export async function updateAlertRule(input: {
  id: string;
  nameAr: string;
  nameEn?: string | null;
  description?: string | null;
  recipientStrategy: string;
  cooldownMinutes: number;
  triggerSpec: string; // JSON text from the editor
  active: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  await guard();
  if (!input.nameAr.trim()) return { ok: false, error: 'الاسم مطلوب' };
  let spec: unknown;
  try {
    spec = JSON.parse(input.triggerSpec);
  } catch {
    return { ok: false, error: 'حقل trigger_spec ليس JSON صالحاً' };
  }
  const cd = Number.isFinite(input.cooldownMinutes)
    ? Math.max(0, Math.trunc(input.cooldownMinutes))
    : 60;
  await db.execute(sql`
    UPDATE alert_rules SET
      name_ar = ${input.nameAr.trim()},
      name_en = ${input.nameEn?.trim() || null},
      description = ${input.description?.trim() || null},
      recipient_strategy = ${input.recipientStrategy.trim()},
      cooldown_minutes = ${cd},
      trigger_spec = ${JSON.stringify(spec)}::jsonb,
      active = ${input.active},
      updated_at = now()
    WHERE id = ${input.id}::uuid
  `);
  revalidatePath('/admin/automation');
  revalidatePath('/admin');
  return { ok: true };
}

/** KPI threshold + label edit. compute_sql stays code-managed (NOT editable). */
export async function updateKpiDefinition(input: {
  key: string;
  nameAr: string;
  nameEn?: string | null;
  thresholdGreen: number | null;
  thresholdAmber: number | null;
  active: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  await guard();
  if (!input.nameAr.trim()) return { ok: false, error: 'الاسم مطلوب' };
  await db.execute(sql`
    UPDATE kpi_definitions SET
      name_ar = ${input.nameAr.trim()},
      name_en = ${input.nameEn?.trim() || null},
      threshold_green = ${input.thresholdGreen},
      threshold_amber = ${input.thresholdAmber},
      active = ${input.active}
    WHERE key = ${input.key}
  `);
  revalidatePath('/admin/automation');
  revalidatePath('/admin');
  revalidatePath('/kpis');
  return { ok: true };
}
