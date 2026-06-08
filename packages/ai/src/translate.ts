/**
 * Translation engine — the single warm-cache translator behind both the runtime
 * i18n layer and the build-time UI dictionary. Cache-first: only strings missing
 * from `translation_cache` hit the model. Cheap (Haiku) + batched + budget-gated.
 */
import crypto from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { db, translationCache } from '@antagna/db';
import { getAnthropic } from './anthropic';
import { ANTHROPIC_MODELS } from './models';
import { recordUsage } from './cost';
import { assertAiBudget } from './guard';

export type TranslateDomain = 'ui' | 'content' | 'name' | 'email';

export interface TranslateOpts {
  to: string;
  from?: string;
  domain?: TranslateDomain;
  userId?: string | null;
}

function keyHash(source: string, from: string, to: string, domain: string): string {
  return crypto.createHash('sha256').update(`${source}|${from}|${to}|${domain}`, 'utf8').digest('hex');
}

const DOMAIN_GUIDANCE: Record<TranslateDomain, string> = {
  ui: 'These are UI strings (buttons, labels, headings) for a premium creative-agency SaaS. Translate to natural, concise, consistent English.',
  content: 'These are business content snippets (summaries, notes). Translate naturally and faithfully.',
  email: 'These are business email texts. Translate faithfully, preserving tone, meaning, and any greetings/sign-offs.',
  name: 'These are PROPER NAMES (people, companies, projects). TRANSLITERATE Arabic names to their natural Latin spelling (محمد غريب -> "Mohammed Ghareeb"). Keep brand/Latin names unchanged (BMW, Volt). Never translate a name\'s literal meaning.',
};

const GLOSSARY =
  'Glossary (use consistently): عميل=Client, مشروع=Project, بريف=Brief, مخرجات=Deliverables, مهمة=Task, اعتماد=Approval, معدات=Equipment, تصوير=Shoot, مونتاج=Editing, فريق=Team, جهة الاتصال=Contact, مرشّح=Candidate, دفترة=Dafterah (a product name — keep as-is), عرض السعر=Quote, أبو لوكا=Abu Luka, فولت=Volt.';

const MAX_ITEMS_PER_CALL = 40;
const MAX_CHARS_PER_CALL = 8000;

/**
 * Translate a batch with the persistent cache. Returns a Map keyed by the
 * TRIMMED source string → translation. Only cache misses call the model.
 */
export async function translateBatch(
  texts: string[],
  opts: TranslateOpts,
): Promise<Map<string, string>> {
  const to = opts.to;
  const from = opts.from ?? 'ar';
  const domain: TranslateDomain = opts.domain ?? 'ui';
  const out = new Map<string, string>();

  const uniq = Array.from(new Set(texts.map((t) => t.trim()).filter(Boolean)));
  if (uniq.length === 0) return out;

  const byHash = new Map<string, string>();
  for (const s of uniq) byHash.set(keyHash(s, from, to, domain), s);
  const hashes = Array.from(byHash.keys());

  // 1) Cache hits.
  const rows = (await db
    .select({ h: translationCache.sourceSha256, t: translationCache.translatedText })
    .from(translationCache)
    .where(
      and(
        inArray(translationCache.sourceSha256, hashes),
        eq(translationCache.targetLang, to),
        eq(translationCache.domain, domain),
      ),
    )) as Array<{ h: string; t: string }>;
  const hit = new Set<string>();
  for (const r of rows) {
    const src = byHash.get(r.h);
    if (src) {
      out.set(src, r.t);
      hit.add(r.h);
    }
  }

  // 2) Misses → model (chunked).
  const misses = hashes.filter((h) => !hit.has(h)).map((h) => byHash.get(h)!);
  if (misses.length === 0) return out;

  const translatedAll: string[] = [];
  for (const chunk of chunkByCountAndChars(misses)) {
    translatedAll.push(...(await runModelTranslate(chunk, from, to, domain, opts.userId ?? null)));
  }

  // 3) Persist + fill output (never overwrites a reviewed row — onConflictDoNothing).
  const inserts = misses.map((src, i) => ({
    sourceSha256: keyHash(src, from, to, domain),
    sourceLang: from,
    targetLang: to,
    domain,
    sourceText: src,
    translatedText: translatedAll[i] ?? src,
    status: 'machine' as const,
  }));
  for (let i = 0; i < misses.length; i++) {
    const src = misses[i]!;
    out.set(src, translatedAll[i] ?? src);
  }
  if (inserts.length) {
    await db.insert(translationCache).values(inserts).onConflictDoNothing();
  }
  return out;
}

