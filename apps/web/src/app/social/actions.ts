'use server';

import { revalidatePath } from 'next/cache';
import { sql, eq } from 'drizzle-orm';
import { db, profiles } from '@antagna/db';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { writeActivity } from '@/lib/activity';

const FORMATS = [
  'feed_image',
  'feed_carousel',
  'feed_video',
  'reel',
  'story',
  'short',
  'long_form_video',
  'live',
  'text',
];

/** Add a planned content post (manual content calendar — OAuth posting stays off, D-028). */
export async function createContentPost(formData: FormData): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const [actor] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.authUserId, user.id))
    .limit(1);

  const accountId = formData.get('accountId')?.toString() || null;
  const title = formData.get('title')?.toString().trim();
  const caption = formData.get('caption')?.toString().trim() || null;
  const format = formData.get('format')?.toString() || 'reel';
  const plannedPublishAt = formData.get('plannedPublishAt')?.toString() || null;
  if (!accountId || !title || !FORMATS.includes(format)) return;

  const code = 'CP-' + Date.now().toString(36).toUpperCase();
  await db.execute(sql`
    INSERT INTO content_posts
      (code, account_id, title, caption, format, status, planned_publish_at, created_by_id)
    VALUES (
      ${code}, ${accountId}::uuid, ${title}, ${caption},
      ${format}::post_format, 'idea'::post_status,
      ${plannedPublishAt ? sql`${plannedPublishAt}::timestamptz` : sql`NULL`},
      ${actor?.id ? sql`${actor.id}::uuid` : sql`NULL`}
    )
  `);

  await writeActivity({
    actorId: actor?.id ?? null,
    entityType: 'content_post',
    action: 'content_post_created',
    summaryAr: `فكرة محتوى جديدة: ${title}`,
    summaryEn: `New content idea: ${title}`,
    metadata: { format },
  });
  revalidatePath('/social');
}
