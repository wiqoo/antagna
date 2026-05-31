import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * The standalone /my-day route is retired — its routine checklist + today's
 * items are now a section on /dashboard (above the position card board). This
 * redirect keeps old bookmarks, links, and the PWA shortcut working.
 */
export default function MyDayRedirect(): never {
  redirect('/dashboard');
}
