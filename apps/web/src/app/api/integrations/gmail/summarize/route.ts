import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { summarizeThreads } from '@/lib/gmail-summarize';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Summarize email threads with stale or missing ai_summary.
 *   ?maxThreads=30   (cost cap per run)
 */
export async function POST(req: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const maxThreadsParam = url.searchParams.get('maxThreads');

  try {
    const report = await summarizeThreads({
      maxThreads: maxThreadsParam ? parseInt(maxThreadsParam, 10) : undefined,
    });
    return NextResponse.json({ ok: true, report });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