export async function translate(text: string, opts: TranslateOpts): Promise<string> {
  const m = await translateBatch([text], opts);
  return m.get(text.trim()) ?? text;
}

/** Cache-only lookup (no model) — for build-time tooling and warm reads. */
export async function getCachedTranslations(
  texts: string[],
  to: string,
  domain: TranslateDomain = 'ui',
  from = 'ar',
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const uniq = Array.from(new Set(texts.map((t) => t.trim()).filter(Boolean)));
  if (!uniq.length) return out;
  const byHash = new Map<string, string>();
  for (const s of uniq) byHash.set(keyHash(s, from, to, domain), s);
  const rows = (await db
    .select({ h: translationCache.sourceSha256, t: translationCache.translatedText })
    .from(translationCache)
    .where(
      and(
        inArray(translationCache.sourceSha256, Array.from(byHash.keys())),
        eq(translationCache.targetLang, to),
        eq(translationCache.domain, domain),
      ),
    )) as Array<{ h: string; t: string }>;
  for (const r of rows) {
    const src = byHash.get(r.h);
    if (src) out.set(src, r.t);
  }
  return out;
}

function chunkByCountAndChars(items: string[]): string[][] {
  const chunks: string[][] = [];
  let cur: string[] = [];
  let chars = 0;
  for (const it of items) {
    if (cur.length > 0 && (cur.length >= MAX_ITEMS_PER_CALL || chars + it.length > MAX_CHARS_PER_CALL)) {
      chunks.push(cur);
      cur = [];
      chars = 0;
    }
    cur.push(it);
    chars += it.length;
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

async function runModelTranslate(
  items: string[],
  from: string,
  to: string,
  domain: TranslateDomain,
  userId: string | null,
): Promise<string[]> {
  await assertAiBudget({ userId, feature: 'translate' });
  const client = getAnthropic();
  const system = `You are a professional ${from}->${to} translator for Antagna, a premium Saudi creative-production agency SaaS. ${DOMAIN_GUIDANCE[domain]} ${GLOSSARY}
Rules: translate ONLY (no notes); preserve placeholders like {count}, {name}, %s and any HTML/markdown tags and emoji; keep brand/proper Latin names as-is; keep numbers/dates.
CRITICAL: the output must contain ZERO Arabic-script characters. TRANSLITERATE any embedded Arabic personal, company, or place names to their natural Latin spelling (محمد جستانيه -> "Mohammed Jastaniah", نيسان السعودية -> "Nissan Saudi Arabia"). Never leave Arabic letters in the result.
Output a STRICT JSON array of strings — same length and order as the input — and nothing else.`;
  const user = `Translate these ${items.length} item(s) to ${to}. Input JSON array:\n${JSON.stringify(items)}`;

  let resp;
  try {
    resp = await client.messages.create({
      model: ANTHROPIC_MODELS.haiku,
      max_tokens: 8000,
      system,
      messages: [{ role: 'user', content: user }],
    });
  } catch {
    return items; // fail-safe: leave source text
  }
  await recordUsage({
    feature: 'translate',
    model: ANTHROPIC_MODELS.haiku,
    inputTokens: resp.usage.input_tokens ?? 0,
    outputTokens: resp.usage.output_tokens ?? 0,
    userId,
  });

  const block = resp.content.find((b) => b.type === 'text');
  const raw = (block && block.type === 'text' ? block.text : '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  let arr: unknown;
  try {
    arr = JSON.parse(raw);
  } catch {
    const m = raw.match(/\[[\s\S]*\]/);
    try {
      arr = m ? JSON.parse(m[0]) : [];
    } catch {
      arr = [];
    }
  }
  const list = Array.isArray(arr) ? arr.map((x) => String(x)) : [];
  return items.map((src, i) => (typeof list[i] === 'string' && list[i] ? list[i] : src));
}
