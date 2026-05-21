'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { VIEW_AS_COOKIE, getRealProfile } from './view-as';

const ADMIN_ROLES = new Set(['system_admin', 'system_manager']);

async function requireAdmin(): Promise<void> {
  const real = await getRealProfile();
  if (!real || !ADMIN_ROLES.has(real.role)) {
    throw new Error('forbidden');
  }
}

export async function setViewAs(profileId: string): Promise<void> {
  await requireAdmin();
  const store = await cookies();
  store.set(VIEW_AS_COOKIE, profileId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8, // 8 hours
  });
  revalidatePath('/', 'layout');
}

export async function clearViewAs(): Promise<void> {
  const store = await cookies();
  store.delete(VIEW_AS_COOKIE);
  revalidatePath('/', 'layout');
}
