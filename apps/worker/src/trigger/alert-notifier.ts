/**
 * Cross-cutting — alert notifier.
 *
 * Walks `alert_fires` that haven't been notified yet (last hour), resolves each
 * rule's `recipient_strategy` to profiles, and POSTs each to /api/internal/notify
 * with event = on_alert. The web's notify() fans out to in-app/email/WhatsApp per
 * the recipient's prefs + ui_language.
 *
 * Recipient strategies resolve in three lanes:
 *   - role-based     (pm/am/gm/managers/all/…) → ROLE_MAP → profiles.role
 *   - position-based (production_team, capability:*) → position_key + overrides
 *   - entity-scoped  (assignee) → the firing entity's assigned profile
 * Anything that resolves to zero recipients falls back to FALLBACK_ROLES so an
 * alert is never silently dropped (battery/maintenance alerts used to map to
 * nobody — production_team / capability:* / assignee had no handling).
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

// ── position-based audiences ─────────────────────────────────────────────────
// The legacy `profiles.role` is too coarse for production/equipment targeting:
// every shooter/editor/tech carries role='user'. Real targeting lives in
// `position_key` (+ user_position_overrides — D-037/D-041). These audiences
// resolve against positions, not roles.
//
//   - production_team        → the field crew (videographers/editors/etc.)
//   - capability:<name>      → mapped to the positions that own that capability;
//                              unknown capabilities fall back (see FALLBACK_ROLES)
const PRODUCTION_POSITIONS = [
  'production_director',
  'videographer',
  'video_editor',
  'photo_editor',
  'equipment_technician',
];

// `capability:*` strings seeded in alert_rules (e.g. 'capability:equipment_manager').
// Maps the capability suffix → positions that should receive it.
const CAPABILITY_POSITION_MAP: Record<string, string[]> = {
  equipment_manager: ['equipment_technician', 'production_director'],
};

// Audiences that resolve to a profile *via the firing entity* rather than a
// static role/position list. Handled per-fire (see resolveAssignee).
const ENTITY_SCOPED_AUDIENCES = new Set(['assignee']);

// Last-resort recipients so an alert is NEVER silently dropped. Used when an
// audience can't be resolved (unknown strategy, or an entity-scoped audience
// whose entity has no assignee).
const FALLBACK_ROLES = ['general_manager', 'system_admin'];

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

  // ── classify each fire's recipient strategy ──────────────────────────────
  // Three resolution lanes:
  //   1. role-based   → ROLE_MAP → profiles.role
  //   2. position-based→ production_team / capability:* → position_key (+ overrides)
  //   3. entity-scoped → 'assignee' → the firing entity's assigned profile
  // Anything we can't classify falls back to FALLBACK_ROLES so it's never
  // silently dropped.
  const wantedRoles = new Set<string>();
  const wantedPositions = new Set<string>();

  const strategyFor = (f: AlertFire) => f.recipientStrategy ?? 'managers';
  // Returns the position list for a position-based strategy, or null if the
  // strategy isn't position-based.
  const positionsForStrategy = (strategy: string): string[] | null => {
    if (strategy === 'production_team') return PRODUCTION_POSITIONS;
    if (strategy.startsWith('capability:')) {
      const cap = strategy.slice('capability:'.length);
      return CAPABILITY_POSITION_MAP[cap] ?? null; // null → unknown capability
    }
    return null;
  };

  for (const f of fires) {
    const strategy = strategyFor(f);
    if (ROLE_MAP[strategy]) {
      ROLE_MAP[strategy]!.forEach((r) => wantedRoles.add(r));
      continue;
    }
    const positions = positionsForStrategy(strategy);
    if (positions) {
      positions.forEach((p) => wantedPositions.add(p));
      continue;
    }
    if (ENTITY_SCOPED_AUDIENCES.has(strategy)) {
      // Resolved per-fire below; may still need fallback if no assignee found.
      continue;
    }
    // Unknown strategy (incl. unknown capability:*) → fallback so it's notified.
    console.warn(
      `[alert-notifier] unknown recipient_strategy "${strategy}" for rule "${f.ruleKey}" (fire ${f.id}); falling back to ${FALLBACK_ROLES.join('/')}`,
    );
  }

  const profilesRows =
    wantedRoles.size === 0
      ? []
      : ((await db.execute(sql`
          SELECT id::text AS id, role::text AS role
          FROM profiles
          WHERE status = 'active' AND role::text = ANY(${Array.from(wantedRoles)}::text[])
        `)) as unknown as { id: string; role: string }[]);
  const byRole = new Map<string, string[]>();
  for (const p of profilesRows) {
    const arr = byRole.get(p.role) ?? [];
    arr.push(p.id);
    byRole.set(p.role, arr);
  }

  // Fallback roster — loaded once, permissively. Used whenever a fire resolves
  // to zero recipients (unknown strategy, assignee-less entity, or a position
  // with no holders). Deliberately NOT gated on status='active': pre-launch the
  // team is seeded 'invited', and an alert must still reach a manager rather
  // than vanish. Excludes only terminated/archived profiles.
  const fallbackRows = (await db.execute(sql`
    SELECT id::text AS id
    FROM profiles
    WHERE role::text = ANY(${FALLBACK_ROLES}::text[])
      AND status <> 'terminated'
      AND archived_at IS NULL
  `)) as unknown as { id: string }[];
  const fallbackIds = fallbackRows.map((r) => r.id);

  // Position-based audiences resolve via the profile's primary position_key OR
  // any active multi-hat override (user_position_overrides) — matching how
  // has_permission() unions positions (D-037/D-041). A profile can map to more
  // than one wanted position, so we emit (profile, position) pairs.
  const byPosition = new Map<string, string[]>();
  if (wantedPositions.size > 0) {
    const wanted = Array.from(wantedPositions);
    const positionRows = (await db.execute(sql`
      SELECT DISTINCT keys.pk AS position_key, p.id::text AS id
      FROM profiles p
      CROSS JOIN LATERAL (
        SELECT p.position_key AS pk
        WHERE p.position_key IS NOT NULL
        UNION
        SELECT upo.position_key
        FROM user_position_overrides upo
        WHERE upo.profile_id = p.id
          AND (upo.expires_at IS NULL OR upo.expires_at > now())
      ) keys
      WHERE p.status = 'active'
        AND keys.pk = ANY(${wanted}::text[])
    `)) as unknown as { id: string; position_key: string }[];
    for (const p of positionRows) {
      const arr = byPosition.get(p.position_key) ?? [];
      arr.push(p.id);
      byPosition.set(p.position_key, arr);
    }
  }

  // Resolve the 'assignee' audience for a single fire from its entity. Returns
  // the assigned profile id, or null if the entity has no assignee.
  const resolveAssignee = async (f: AlertFire): Promise<string | null> => {
    if (!f.entityId) return null;
    let row: { id: string }[] = [];
    if (f.entityType === 'lead') {
      row = (await db.execute(sql`
        SELECT assigned_to_profile_id::text AS id
        FROM leads
        WHERE id = ${f.entityId}::uuid AND assigned_to_profile_id IS NOT NULL
      `)) as unknown as { id: string }[];
    } else if (f.entityType === 'email_thread' || f.entityType === 'thread') {
      row = (await db.execute(sql`
        SELECT assigned_profile_id::text AS id
        FROM email_threads
        WHERE id = ${f.entityId}::uuid AND assigned_profile_id IS NOT NULL
      `)) as unknown as { id: string }[];
    } else if (f.entityType === 'equipment') {
      // Assignee of a checked-out unit = whoever holds the active reservation.
      row = (await db.execute(sql`
        SELECT reserved_by_id::text AS id
        FROM equipment_reservations
        WHERE equipment_id = ${f.entityId}::uuid
          AND status = 'checked_out'
          AND reserved_by_id IS NOT NULL
        ORDER BY starts_at DESC
        LIMIT 1
      `)) as unknown as { id: string }[];
    }
    return row[0]?.id ?? null;
  };

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
    const strategy = strategyFor(f);
    const recipientIds = new Set<string>();

    if (ROLE_MAP[strategy]) {
      for (const r of ROLE_MAP[strategy]!) for (const id of byRole.get(r) ?? []) recipientIds.add(id);
    } else {
      const positions = positionsForStrategy(strategy);
      if (positions) {
        for (const pos of positions) for (const id of byPosition.get(pos) ?? []) recipientIds.add(id);
      } else if (ENTITY_SCOPED_AUDIENCES.has(strategy)) {
        const assigneeId = await resolveAssignee(f);
        if (assigneeId) recipientIds.add(assigneeId);
      }
    }

    // Never drop an alert: if nothing resolved (unknown strategy, position with
    // no holders, or an assignee-less entity), notify the fallback roster.
    if (recipientIds.size === 0) {
      console.warn(
        `[alert-notifier] no recipients resolved for rule "${f.ruleKey}" strategy "${strategy}" (fire ${f.id}); using fallback ${FALLBACK_ROLES.join('/')}`,
      );
      for (const id of fallbackIds) recipientIds.add(id);
    }

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
