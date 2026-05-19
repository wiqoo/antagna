import { sql, eq } from 'drizzle-orm';
import { db, profiles } from '@antagna/db';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import type { NotificationItem } from '@antagna/ui';

export async function fetchNotifications(): Promise<NotificationItem[]> {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const [actor] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.authUserId, user.id))
    .limit(1);
  if (!actor) return [];

  const rows = (await db.execute<{
    id: string;
    title: string;
    body: string | null;
    link_url: string | null;
    read_at: Date | null;
    entity_type: string | null;
    created_at: Date;
  }>(sql`
    SELECT id::text AS id, title, body, link_url, read_at, entity_type, created_at
    FROM notifications
    WHERE recipient_id = ${actor.id}::uuid
    ORDER BY created_at DESC
    LIMIT 30
  `)) as unknown as Array<{
    id: string;
    title: string;
    body: string | null;
    link_url: string | null;
    read_at: Date | null;
    entity_type: string | null;
    created_at: Date;
  }>;

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    linkUrl: r.link_url,
    read: !!r.read_at,
    entityType: r.entity_type,
    createdAt: r.created_at,
  }));
}
