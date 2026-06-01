/**
 * Per-position Job Description loader (the accountability "rubric").
 *
 * Source of truth is `config/job-descriptions.yaml` at the repo root. Mirrors
 * `apps/web/src/lib/routines.ts`: read with `fs`, parse with the `yaml` package,
 * cache for the process. Used by the AI Weekly Performance Report (the rubric
 * the AI grades activity against), the /performance surface, and manager
 * resolution (reports_to → the active holder of that position).
 *
 * IMPORTANT: any route that reads this at runtime must force-include the file in
 * `apps/web/next.config.ts` outputFileTracingIncludes, or the Vercel serverless
 * bundle won't ship it and the loader silently returns null.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

export type JdResponsibility = { key: string; titleAr: string; detailAr?: string };
export type JdKpi = {
  key: string;
  titleAr: string;
  target: number;
  unit: 'pct' | 'count' | 'hours' | 'days' | 'sar' | 'ratio';
  /** higher = higher-is-better; lower = lower-is-better (e.g. response time). */
  direction: 'higher' | 'lower';
  /** true → the system can score it today; false → manual/awaiting-data. */
  measurable: boolean;
};
export type JobDescription = {
  positionKey: string;
  titleAr: string;
  missionAr: string;
  reportsTo: string | null;
  responsibilities: JdResponsibility[];
  kpis: JdKpi[];
};

type RawKpi = {
  key?: string; title_ar?: string; target?: number;
  unit?: string; direction?: string; measurable?: boolean;
};
type RawResp = { key?: string; title_ar?: string; detail_ar?: string };
type RawJd = {
  title_ar?: string; mission_ar?: string; reports_to?: string | null;
  responsibilities?: RawResp[]; kpis?: RawKpi[];
};
type JdFile = { positions: Record<string, RawJd> };

const VALID_UNIT = new Set(['pct', 'count', 'hours', 'days', 'sar', 'ratio']);

function resolvePath(): string | null {
  const cwd = process.cwd();
  const candidates = [
    join(cwd, 'config', 'job-descriptions.yaml'),
    join(cwd, '..', '..', 'config', 'job-descriptions.yaml'),
    join(cwd, '..', '..', '..', 'config', 'job-descriptions.yaml'),
  ];
  for (const p of candidates) if (existsSync(p)) return p;
  return null;
}

let cache: JdFile | null = null;

function loadFile(): JdFile {
  if (cache) return cache;
  const path = resolvePath();
  if (!path) {
    console.error('[job-descriptions] config/job-descriptions.yaml not found from cwd', process.cwd());
    cache = { positions: {} };
    return cache;
  }
  try {
    cache = (parseYaml(readFileSync(path, 'utf8')) as JdFile) ?? { positions: {} };
    if (!cache.positions) cache.positions = {};
  } catch (err) {
    console.error('[job-descriptions] failed to parse job-descriptions.yaml', err);
    cache = { positions: {} };
  }
  return cache;
}

function normalizeKpi(r: RawKpi): JdKpi | null {
  if (!r || typeof r.key !== 'string' || typeof r.title_ar !== 'string') return null;
  return {
    key: r.key,
    titleAr: r.title_ar,
    target: typeof r.target === 'number' ? r.target : 0,
    unit: (r.unit && VALID_UNIT.has(r.unit) ? r.unit : 'count') as JdKpi['unit'],
    direction: r.direction === 'lower' ? 'lower' : 'higher',
    measurable: r.measurable === true,
  };
}

/** The job description for a position, normalized. Unknown / null → null. */
export function loadJobDescription(positionKey?: string | null): JobDescription | null {
  if (!positionKey) return null;
  const raw = loadFile().positions[positionKey];
  if (!raw) return null;
  return {
    positionKey,
    titleAr: raw.title_ar ?? positionKey,
    missionAr: raw.mission_ar ?? '',
    reportsTo: raw.reports_to ?? null,
    responsibilities: (raw.responsibilities ?? [])
      .filter((r): r is RawResp => !!r && typeof r.key === 'string' && typeof r.title_ar === 'string')
      .map((r) => ({ key: r.key!, titleAr: r.title_ar!, detailAr: r.detail_ar })),
    kpis: (raw.kpis ?? []).map(normalizeKpi).filter((k): k is JdKpi => k !== null),
  };
}

/** The manager position_key a position reports to (for nudge/report routing). */
export function reportsToPosition(positionKey?: string | null): string | null {
  return loadJobDescription(positionKey)?.reportsTo ?? null;
}
