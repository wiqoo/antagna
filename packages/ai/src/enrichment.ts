/**
 * Client enrichment via Anthropic's server-side web search.
 *
 * Given a company name (+ optional domain/country) Claude researches it on the
 * open web and returns a structured, Arabic-first profile the team can use
 * before pitching or producing. Best-effort: every call is budget-recorded and
 * returns { ok: false } rather than throwing, so callers can degrade gracefully.
 */
import { getAnthropic } from './anthropic';
import { ANTHROPIC_MODELS } from './models';
import { recordUsage } from './cost';
import { assertAiBudget } from './guard';

export type CompanyEnrichment = {
  ok: boolean;
  summaryAr?: string;
  summaryEn?: string;
  industry?: string | null;
  websiteUrl?: string | null;
  hqLocation?: string | null;
  companySize?: string | null;
  keyFacts?: string[];
  sources?: string[];
  error?: string;
};

const ENRICH_SYSTEM = `You are a B2B research analyst for "Volt Production", a Saudi video-production / creative agency. You research a CLIENT COMPANY using web search so the team understands who they are before pitching or producing content for them.
Return STRICT JSON only — no prose, no markdown:
{
  "summary_ar": "2-4 جُمل بالعربية الفصحى: مَن هم، قطاعهم، ماذا يقدّمون، وأي معلومة مفيدة لإنتاج محتوى لهم",
  "summary_en": "2-4 sentences, same content in English",
  "industry": "<short industry label or null>",
  "website_url": "<official site or null>",
  "hq_location": "<city, country or null>",
  "company_size": "<'SME' | '50-200' | 'enterprise' | 'unknown'>",
  "key_facts": ["fact useful for a creative brief", "..."],
  "sources": ["<url>", "<url>"]
}
Rules:
- Use web_search. Base EVERY field only on what you actually find; if unverifiable, use null or "unknown".
- Never invent. Prefer the company's official website + reputable sources.
- Arabic must be فصحى (no slang, no emoji).`;

export async function enrichCompanyFromWeb(input: {
  name: string;
  domain?: string | null;
  country?: string | null;
}): Promise<CompanyEnrichment> {
  const name = input.name?.trim();
  if (!name) return { ok: false, error: 'no company name' };

  const userMsg =
    `Company to research:\n` +
    `- name: ${name}\n` +
    (input.domain ? `- domain/website: ${input.domain}\n` : '') +
    (input.country ? `- country: ${input.country}\n` : '') +
    `\nResearch them with web search and output the JSON only.`;

  try {
    // Sonnet + web_search is billable — gate it on the AI budget before firing.
    await assertAiBudget({ feature: 'client_enrichment' });
    const client = getAnthropic();
    const resp = await client.messages.create(
      {
        model: ANTHROPIC_MODELS.sonnet,
        max_tokens: 1300,
        system: ENRICH_SYSTEM,
        // web_search is a server-side tool; the SDK 0.32 type defs don't expose
        // it yet, so the whole request is cast. Anthropic runs the search loop
        // and returns the final answer in the text block(s).
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 4 }],
        messages: [{ role: 'user', content: userMsg }],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    );

    await recordUsage({
      feature: 'client_enrichment',
      model: ANTHROPIC_MODELS.sonnet,
      inputTokens: resp.usage.input_tokens ?? 0,
      outputTokens: resp.usage.output_tokens ?? 0,
      cacheReadTokens:
        (resp.usage as { cache_read_input_tokens?: number }).cache_read_input_tokens ?? 0,
      cacheWriteTokens:
        (resp.usage as { cache_creation_input_tokens?: number }).cache_creation_input_tokens ?? 0,
    });

    const text = resp.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('\n')
      .trim();
    const raw = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { ok: false, error: 'no JSON in model output' };
    const p = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    const arr = (v: unknown): string[] =>
      Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean).slice(0, 8) : [];
    const str = (v: unknown): string | null => {
      const s = v == null ? '' : String(v).trim();
      return s && s.toLowerCase() !== 'null' && s.toLowerCase() !== 'unknown' ? s : null;
    };

    return {
      ok: true,
      summaryAr: str(p.summary_ar) ?? undefined,
      summaryEn: str(p.summary_en) ?? undefined,
      industry: str(p.industry),
      websiteUrl: str(p.website_url),
      hqLocation: str(p.hq_location),
      companySize: str(p.company_size),
      keyFacts: arr(p.key_facts),
      sources: arr(p.sources),
    };
  } catch (e) {
    return { ok: false, error: (e as { message?: string })?.message ?? String(e) };
  }
}
