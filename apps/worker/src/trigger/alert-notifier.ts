/**
 * Cross-cutting — alert notifier.
 *
 * Walks `alert_fires` that haven't been notified yet (last hour), maps each
 * rule's `recipient_strategy` (role shorthand) to active profiles, and POSTs
 * each to /api/internal/notify with event = on_alert. The web's notify() fans
 * out to in-app/email/WhatsApp per the recipient's prefs + ui_language.
 *
 * Piggybacked on alert-scanner (5-min cadence) — see index.ts. Stays under
 * the Trigger.dev Pro 10-schedule cap.
 */
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';

const PER_RUN_LIMIT = 50;

const ROLE_MAP: Record<string, string[]> = {
  pm: ['project_manager'],
  am: ['account_manager'],
  gm: ['general_manager'],
  hr: ['hr'],
  finance: ['finance'],
  admin: ['system_admin'],
  pm_am: ['project_manager', 'account_manager'],
  managers: ['project_manager', 'account_manager', 'general_manager'],
  all: [
    'project_manager',
    'account_manager',
    'general_manager',
    'hr',
    'finance',
    'system_admin',
    'user',
  ],
};

type AlertFire = {
  id: string;
  ruleKey: string;
  nameAr: string;
  nameEn: string | null;
  entityType: string | null;
  entityId: string | null;
  recipientStrategy: string | null;
};

export async function runAlertNotifier(): Promise<
  { items: number; recipients: number; fanned: number } | { skipped: string }
> {
  const baseUrl = process.env.ANTAGNA_BASE_URL;
  const cronSecret = process.env.CRON_SECRET;
  if (!baseUrl || !cronSecret) return { skipped: 'env_missing' };

  const fires = (await db.execute(sql`
    SELECT af.id::text AS id,
           af.rule_key AS "ruleKey",
           ar.name_ar AS "nameAr",
           ar.name_en AS "nameEn",
           af.entity_type AS "entityType",
           af.entity_id::text AS "entityId",
           ar.recipient_strategy AS "recipientStrategy"
    FROM alert_fires af
    JOIN alert_rules ar ON ar.key = af.rule_key AND ar.active = true
    WHERE af.fired_at >= now() - interval '1 hour'
      AND (af.notified_profile_ids IS NULL OR af.notified_profile_ids = '{}')
    ORDER BY af.fired_at DESC
    LIMIT ${PER_RUN_LIMIT}
  `)) as unknown as AlertFire[];

  if (fires.length === 0) return { items: 0, recipients: 0, fanned: 0 };

  // Collect every role we need across all fires in one trip.
  const wantedRoles = new Set<string>();
  for (const f of fires) {
    const roles = ROLE_MAP[f.recipientStrategy ?? 'managers'] ?? ROLE_MAP.managers!;
    roles.forEach((r) => wantedRoles.add(r));
  }
  const profilesRows = (await db.execute(sql`
    SELECT id::text AS id, role::text AS role
    FROM profiles
    WHERE active = true AND role::text = ANY(${Array.from(wantedRoles)}::text[])
  `)) as unknown as { id: string; role: string }[];
  const byRole = new Map<string, string[]>();
  for (const p of profilesRows) {
    const arr = byRole.get(p.role) ?? [];
    arr.push(p.id);
    byRole.set(p.role, arr);
  }

  const items: Array<{
    recipientId: string;
    event: string;
    content: { ar: { title: string; body?: string }; en: { title: string; body?: string } };
    linkUrl?: string;
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  }> = [];
  const notifiedByFire = new Map<string, Set<string>>();
  for (const f of fires) {
    const roles = ROLE_MAP[f.recipientStrategy ?? 'managers'] ?? ROLE_MAP.managers!;
    const recipientIds = new Set<string>();
    for (const r of roles) for (const id of byRole.get(r) ?? []) recipientIds.add(id);
    notifiedByFire.set(f.id, recipientIds);

    const linkUrl =
      f.entityType === 'project' && f.entityId
        ? `/projects/${f.entityId}`
        : f.entityType === 'invoice' && f.entityId
          ? `/clients` // no invoice detail yet
          : `/inbox`;

    for (const rid of recipientIds) {
      items.push({
        recipientId: rid,
        event: 'on_alert',
        content: {
          ar: { title: f.nameAr, body: `قاعدة: ${f.ruleKey}` },
          en: { title: f.nameEn ?? f.nameAr, body: `Rule: ${f.ruleKey}` },
        },
        linkUrl,
        entityType: 'alert_fire',
        entityId: f.id,
        metadata: { ruleKey: f.ruleKey, entityType: f.entityType, entityId: f.entityId },
      });
    }
  }

  if (items.length === 0) return { items: 0, recipients: 0, fanned: 0 };

  const r = await fetch(`${baseUrl}/api/internal/notify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-cron-secret': cronSecret },
    body: JSON.stringify({ items }),
  });
  if (!r.ok) throw new Error(`notify ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const payload = (await r.json()) as { sent?: number };

  // Mark each fire as notified.
  for (const [fireId, ids] of notifiedByFire.entries()) {
    if (ids.size === 0) continue;
    const arr = Array.from(ids);
    await db.execute(sql`
      UPDATE alert_fires
      SET notified_profile_ids = ${arr}::uuid[]
      WHERE id = ${fireId}::uuid
    `);
  }

  return { items: fires.length, recipients: items.length, fanned: payload.sent ?? 0 };
}
