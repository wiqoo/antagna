'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql, eq } from 'drizzle-orm';
import { db, profiles } from '@antagna/db';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function updateProject(projectId: string, formData: FormData) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [actor] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.authUserId, user.id))
    .limit(1);

  if (actor) {
    await db.execute(sql`SELECT set_config('app.acting_as', ${actor.id}, true)`);
  }

  const title = formData.get('title')?.toString() || null;
  const titleAr = formData.get('titleAr')?.toString() || null;
  const description = formData.get('description')?.toString() || null;
  const clientId = formData.get('clientId')?.toString() || null;
  const projectType = formData.get('projectType')?.toString() || null;
  const pmId = formData.get('pmId')?.toString() || null;
  const amId = formData.get('amId')?.toString() || null;
  const productionManagerId = formData.get('productionManagerId')?.toString() || null;
  const contractedValueSar = formData.get('contractedValueSar')?.toString() || null;
  const deliveryDueAt = formData.get('deliveryDueAt')?.toString() || null;
  const shootStartsAt = formData.get('shootStartsAt')?.toString() || null;
  const shootEndsAt = formData.get('shootEndsAt')?.toString() || null;
  const driveFolderUrl = formData.get('driveFolderUrl')?.toString() || null;
  const notes = formData.get('notes')?.toString() || null;

  await db.execute(sql`
    UPDATE projects SET
      title = COALESCE(${title}, title),
      title_ar = ${titleAr},
      description = ${description},
      client_id = COALESCE(${clientId}::uuid, client_id),
      project_type = COALESCE(${projectType}::project_type, project_type),
      project_manager_id = ${pmId ? sql`${pmId}::uuid` : sql`NULL`},
      account_manager_id = ${amId ? sql`${amId}::uuid` : sql`NULL`},
      production_manager_id = ${productionManagerId ? sql`${productionManagerId}::uuid` : sql`NULL`},
      contracted_value_sar = ${contractedValueSar ? sql`${contractedValueSar}::numeric` : sql`NULL`},
      delivery_due_at = ${deliveryDueAt ? sql`${deliveryDueAt}::timestamptz` : sql`NULL`},
      shoot_starts_at = ${shootStartsAt ? sql`${shootStartsAt}::timestamptz` : sql`NULL`},
      shoot_ends_at = ${shootEndsAt ? sql`${shootEndsAt}::timestamptz` : sql`NULL`},
      drive_folder_url = ${driveFolderUrl},
      notes = ${notes},
      updated_at = now()
    WHERE id = ${projectId}::uuid
  `);

  revalidatePath(`/projects/${projectId}`);
  revalidatePath('/projects');
  redirect(`/projects/${projectId}`);
}

export async function addAssignment(projectId: string, formData: FormData) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const [actor] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.authUserId, user.id))
    .limit(1);

  if (actor) {
    await db.execute(sql`SELECT set_config('app.acting_as', ${actor.id}, true)`);
  }

  const profileId = formData.get('profileId')?.toString() || null;
  const externalName = formData.get('externalName')?.toString() || null;
  const role = formData.get('role')?.toString();
  const rateSar = formData.get('rateSar')?.toString() || null;
  const rateUnit = formData.get('rateUnit')?.toString() || null;

  if (!role || (!profileId && !externalName)) return;

  await db.execute(sql`
    INSERT INTO project_assignments
      (project_id, profile_id, external_name, role, rate_sar, rate_unit, created_by)
    VALUES (
      ${projectId}::uuid,
      ${profileId ? sql`${profileId}::uuid` : sql`NULL`},
      ${profileId ? sql`NULL` : externalName},
      ${role}::project_assignment_role,
      ${rateSar ? sql`${rateSar}::numeric` : sql`NULL`},
      ${rateUnit},
      ${actor?.id ? sql`${actor.id}::uuid` : sql`NULL`}
    )
  `);

  revalidatePath(`/projects/${projectId}`);
}

export async function removeAssignment(projectId: string, assignmentId: string) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await db.execute(
    sql`DELETE FROM project_assignments WHERE id = ${assignmentId}::uuid`,
  );
  revalidatePath(`/projects/${projectId}`);
}

export async function addProjectTask(projectId: string, formData: FormData) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const [actor] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.authUserId, user.id))
    .limit(1);

  if (actor) {
    await db.execute(sql`SELECT set_config('app.acting_as', ${actor.id}, true)`);
  }

  const title = formData.get('title')?.toString();
  if (!title) return;
  const assigneeId = formData.get('assigneeId')?.toString() || null;
  const priority = formData.get('priority')?.toString() || 'normal';
  const dueAt = formData.get('dueAt')?.toString() || null;

  await db.execute(sql`
    INSERT INTO project_tasks (project_id, title, assignee_id, priority, due_at, created_by)
    VALUES (
      ${projectId}::uuid,
      ${title},
      ${assigneeId ? sql`${assigneeId}::uuid` : sql`NULL`},
      ${priority}::task_priority,
      ${dueAt ? sql`${dueAt}::timestamptz` : sql`NULL`},
      ${actor?.id ? sql`${actor.id}::uuid` : sql`NULL`}
    )
  `);

  revalidatePath(`/projects/${projectId}`);
  revalidatePath('/tasks');
}
