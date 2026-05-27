import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { PageHeader } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { requirePermission } from '@/lib/authz';
import { getCurrentProfile } from '@/lib/view-as';
import { AccessManager } from './access-manager';

export const dynamic = 'force-dynamic';

const ROLES = [
  'system_admin', 'general_manager', 'project_manager', 'account_manager', 'hr', 'finance', 'user',
] as const;

const rows = <T,>(r: unknown): T[] => r as unknown as T[];

export default async function AccessPage() {
  await requirePermission('access.manage');
  const me = await getCurrentProfile();

  const [usersR, permsR, grantsR, capsR, userCapsR, overridesR] = await Promise.all([
    db.execute(sql`SELECT id::text AS id, display_name AS name, role FROM profiles WHERE archived_at IS NULL ORDER BY display_name`),
    db.execute(sql`SELECT key, category, description_ar AS name, risk_level AS risk FROM permissions ORDER BY category, key`),
    db.execute(sql`SELECT role, permission_key AS key FROM role_default_permissions`),
    db.execute(sql`SELECT key, name_ar AS name, category FROM capabilities WHERE active ORDER BY position, key`),
    db.execute(sql`SELECT profile_id::text AS "profileId", capability_key AS key FROM user_capabilities`),
    db.execute(sql`SELECT profile_id::text AS "profileId", permission_key AS key, granted FROM user_permission_overrides`),
  ]);

  return (
    <Shell user={{ email: me?.email ?? '' }} activePath="/admin">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]">
        ← الإدارة
      </Link>
      <PageHeader
        eyebrow="Access control"
        title="الأدوار والصلاحيات"
        subtitle="تحكّم دقيق لكل إجراء: عيّن الأدوار، فعّل صلاحيات كل دور، أضف استثناءات لكل مستخدم، وأدِر القدرات."
      />
      <AccessManager
        roles={[...ROLES]}
        users={rows<{ id: string; name: string; role: string }>(usersR)}
        permissions={rows<{ key: string; category: string; name: string; risk: string }>(permsR)}
        grants={rows<{ role: string; key: string }>(grantsR)}
        capabilities={rows<{ key: string; name: string; category: string }>(capsR)}
        userCaps={rows<{ profileId: string; key: string }>(userCapsR)}
        overrides={rows<{ profileId: string; key: string; granted: boolean }>(overridesR)}
      />
    </Shell>
  );
}
