import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';

export interface Area {
  id: string;
  key: string;
  name: string;
  icon: string;
  color: string;
  position: number;
}

// The default life areas — tuned for Mohammed (production lead + photographer
// running Volt, plus a personal life). He can rename/recolour later.
export const DEFAULT_AREAS: Array<Omit<Area, 'id'>> = [
  { key: 'work', name: 'الشغل وفولت', icon: '🎬', color: '#FF6B1A', position: 0 },
  { key: 'money', name: 'الفلوس', icon: '💰', color: '#34D399', position: 1 },
  { key: 'health', name: 'الصحة والطاقة', icon: '🫀', color: '#F87171', position: 2 },
  { key: 'growth', name: 'التطوّر والتعلّم', icon: '📈', color: '#60A5FA', position: 3 },
  { key: 'relationships', name: 'الناس والعلاقات', icon: '🤝', color: '#A78BFA', position: 4 },
  { key: 'hobbies', name: 'الهوايات والتصوير', icon: '📷', color: '#FBBF24', position: 5 },
];

/** Seed the default areas once per owner (idempotent on (owner,key)). */
export async function ensureAreas(ownerId: string): Promise<Area[]> {
  for (const a of DEFAULT_AREAS) {
    await db.execute(sql`
      INSERT INTO me_areas (owner_id, key, name, icon, color, position)
      VALUES (${ownerId}::uuid, ${a.key}, ${a.name}, ${a.icon}, ${a.color}, ${a.position})
      ON CONFLICT (owner_id, key) DO NOTHING
    `);
  }
  return listAreas(ownerId);
}

export async function listAreas(ownerId: string): Promise<Area[]> {
  return (await db.execute(sql`
    SELECT id::text, key, name, icon, color, position
    FROM me_areas WHERE owner_id = ${ownerId}::uuid AND active = true
    ORDER BY position, created_at
  `)) as unknown as Area[];
}
