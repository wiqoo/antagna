# Pillar 15 — Legacy Migration Runbook

> **Hands-off until you run this script.** The legacy DB
> (`jhfkgmomntkgzzycdbmt`) stays untouched until you explicitly trigger.

## What it does

`scripts/migrate-from-volt-os.ts` pulls equipment, clients, and active
projects from the legacy Volt OS Supabase project into Antagna-V2's
staging tables (`legacy_*_import`), then maps them to the canonical
schema (`equipment` / `clients` / `projects`).

Idempotent: re-running is safe. Already-mapped rows skip on `ON CONFLICT`.

## Prerequisites

1. **`LEGACY_DATABASE_URL`** in your env, pointing at the **read-only**
   pooler for `jhfkgmomntkgzzycdbmt`:
   ```
   LEGACY_DATABASE_URL=postgresql://postgres.<legacy_ref>:<password>@aws-1-eu-central-1.pooler.supabase.com:6543/postgres
   ```
2. **`DATABASE_URL`** already set for Antagna-V2 (this is what every
   other command uses).
3. From `/home/mohammed/antagna`: `pnpm install` complete.

## Recommended sequence

### 1. Dry-run first

Reads from legacy + counts rows, writes nothing.
```bash
pnpm tsx scripts/migrate-from-volt-os.ts --dry-run
```
Sample output:
```
[2026-...] Migration mode: dry-run
[2026-...] migration_runs id: <uuid>
[2026-...] Phase 1: PULL → staging tables
[2026-...]   → pulling equipment…
[2026-...]     read 162 equipment rows
[2026-...]   → pulling clients…
[2026-...]     read 47 client rows
[2026-...]   → pulling active projects…
[2026-...]     read 12 project rows
[2026-...] ✓ Migration complete
```

If something looks wrong (counts way off, schema mismatch errors logged),
**stop here** and tell me what you saw.

### 2. Pull only — populates staging without touching canonical

```bash
pnpm tsx scripts/migrate-from-volt-os.ts --pull-only
```
After this, you can inspect what landed:
```sql
SELECT count(*) FROM legacy_equipment_import;
SELECT legacy_payload FROM legacy_client_import LIMIT 5;
```

### 3. Map only — staging → canonical (idempotent)

```bash
pnpm tsx scripts/migrate-from-volt-os.ts --map-only
```
Or do both phases at once:
```bash
pnpm tsx scripts/migrate-from-volt-os.ts
```

## Verification

Every run writes to `migration_runs`:
```sql
SELECT status, rows_read, rows_written, rows_skipped, error_message
FROM migration_runs
ORDER BY started_at DESC
LIMIT 5;
```

Per-row outcome:
```sql
SELECT map_status, count(*)
FROM legacy_client_import
GROUP BY map_status;
```

Skipped/failed rows have `map_notes` explaining why.

## Rollback

If the mapping looks wrong, you can re-run the mapping after wiping
the canonical inserts (BE CAREFUL — only on Antagna-V2, not legacy):

```sql
-- Find what got inserted
SELECT id FROM clients WHERE notes LIKE '[migrated from legacy id %';

-- If you really want to undo:
UPDATE legacy_client_import SET map_status = 'pending', new_client_id = NULL;
-- and delete the canonical rows, then re-map.
```

## Out of scope for this script

Per D-014, these are **NOT** migrated:
- Old AR / invoices (Dafterah owns these per D-022)
- HR/employee data
- Old project history beyond active projects
- Attachments / files from legacy storage
- WhatsApp threads

If we decide later to bring those over, we add new staging tables and
new mapping passes — won't break the current one.
