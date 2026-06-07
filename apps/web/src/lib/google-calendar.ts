/**
 * Read events from the connected Google Calendar (primary). Best-effort: returns
 * [] when no Google integration is connected or the API errors, so the calendar
 * page degrades gracefully to system-only events.
 */
import { db, googleIntegrations } from '@antagna/db';
import { isNull } from 'drizzle-orm';
import { getCalendarClient } from './google';

export type GCalEvent = {
  id: string;
  title: string;
  startIso: string | null;
  endIso: string | null;
  allDay: boolean;
  location: string | null;
  htmlLink: string | null;
};

export type GoogleCalState =
  | { connected: true; email: string; events: GCalEvent[] }
  | { connected: false; events: [] };

export async function listGoogleEvents(
  timeMin: string,
  timeMax: string,
): Promise<GoogleCalState> {
  try {
    const [row] = await db
      .select({ email: googleIntegrations.email })
      .from(googleIntegrations)
      .where(isNull(googleIntegrations.disconnectedAt))
      .limit(1);
    if (!row?.email) return { connected: false, events: [] };

    const cal = await getCalendarClient(row.email);
    const res = await cal.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
    });
    const events: GCalEvent[] = (res.data.items ?? []).map((e, i) => ({
      id: e.id ?? `gcal-${i}`,
      title: e.summary ?? '(بدون عنوان)',
      startIso: e.start?.dateTime ?? e.start?.date ?? null,
      endIso: e.end?.dateTime ?? e.end?.date ?? null,
      allDay: !!e.start?.date && !e.start?.dateTime,
      location: e.location ?? null,
      htmlLink: e.htmlLink ?? null,
    }));
    return { connected: true, email: row.email, events };
  } catch (err) {
    console.error('[listGoogleEvents]', err);
    return { connected: false, events: [] };
  }
}
