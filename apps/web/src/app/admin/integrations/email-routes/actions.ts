'use server';

import { revalidatePath } from 'next/cache';
import { db, inboundEmailRoutes } from '@antagna/db';
import { eq, sql } from 'drizzle-orm';
import { getAdminUser } from '@/lib/auth-admin';

async function requireAdmin() {
  const a = await getAdminUser();
  if (!a) throw new Error('forbidden');
}

export interface CreateRouteInput {
  position: number;
  matchFromContains?: string | null;
  matchToContains?: string | null;
  matchDomain?: string | null;
  matchSubjectRegex?: string | null;
  assignToProfileId?: string | null;
  setStatus?: string | null;
  setLabelKey?: string | null;
  createLeadIfNew: boolean;
  active: boolean;
}

export async function createRoute(input: CreateRouteInput) {
  await requireAdmin();
  await db.insert(inboundEmailRoutes).values({
    position: input.position,
    matchFromContains: input.matchFromContains || null,
    matchToContains: input.matchToContains || null,
    matchDomain: input.matchDomain || null,
    matchSubjectRegex: input.matchSubjectRegex || null,
    assignToProfileId: input.assignToProfileId || null,
    setStatus: input.setStatus || null,
    setLabelKey: input.setLabelKey || null,
    createLeadIfNew: input.createLeadIfNew,
    active: input.active,
  });
  revalidatePath('/admin/integrations/email-routes');
}

export async function toggleRoute(id: string, active: boolean) {
  await requireAdmin();
  await db
    .update(inboundEmailRoutes)
    .set({ active })
    .where(eq(inboundEmailRoutes.id, id));
  revalidatePath('/admin/integrations/email-routes');
}

export async function deleteRoute(id: string) {
  await requireAdmin();
  await db.delete(inboundEmailRoutes).where(eq(inboundEmailRoutes.id, id));
  revalidatePath('/admin/integrations/email-routes');
}

/**
 * Seed a curated set of starter rules. Idempotent — only inserts rules
 * whose (match_*) signature isn't already present.
 */
export async function seedStarterRoutes() {
  await requireAdmin();

  const starters: CreateRouteInput[] = [
    {
      position: 10,
      matchDomain: 'stripe.com',
      setStatus: 'closed',
      createLeadIfNew: false,
      active: true,
    },
    {
      position: 11,
      matchFromContains: 'noreply',
      setStatus: 'closed',
      createLeadIfNew: false,
      active: true,
    },
    {
      position: 12,
      matchFromContains: 'no-reply',
      setStatus: 'closed',
      createLeadIfNew: false,
      active: true,
    },
    {
      position: 13,
      matchDomain: 'amazonses.com',
      setStatus: 'closed',
      createLeadIfNew: false,
      active: true,
    },
    {
      position: 20,
      matchSubjectRegex: '(?i)\\b(unsubscribe|newsletter|تخفيض|promo)\\b',
      setStatus: 'closed',
      createLeadIfNew: false,
      active: true,
    },
    {
      position: 30,
      matchSubjectRegex: '(?i)\\b(quote|عرض\\s*سعر|proposal|RFP|tender)\\b',
      setLabelKey: 'sales',
      createLeadIfNew: true,
      active: true,
    },
    {
      position: 31,
      matchSubjectRegex: '(?i)\\b(invoice|فاتورة|payment|دفع)\\b',
      setLabelKey: 'finance',
      createLeadIfNew: false,
      active: true,
    },
  ];

  const existing = await db
    .select({
      from: inboundEmailRoutes.matchFromContains,
      domain: inboundEmailRoutes.matchDomain,
      regex: inboundEmailRoutes.matchSubjectRegex,
    })
    .from(inboundEmailRoutes);
  const sig = (r: { from?: string | null; domain?: string | null; regex?: string | null }) =>
    `${r.from ?? ''}|${r.domain ?? ''}|${r.regex ?? ''}`;
  const have = new Set(existing.map(sig));

  for (const s of starters) {
    const sigVal = `${s.matchFromContains ?? ''}|${s.matchDomain ?? ''}|${s.matchSubjectRegex ?? ''}`;
    if (have.has(sigVal)) continue;
    await db.insert(inboundEmailRoutes).values({
      position: s.position,
      matchFromContains: s.matchFromContains || null,
      matchDomain: s.matchDomain || null,
      matchSubjectRegex: s.matchSubjectRegex || null,
      setStatus: s.setStatus || null,
      setLabelKey: s.setLabelKey || null,
      createLeadIfNew: s.createLeadIfNew,
      active: s.active,
    });
  }
  revalidatePath('/admin/integrations/email-routes');
}
