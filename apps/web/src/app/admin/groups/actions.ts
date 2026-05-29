'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { and, eq, sql } from 'drizzle-orm';
import { withActor, squads, squadMembers } from '@antagna/db';
import { requirePermissionAction } from '@/lib/authz';
import { SQUAD_PURPOSES } from './constants';

/**
 * Squads / groups admin (volt-os parity /admin/groups).
 *
 * CRUD over `squads` (recurring teams) + `squad_members` (M:N to profiles).
 * Gated on `access.manage` and every mutation runs inside `withActor(pid, …)`
 * so the audit trigger + SECURITY DEFINER checks see the actor on the same
 * pinned pooled connection (auth-context.ts).
 *
 * squads columns:        code, name_ar, name_en, purpose, active, created_by
 * squad_members columns: squad_id, profile_id, default_role, is_core, notes
 *                        (composite PK squad_id+profile_id; cascade on squad delete)
 */

const PURPOSE_SET = new Set<string>(SQUAD_PURPOSES);
const CODE_RE = /^[A-Z][A-Z0-9_]*$/;

function bounceList(message: string): never {
  redirect(`/admin/groups?error=${encodeURIComponent(message)}`);
}
function bounceDetail(squadId: string, message: string): never {
  redirect(`/admin/groups/${squadId}?error=${encodeURIComponent(message)}`);
}

export async function createSquad(formData: FormData) {
  const actor = await requirePermissionAction('access.manage');

  const code = String(formData.get('code') ?? '').trim().toUpperCase();
  const nameAr = String(formData.get('name_ar') ?? '').trim();
  const nameEn = String(formData.get('name_en') ?? '').trim();
  const purpose = String(formData.get('purpose') ?? '').trim();

  if (!code || !nameAr) bounceList('الرمز والاسم مطلوبان');
  if (!CODE_RE.test(code)) {
    bounceList('الرمز يجب أن يكون حروفاً كبيرة وأرقاماً و _ فقط، يبدأ بحرف');
  }
  if (purpose && !PURPOSE_SET.has(purpose)) bounceList('الغرض غير صالح');

  let newId: string | null = null;
  try {
    await withActor(actor, async (tx) => {
      const [row] = await tx
        .insert(squads)
        .values({
          code,
          nameAr,
          nameEn: nameEn || null,
          purpose: purpose || null,
          createdBy: actor,
        })
        .returning({ id: squads.id });
      newId = row?.id ?? null;
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('duplicate key') || msg.includes('squads_code')) {
      bounceList(`الرمز «${code}» مستخدم بالفعل`);
    }
    bounceList('تعذّر إنشاء المجموعة');
  }

  revalidatePath('/admin/groups');
  if (newId) redirect(`/admin/groups/${newId}`);
  redirect('/admin/groups?ok=' + encodeURIComponent('تم إنشاء المجموعة'));
}

export async function updateSquad(formData: FormData) {
  const actor = await requirePermissionAction('access.manage');

  const id = String(formData.get('id') ?? '').trim();
  const nameAr = String(formData.get('name_ar') ?? '').trim();
  const nameEn = String(formData.get('name_en') ?? '').trim();
  const purpose = String(formData.get('purpose') ?? '').trim();

  if (!id || !nameAr) bounceDetail(id, 'الاسم مطلوب');
  if (purpose && !PURPOSE_SET.has(purpose)) bounceDetail(id, 'الغرض غير صالح');

  await withActor(actor, (tx) =>
    tx
      .update(squads)
      .set({ nameAr, nameEn: nameEn || null, purpose: purpose || null })
      .where(eq(squads.id, id)),
  );

  revalidatePath('/admin/groups');
  revalidatePath(`/admin/groups/${id}`);
  redirect(`/admin/groups/${id}?ok=` + encodeURIComponent('تم الحفظ'));
}

export async function toggleSquad(id: string) {
  const actor = await requirePermissionAction('access.manage');
  await withActor(actor, (tx) =>
    tx.execute(sql`UPDATE squads SET active = NOT active WHERE id = ${id}::uuid`),
  );
  revalidatePath('/admin/groups');
  revalidatePath(`/admin/groups/${id}`);
}

export async function deleteSquad(id: string) {
  const actor = await requirePermissionAction('access.manage');
  // squad_members cascade on delete; project_squad_assignments references squads
  // without cascade, so block delete if the squad is assigned to a project.
  const assigned = (await withActor(actor, (tx) =>
    tx.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM project_squad_assignments WHERE squad_id = ${id}::uuid`,
    ),
  )) as unknown as { n: number }[];
  if ((assigned[0]?.n ?? 0) > 0) {
    bounceDetail(id, 'المجموعة مسنَدة لمشاريع — عطّلها بدل الحذف');
  }
  await withActor(actor, (tx) => tx.delete(squads).where(eq(squads.id, id)));
  revalidatePath('/admin/groups');
  redirect('/admin/groups?ok=' + encodeURIComponent('تم حذف المجموعة'));
}

export async function addSquadMember(formData: FormData) {
  const actor = await requirePermissionAction('access.manage');

  const squadId = String(formData.get('squad_id') ?? '').trim();
  const profileId = String(formData.get('profile_id') ?? '').trim();
  const defaultRole = String(formData.get('default_role') ?? '').trim();
  const isCore = formData.get('is_core') === 'on';

  if (!squadId || !profileId) bounceDetail(squadId, 'اختر عضواً');

  try {
    await withActor(actor, (tx) =>
      tx
        .insert(squadMembers)
        .values({
          squadId,
          profileId,
          defaultRole: defaultRole || null,
          isCore,
        })
        .onConflictDoNothing(),
    );
  } catch {
    bounceDetail(squadId, 'تعذّرت إضافة العضو');
  }

  revalidatePath(`/admin/groups/${squadId}`);
  revalidatePath('/admin/groups');
  redirect(`/admin/groups/${squadId}?ok=` + encodeURIComponent('تمت الإضافة'));
}

export async function removeSquadMember(squadId: string, profileId: string) {
  const actor = await requirePermissionAction('access.manage');
  await withActor(actor, (tx) =>
    tx
      .delete(squadMembers)
      .where(and(eq(squadMembers.squadId, squadId), eq(squadMembers.profileId, profileId))),
  );
  revalidatePath(`/admin/groups/${squadId}`);
  revalidatePath('/admin/groups');
}

export async function toggleMemberCore(squadId: string, profileId: string) {
  const actor = await requirePermissionAction('access.manage');
  await withActor(actor, (tx) =>
    tx.execute(
      sql`UPDATE squad_members SET is_core = NOT is_core
          WHERE squad_id = ${squadId}::uuid AND profile_id = ${profileId}::uuid`,
    ),
  );
  revalidatePath(`/admin/groups/${squadId}`);
}
