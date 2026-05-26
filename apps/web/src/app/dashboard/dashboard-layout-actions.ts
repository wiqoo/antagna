'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { resolveLayout, DASH_LAYOUT_COOKIE, type DashLayout } from './cards/catalog';

/**
 * Persist the dashboard layout (card order + per-card size + hidden set).
 * We run it back through `resolveLayout` so a malformed client payload can
 * never corrupt the board — unknown ids drop, new cards get appended.
 */
export async function saveDashboardLayout(layout: DashLayout) {
  const clean = resolveLayout(layout);
  const jar = await cookies();
  jar.set(DASH_LAYOUT_COOKIE, JSON.stringify(clean), {
    httpOnly: false,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  });
  // Retire the legacy show/hide-only cookie if it's still around.
  jar.delete('dash_hidden');
  revalidatePath('/dashboard');
}

export async function resetDashboardLayout() {
  const jar = await cookies();
  jar.delete(DASH_LAYOUT_COOKIE);
  jar.delete('dash_hidden');
  revalidatePath('/dashboard');
}
