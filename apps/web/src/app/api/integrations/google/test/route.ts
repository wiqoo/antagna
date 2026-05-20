import { NextResponse } from 'next/server';
import {
  getGmailClient,
  getDriveClient,
  getCalendarClient,
} from '@/lib/google';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Exercise the three APIs against a stored integration. Returns a short
 * report so the admin UI can show "✓ Gmail / ✓ Drive / ✓ Calendar" — or
 * the exact error message if something failed.
 */
export async function GET(req: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const email = new URL(req.url).searchParams.get('email');
  if (!email) {
    return NextResponse.json({ ok: false, error: 'email param required' }, { status: 400 });
  }

  const results: Record<string, { ok: boolean; sample?: unknown; error?: string }> = {};

  // Gmail — fetch labels (cheapest read, doesn't require any messages)
  try {
    const gmail = await getGmailClient(email);
    const labels = await gmail.users.labels.list({ userId: 'me' });
    results.gmail = {
      ok: true,
      sample: {
        label_count: labels.data.labels?.length ?? 0,
        first_label: labels.data.labels?.[0]?.name ?? null,
      },
    };
  } catch (err) {
    results.gmail = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  // Drive — list 5 items in the root of My Drive
  try {
    const drive = await getDriveClient(email);
    const files = await drive.files.list({
      pageSize: 5,
      fields: 'files(id, name, mimeType, modifiedTime)',
      orderBy: 'modifiedTime desc',
    });
    results.drive = {
      ok: true,
      sample: {
        file_count: files.data.files?.length ?? 0,
        recent: (files.data.files ?? []).map((f) => f.name).slice(0, 5),
      },
    };
  } catch (err) {
    results.drive = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  // Calendar — list the user's calendars
  try {
    const calendar = await getCalendarClient(email);
    const list = await calendar.calendarList.list({ maxResults: 10 });
    results.calendar = {
      ok: true,
      sample: {
        calendar_count: list.data.items?.length ?? 0,
        primary: list.data.items?.find((c) => c.primary)?.summary ?? null,
      },
    };
  } catch (err) {
    results.calendar = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  return NextResponse.json({ ok: true, email, results });
}
