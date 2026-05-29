/**
 * Per-position daily routine loader.
 *
 * Source of truth is `config/routines.yaml` at the repo root (human-editable —
 * each position lists its recurring daily actions). This mirrors how
 * `config/roles.yaml` is read by the DB seed (packages/db/src/seed.ts): read the
 * file with `fs`, parse with the `yaml` package. The My Day page
 * (apps/web/src/app/my-day) materializes one `daily_tasks` row per item per day
 * so the checklist persists and shows on /tasks too.
 *
 * Resolution: in production the Next.js server runs with cwd = the app dir
 * (apps/web), so we walk up to the monorepo root to find `config/`. We also try
 * a couple of candidate paths so it works in local dev, `next start`, and the
 * Vercel serverless bundle (the file is force-included via
 * `outputFileTracingIncludes` in next.config.ts).
 *
 * Parsed once and cached for the process — the file never changes at runtime.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

export type RoutineItem = {
  /** Stable id, unique within the position. Used in daily_tasks.source_key. */
  key: string;
  /** Arabic action text (UI string). */
  titleAr: string;
  /** Rough time-of-day hint. */
  when: 'morning' | 'midday' | 'evening' | 'anytime';
};

type RawItem = { key: string; title_ar: string; when?: string };
type RoutinesFile = { positions: Record<string, RawItem[]> };

const VALID_WHEN = new Set(['morning', 'midday', 'evening', 'anytime']);

function resolveRoutinesPath(): string | null {
  const cwd = process.cwd();
  const candidates = [
    join(cwd, 'config', 'routines.yaml'), // cwd === repo root (turbo/test)
    join(cwd, '..', '..', 'config', 'routines.yaml'), // cwd === apps/web
    join(cwd, '..', '..', '..', 'config', 'routines.yaml'), // extra nesting
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

let cache: RoutinesFile | null = null;

function loadFile(): RoutinesFile {
  if (cache) return cache;
  const path = resolveRoutinesPath();
  if (!path) {
    console.error('[routines] config/routines.yaml not found from cwd', process.cwd());
    cache = { positions: {} };
    return cache;
  }
  try {
    cache = (parseYaml(readFileSync(path, 'utf8')) as RoutinesFile) ?? { positions: {} };
    if (!cache.positions) cache.positions = {};
  } catch (err) {
    console.error('[routines] failed to parse routines.yaml', err);
    cache = { positions: {} };
  }
  return cache;
}

/**
 * The daily routine for a position, normalized. Unknown / null position → [].
 */
export function loadRoutines(positionKey?: string | null): RoutineItem[] {
  if (!positionKey) return [];
  const file = loadFile();
  const raw = file.positions[positionKey];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r && typeof r.key === 'string' && typeof r.title_ar === 'string')
    .map((r) => ({
      key: r.key,
      titleAr: r.title_ar,
      when: (r.when && VALID_WHEN.has(r.when) ? r.when : 'anytime') as RoutineItem['when'],
    }));
}

/** Local (Asia/Riyadh) date as YYYY-MM-DD — the routine is "per working day". */
export function riyadhToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Stable per-(item,day) tag for a materialized routine daily_tasks row. */
export function routineSourceKey(itemKey: string, day: string): string {
  return `routine:${itemKey}:${day}`;
}
