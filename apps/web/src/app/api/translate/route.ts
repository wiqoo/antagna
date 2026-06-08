import { NextResponse } from 'next/server';
import { translateBatch, type TranslateDomain } from '@antagna/ai';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_TEXTS = 200;
const MAX_LEN = 5000;
const DOMAINS = new Set(['ui', 'content', 'name', 'email']);

/** Batch translate endpoint for the runtime i18n layer. Cache-first; auth-gated. */
export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ translations: {} }, { status: 401 });

  let body: { texts?: unknown; domain?: unknown; to?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 });
  }

  const to = typeof body.to === 'string' && body.to ? body.to : 'en';
  const domain: TranslateDomain = (
    typeof body.domain === 'string' && DOMAINS.has(body.domain) ? body.domain : 'content'
  ) as TranslateDomain;
  const texts = Array.isArray(body.texts)
    ? body.texts
        .filter((t): t is string => typeof t === 'string')
        .map((t) => t.slice(0, MAX_LEN))
        .slice(0, MAX_TEXTS)
    : [];
  if (!texts.length) return NextResponse.json({ translations: {} });

  try {
    const map = await translateBatch(texts, { to, from: 'ar', domain, userId: null });
    const translations: Record<string, string> = {};
    for (const [k, v] of map) translations[k] = v;
    return NextResponse.json({ translations });
  } catch (e) {
    // Fail soft — the layer just leaves source text on error.
    return NextResponse.json(
      { translations: {}, error: e instanceof Error ? e.message : 'failed' },
      { status: 200 },
    );
  }
}
