'use server';

import { redirect } from 'next/navigation';
import { sql, eq } from 'drizzle-orm';
import { db, profiles } from '@antagna/db';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function createProject(formData: FormData) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/projects/new');

  const [actor] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.authUserId, user.id))
    .limit(1);

  const templateId = formData.get('templateId')?.toString() || null;
  const clientId = formData.get('clientId')?.toString();
  const title = formData.get('title')?.toString();
  const titleAr = formData.get('titleAr')?.toString() || null;
  const projectType = formData.get('projectType')?.toString() ?? 'shoot';
  const pmId = formData.get('pmId')?.toString() || null;
  const amId = formData.get('amId')?.toString() || null;

  if (!clientId || !title) {
    throw new Error('clientId + title required');
  }

  if (actor) {
    await db.execute(sql`SELECT set_config('app.acting_as', ${actor.id}, true)`);
  }

  let newId: string;

  if (templateId) {
    const res = await db.execute<{ id: string }>(
      sql`SELECT public.fn_create_project_from_template(
        ${templateId}::uuid,
        ${clientId}::uuid,
        ${title}::text,
        ${projectType}::project_type
      ) AS id`,
    );
    const arr = res as unknown as Array<{ id: string }>;
    newId = arr[0]?.id ?? '';
  } else {
    // Raw insert so the DB-side `code` default (fn_next_project_code) fires.
    const res = await db.execute<{ id: string }>(
      sql`INSERT INTO projects (title, title_ar, client_id, project_type, stage, project_manager_id, account_manager_id, created_by)
          VALUES (
            ${title},
            ${titleAr},
            ${clientId}::uuid,
            ${projectType}::project_type,
            'brief'::project_stage,
            ${pmId ? sql`${pmId}::uuid` : sql`NULL`},
            ${amId ? sql`${amId}::uuid` : sql`NULL`},
            ${actor?.id ? sql`${actor.id}::uuid` : sql`NULL`}
          )
          RETURNING id`,
    );
    const arr = res as unknown as Array<{ id: string }>;
    newId = arr[0]?.id ?? '';
  }

  if (!newId) throw new Error('insert failed');

  if (templateId && (titleAr || pmId || amId)) {
    await db.execute(sql`
      UPDATE projects
      SET title_ar = ${titleAr},
          project_manager_id = ${pmId ? sql`${pmId}::uuid` : sql`NULL`},
          account_manager_id = ${amId ? sql`${amId}::uuid` : sql`NULL`}
      WHERE id = ${newId}::uuid
    `);
  }

  redirect(`/projects/${newId}`);
}
