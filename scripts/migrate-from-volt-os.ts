/* eslint-disable no-console */
/**
 * Pillar 15 — Pull legacy data from the old Volt OS Supabase project and
 * land it in Antagna-V2's staging tables (legacy_*_import), then map to
 * the canonical schema.
 *
 * Per Mohammed's 2026-05-15 directive: this script is the ONLY thing
 * that touches the legacy DB. The legacy project (`jhfkgmomntkgzzycdbmt`)
 * is hands-off until you run this.
 *
 * Usage:
 *   tsx scripts/migrate-from-volt-os.ts --dry-run
 *   tsx scripts/migrate-from-volt-os.ts --pull-only
 *   tsx scripts/migrate-from-volt-os.ts --map-only
 *   tsx scripts/migrate-from-volt-os.ts            # pull + map
 *
 * Env required:
 *   LEGACY_DATABASE_URL   — postgres://... for the old project
 *   DATABASE_URL          — postgres://... for Antagna-V2 (the new one)
 *
 * Idempotent: every staging insert uses ON CONFLICT (legacy_id) DO NOTHING.
 * Every canonical insert uses code/name uniques to avoid duplicates.
 */
import postgres from 'postgres';
import { config as dotenvConfig } from 'dotenv';

dotenvConfig({ path: '.env' });
dotenvConfig({ path: '.env.local', override: true });

type RunMode = 'dry-run' | 'pull-only' | 'map-only' | 'full';

const args = process.argv.slice(2);
const mode: RunMode = args.includes('--dry-run')
  ? 'dry-run'
  : args.includes('--pull-only')
    ? 'pull-only'
    : args.includes('--map-only')
      ? 'map-only'
      : 'full';

const LEGACY_URL = process.env.LEGACY_DATABASE_URL;
const NEW_URL = process.env.DATABASE_URL;

if (!NEW_URL) {
  console.error('✗ DATABASE_URL not set (Antagna-V2 target)');
  process.exit(1);
}
if (mode !== 'map-only' && !LEGACY_URL) {
  console.error('✗ LEGACY_DATABASE_URL not set (Volt OS source)');
  console.error(
    '  Set it to the read-only connection string for jhfkgmomntkgzzycdbmt',
  );
  process.exit(1);
}

const log = (msg: string) => console.log(`[${new Date().toISOString()}] ${msg}`);

