import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { requireOwner } from '../auth';

export const dynamic = 'force-dynamic';

// PWA share-target landing: whatever was shared → inbox → back to inbox.
export default async function SharePage({ searchParams }: { searchParams: Promise<{ title?: string; text?: string; url?: string }> }) {
  const me = await requireOwner();
  const { title, text, url } = await searchParams;
  const content = [title, text, url].map((s) => (s ?? '').trim()).filter(Boolean).join(' ').slice(0, 2000);
  if (content) {
    await db.execute(sql`INSERT INTO me_inbox (owner_id, content, source) VALUES (${me.profileId}::uuid, ${content}, 'share')`);
  }
  redirect('/me/inbox');
}
