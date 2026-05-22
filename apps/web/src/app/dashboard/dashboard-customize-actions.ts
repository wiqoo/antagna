'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

const COOKIE = 'dash_hidden';

export async function saveDashboardCustomization(formData: FormData) {
  // The form ships 'all' (CSV of every catalog id) + one 'visible' entry
  // per checked card. Anything in `all` but not in `visible` is hidden.
  const visible = new Set((formData.getAll('visible') as string[]).map((s) => s.trim()));
  const all = ((formData.get('all') as string) ?? '').split(',').filter(Boolean);
  const hidden = all.filter((id) => !visible.has(id));

  const jar = await cookies();
  jar.set(COOKIE, hidden.join(','), {
    httpOnly: false,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  });
  revalidatePath('/dashboard');
}

export async function resetDashboardCustomization() {
  const jar = await cookies();
  jar.delete(COOKIE);
  revalidatePath('/dashboard');
}