async function main() {
  log(`Migration mode: ${mode}`);
  log('═══════════════════════════════════════════════');

  const target = postgres(NEW_URL!, { prepare: false, max: 5 });

  // Create a migration_runs row to track this attempt.
  const [runRow] = await target<{ id: string }[]>`
    INSERT INTO migration_runs (source, status, dry_run, notes)
    VALUES ('volt_os_legacy', 'running', ${mode === 'dry-run'},
            ${`mode=${mode}, started by script`})
    RETURNING id::text
  `;
  const runId = runRow.id;
  log(`migration_runs id: ${runId}`);

  const rowsRead: Record<string, number> = {};
  const rowsWritten: Record<string, number> = {};
  const rowsSkipped: Record<string, number> = {};

  try {
    // ── Phase 1: PULL into staging ─────────────────────────────────────
    if (mode === 'pull-only' || mode === 'full' || mode === 'dry-run') {
      const source = postgres(LEGACY_URL!, {
        prepare: false,
        max: 5,
        // Read-only — be a polite tenant.
        connection: { application_name: 'antagna_v2_migrator' },
      });

      try {
        log('Phase 1: PULL → staging tables');

        // 1a. Equipment
        log('  → pulling equipment…');
        const eqRows = await source<{ id: string; payload: Record<string, unknown> }[]>`
          SELECT id::text AS id, to_jsonb(equipment.*) AS payload
          FROM equipment
        `.catch((err) => {
          log(`    ⚠ equipment table missing or unreadable: ${err.message}`);
          return [] as Array<{ id: string; payload: Record<string, unknown> }>;
        });
        rowsRead.equipment = eqRows.length;
        if (mode !== 'dry-run' && eqRows.length > 0) {
          for (const r of eqRows) {
            await target`
              INSERT INTO legacy_equipment_import (legacy_id, legacy_payload, map_status)
              VALUES (${r.id}, ${r.payload as unknown as object}, 'pending')
              ON CONFLICT DO NOTHING
            `;
          }
        }
        log(`    read ${eqRows.length} equipment rows`);

        // 1b. Clients
        log('  → pulling clients…');
        const clRows = await source<{ id: string; payload: Record<string, unknown> }[]>`
          SELECT id::text AS id, to_jsonb(clients.*) AS payload
          FROM clients
          WHERE archived_at IS NULL
        `.catch((err) => {
          log(`    ⚠ clients table missing or unreadable: ${err.message}`);
          return [] as Array<{ id: string; payload: Record<string, unknown> }>;
        });
        rowsRead.clients = clRows.length;
        if (mode !== 'dry-run' && clRows.length > 0) {
          for (const r of clRows) {
            await target`
              INSERT INTO legacy_client_import (legacy_id, legacy_payload, map_status)
              VALUES (${r.id}, ${r.payload as unknown as object}, 'pending')
              ON CONFLICT DO NOTHING
            `;
          }
        }
        log(`    read ${clRows.length} client rows`);

        // 1c. Projects (only active)
        log('  → pulling active projects…');
        const prRows = await source<{ id: string; payload: Record<string, unknown> }[]>`
          SELECT id::text AS id, to_jsonb(projects.*) AS payload
          FROM projects
          WHERE stage NOT IN ('archived','lost','cancelled')
        `.catch((err) => {
          log(`    ⚠ projects table missing or unreadable: ${err.message}`);
          return [] as Array<{ id: string; payload: Record<string, unknown> }>;
        });
        rowsRead.projects = prRows.length;
        if (mode !== 'dry-run' && prRows.length > 0) {
          for (const r of prRows) {
            await target`
              INSERT INTO legacy_project_import (legacy_id, legacy_payload, map_status)
              VALUES (${r.id}, ${r.payload as unknown as object}, 'pending')
              ON CONFLICT DO NOTHING
            `;
          }
        }
        log(`    read ${prRows.length} project rows`);
      } finally {
        await source.end({ timeout: 5 });
      }
    }

    // ── Phase 2: MAP staging → canonical ───────────────────────────────
    if (mode === 'map-only' || mode === 'full') {
      log('Phase 2: MAP → canonical schema');

      // 2a. Map clients first (so projects can FK to them)
      log('  → mapping clients…');
      const pendingClients = await target<{
        id: string;
        legacy_id: string | null;
        payload: Record<string, unknown>;
      }[]>`
        SELECT id::text, legacy_id, legacy_payload AS payload
        FROM legacy_client_import
        WHERE map_status = 'pending'
      `;
      for (const c of pendingClients) {
        const p = c.payload;
        const code =
          (p.code as string | undefined) ??
          inferCode((p.name_en ?? p.name_ar ?? p.name) as string | undefined);
        const nameAr =
          (p.name_ar as string | undefined) ??
          (p.name as string | undefined) ??
          'بدون اسم';
        const nameEn = (p.name_en as string | null | undefined) ?? null;
        const clientType =
          ((p.client_type as string) ?? 'brand').toLowerCase() ?? 'brand';

        try {
          const [row] = await target<{ id: string }[]>`
            INSERT INTO clients (code, name_ar, name_en, client_type, country)
            VALUES (${code}, ${nameAr}, ${nameEn},
                    ${normalizeClientType(clientType)}::client_type,
                    ${(p.country as string) ?? 'SA'})
            ON CONFLICT (code) DO UPDATE SET updated_at = now()
            RETURNING id::text
          `;
          await target`
            UPDATE legacy_client_import
            SET new_client_id = ${row.id}::uuid,
                map_status = 'mapped',
                map_notes = ${`mapped to client code=${code}`}
            WHERE id = ${c.id}::uuid
          `;
          rowsWritten.clients = (rowsWritten.clients ?? 0) + 1;
        } catch (err) {
          rowsSkipped.clients = (rowsSkipped.clients ?? 0) + 1;
          await target`
            UPDATE legacy_client_import
            SET map_status = 'failed',
                map_notes = ${err instanceof Error ? err.message : String(err)}
            WHERE id = ${c.id}::uuid
          `;
        }
      }
      log(
        `    mapped ${rowsWritten.clients ?? 0}, skipped ${rowsSkipped.clients ?? 0}`,
      );

      // 2b. Equipment
      log('  → mapping equipment…');
      const pendingEq = await target<{
        id: string;
        legacy_id: string | null;
        payload: Record<string, unknown>;
      }[]>`
        SELECT id::text, legacy_id, legacy_payload AS payload
        FROM legacy_equipment_import
        WHERE map_status = 'pending'
      `;
      for (const e of pendingEq) {
        const p = e.payload;
        const code =
          (p.code as string | undefined) ??
          ((p.serial_number as string | undefined) ?? '').slice(0, 16) ??
          `LEG-${e.legacy_id?.slice(0, 8) ?? Math.random().toString(36).slice(2, 8)}`;
        const category =
          (p.category as string | undefined) ?? 'unknown';
        const model =
          (p.model as string | undefined) ?? (p.name as string | undefined) ?? 'Unknown';
        const manufacturer =
          (p.manufacturer as string | undefined) ??
          (p.brand as string | undefined) ??
          null;
        const insuranceValueSar =
          (p.insurance_value_sar as number | string | null | undefined) ??
          (p.value as number | string | null | undefined) ??
          null;

        try {
          const [row] = await target<{ id: string }[]>`
            INSERT INTO equipment (
              code, category, manufacturer, model,
              serial_number, insurance_value_sar, current_location
            )
            VALUES (
              ${code}, ${category}, ${manufacturer}, ${model},
              ${(p.serial_number as string | null | undefined) ?? null},
              ${insuranceValueSar},
              ${(p.current_location as string | undefined) ?? 'warehouse'}
            )
            ON CONFLICT (code) DO UPDATE SET updated_at = now()
            RETURNING id::text
          `;
          await target`
            UPDATE legacy_equipment_import
            SET new_equipment_id = ${row.id}::uuid,
                map_status = 'mapped'
            WHERE id = ${e.id}::uuid
          `;
          rowsWritten.equipment = (rowsWritten.equipment ?? 0) + 1;
        } catch (err) {
          rowsSkipped.equipment = (rowsSkipped.equipment ?? 0) + 1;
          await target`
            UPDATE legacy_equipment_import
            SET map_status = 'failed',
                map_notes = ${err instanceof Error ? err.message : String(err)}
            WHERE id = ${e.id}::uuid
          `;
        }
      }
      log(
        `    mapped ${rowsWritten.equipment ?? 0}, skipped ${rowsSkipped.equipment ?? 0}`,
      );

      // 2c. Projects
      log('  → mapping projects…');
      const pendingProjects = await target<{
        id: string;
        legacy_id: string | null;
        payload: Record<string, unknown>;
      }[]>`
        SELECT id::text, legacy_id, legacy_payload AS payload
        FROM legacy_project_import
        WHERE map_status = 'pending'
      `;
      for (const pr of pendingProjects) {
        const p = pr.payload;
        const legacyClientId = p.client_id as string | undefined;
        let newClientId: string | null = null;

        if (legacyClientId) {
          const [c] = await target<{ new_client_id: string | null }[]>`
            SELECT new_client_id::text AS new_client_id
            FROM legacy_client_import
            WHERE legacy_id = ${legacyClientId}
          `;
          newClientId = c?.new_client_id ?? null;
        }

        if (!newClientId) {
          rowsSkipped.projects = (rowsSkipped.projects ?? 0) + 1;
          await target`
            UPDATE legacy_project_import
            SET map_status = 'skipped',
                map_notes = 'client FK not found in mapped imports'
            WHERE id = ${pr.id}::uuid
          `;
          continue;
        }

        const title =
          (p.title as string | undefined) ??
          (p.name as string | undefined) ??
          'Untitled (legacy)';
        const titleAr = (p.title_ar as string | null | undefined) ?? null;
        const projectType = normalizeProjectType(
          (p.project_type as string | undefined) ??
            (p.type as string | undefined),
        );
        const stage = normalizeStage(p.stage as string | undefined);

        try {
          const [row] = await target<{ id: string }[]>`
            INSERT INTO projects (
              title, title_ar, client_id, project_type, stage,
              contracted_value_sar, delivery_due_at, shoot_starts_at,
              notes
            )
            VALUES (
              ${title}, ${titleAr}, ${newClientId}::uuid,
              ${projectType}::project_type, ${stage}::project_stage,
              ${(p.contracted_value_sar as number | string | null | undefined) ?? null},
              ${(p.delivery_due_at as string | null | undefined) ?? null},
              ${(p.shoot_starts_at as string | null | undefined) ?? null},
              ${`[migrated from legacy id ${pr.legacy_id ?? '?'}]`}
            )
            RETURNING id::text
          `;
          await target`
            UPDATE legacy_project_import
            SET new_project_id = ${row.id}::uuid,
                map_status = 'mapped'
            WHERE id = ${pr.id}::uuid
          `;
          rowsWritten.projects = (rowsWritten.projects ?? 0) + 1;
        } catch (err) {
          rowsSkipped.projects = (rowsSkipped.projects ?? 0) + 1;
          await target`
            UPDATE legacy_project_import
            SET map_status = 'failed',
                map_notes = ${err instanceof Error ? err.message : String(err)}
            WHERE id = ${pr.id}::uuid
          `;
        }
      }
      log(
        `    mapped ${rowsWritten.projects ?? 0}, skipped ${rowsSkipped.projects ?? 0}`,
      );
    }

    // ── Finalize ────────────────────────────────────────────────────────
    await target`
      UPDATE migration_runs
      SET status = 'ok',
          finished_at = now(),
          rows_read = ${rowsRead as unknown as object},
          rows_written = ${rowsWritten as unknown as object},
          rows_skipped = ${rowsSkipped as unknown as object}
      WHERE id = ${runId}::uuid
    `;

    log('═══════════════════════════════════════════════');
    log('✓ Migration complete');
    log(`  Read:    ${JSON.stringify(rowsRead)}`);
    log(`  Written: ${JSON.stringify(rowsWritten)}`);
    log(`  Skipped: ${JSON.stringify(rowsSkipped)}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('✗ Migration failed:', msg);
    await target`
      UPDATE migration_runs
      SET status = 'failed',
          finished_at = now(),
          error_message = ${msg},
          rows_read = ${rowsRead as unknown as object},
          rows_written = ${rowsWritten as unknown as object},
          rows_skipped = ${rowsSkipped as unknown as object}
      WHERE id = ${runId}::uuid
    `.catch(() => {});
    process.exit(1);
  } finally {
    await target.end({ timeout: 5 });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

function inferCode(name: string | undefined): string {
  if (!name) return `LEG-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  // Take consonants from each word, uppercase, max 8 chars.
  const code = name
    .replace(/[^a-zA-Z\s]/g, '')
    .split(/\s+/)
    .map((w) => w.slice(0, 4))
    .join('-')
    .toUpperCase()
    .slice(0, 16);
  return code || `LEG-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function normalizeClientType(t: string): string {
  const allowed = ['brand', 'dealer', 'agency', 'other'];
  return allowed.includes(t) ? t : 'other';
}

function normalizeProjectType(t: string | undefined): string {
  const allowed = [
    'shoot',
    'edit_only',
    'live_coverage',
    'content_creation',
    'consulting',
    'other',
  ];
  if (!t) return 'shoot';
  const lower = t.toLowerCase();
  return allowed.includes(lower) ? lower : 'other';
}

function normalizeStage(s: string | undefined): string {
  const allowed = [
    'lead',
    'brief',
    'quoted',
    'approved',
    'planning',
    'shooting',
    'editing',
    'review',
    'delivered',
    'archived',
    'lost',
    'cancelled',
  ];
  if (!s) return 'brief';
  const lower = s.toLowerCase();
  return allowed.includes(lower) ? lower : 'brief';
}

main().catch((err) => {
  console.error('Unhandled:', err);
  process.exit(1);
});
