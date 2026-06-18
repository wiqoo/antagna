import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { requireOwner } from '../auth';

export const dynamic = 'force-dynamic';

export default async function MorePage() {
  const me = await requireOwner();
  const c = (await db.execute(sql`
    SELECT
      (SELECT count(*)::int FROM me_waiting WHERE owner_id=${me.profileId}::uuid AND resolved=false) AS waiting,
      (SELECT count(*)::int FROM me_recurring WHERE owner_id=${me.profileId}::uuid AND active=true) AS recurring,
      (SELECT count(*)::int FROM me_notes WHERE owner_id=${me.profileId}::uuid) AS notes
  `)) as unknown as Array<{ waiting: number; recurring: number; notes: number }>;
  const { waiting = 0, recurring = 0, notes = 0 } = c[0] ?? {};

  const links = [
    { href: '/me/waiting', icon: '⏳', label: 'المعلّق', sub: `${waiting} مستني رد/تسليم` },
    { href: '/me/ask', icon: '🧠', label: 'اسأل مخّك', sub: 'اسأل عن أي حاجة في بياناتك' },
    { href: '/me/notes', icon: '📝', label: 'الملاحظات', sub: `${notes} ملاحظة مرجعية` },
    { href: '/me/review', icon: '🔄', label: 'المراجعة الأسبوعية', sub: 'مراجعة + ملخص بالـAI' },
    { href: '/me/growth', icon: '📈', label: 'التطوّر', sub: 'أهداف · عادات · تحليلات' },
    { href: '/me/recurring', icon: '♻️', label: 'المتكرر', sub: `${recurring} مهمة متكررة` },
  ];

  return (
    <div>
      <h1 className="mb-4 text-[22px] font-bold">المزيد</h1>
      <div className="flex flex-col gap-2.5">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3.5 active:bg-[var(--surface-hover)]">
            <span className="text-[22px]">{l.icon}</span>
            <div className="flex-1">
              <div className="text-[15px] font-medium">{l.label}</div>
              <div className="text-[11px] text-[var(--text-dim)]">{l.sub}</div>
            </div>
            <span className="text-[var(--text-dim)]">←</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
