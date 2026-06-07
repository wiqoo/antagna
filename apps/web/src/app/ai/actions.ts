'use server';

import { revalidatePath } from 'next/cache';
import { canAny } from '@/lib/authz';
import { getOrRefreshBrief } from '@/lib/ai-center-brief';

/** Force-regenerate the AI Center narrative brief (bound to the "تحديث" button). */
export async function refreshAiCenterBrief(): Promise<void> {
  const ok = await canAny(['ai.cost_dashboard.read', 'access.manage', 'settings.update']);
  if (!ok) return;
  await getOrRefreshBrief({ force: true });
  revalidatePath('/ai');
}
