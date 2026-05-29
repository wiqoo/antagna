import { redirect } from 'next/navigation';
import { asc } from 'drizzle-orm';
import { db, positions, profiles } from '@antagna/db';
import { eq } from 'drizzle-orm';
import { PageHeader, Card, StatusPill } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { requirePermission } from '@/lib/authz';
import { getAdminUser } from '@/lib/auth-admin';
import { inviteUserAction } from './actions';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function InviteUserPage(props: { searchParams: SearchParams }) {
  // Page guard — lacking user.invite → /dashboard, signed out → /login.
  await requirePermission('user.invite');
  const admin = await getAdminUser();
  if (!admin) redirect('/login?next=/admin/invite-user');

  const params = await props.searchParams;
  const error = typeof params.error === 'string' ? params.error : null;
  const ok = typeof params.ok === 'string' ? params.ok : null;

  // The 16 positions (D-037), ordered for the dropdown.
  const positionRows = await db
    .select({ key: positions.key, nameAr: positions.nameAr, nameEn: positions.nameEn })
    .from(positions)
    .where(eq(positions.active, true))
    .orderBy(asc(positions.position), asc(positions.key));

  return (
    <Shell user={{ email: admin.user.email ?? '' }} activePath="/admin">
      <PageHeader
        eyebrow="Admin · دعوة"
        title="دعوة مستخدم"
        subtitle="إنشاء حساب بالدعوة فقط — المنصب يُسنَد لحظة الدعوة (D-040)"
      />

      <Card className="max-w-xl">
        {ok && (
          <p className="mb-4 rounded-lg border border-[var(--success)]/30 bg-[var(--success)]/10 px-3 py-2 text-[13px] text-[var(--success)]">
            {ok}
          </p>
        )}
        {error && (
          <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
            {error}
          </p>
        )}

        <form action={inviteUserAction} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="display_name" className="block text-[13px] text-[var(--text-muted)]">
              الاسم الظاهر
            </label>
            <input
              id="display_name"
              name="display_name"
              type="text"
              required
              autoFocus
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-2.5 text-[14px] text-[var(--text)] outline-none transition-colors focus:border-[var(--accent)]"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-[13px] text-[var(--text-muted)]">
              البريد الإلكتروني
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              dir="ltr"
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-2.5 text-[14px] text-[var(--text)] outline-none transition-colors focus:border-[var(--accent)]"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="position_key" className="block text-[13px] text-[var(--text-muted)]">
              المنصب
            </label>
            <select
              id="position_key"
              name="position_key"
              required
              defaultValue=""
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-2.5 text-[14px] text-[var(--text)] outline-none transition-colors focus:border-[var(--accent)]"
            >
              <option value="" disabled>
                اختر منصباً…
              </option>
              {positionRows.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.nameAr} · {p.nameEn}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <StatusPill tone="warning" withDot={false}>
              إرسال البريد مُعطّل
            </StatusPill>
            <span className="text-xs text-[var(--text-dim)]">
              يُنشأ الحساب بحالة “invited”؛ الإيميل بانتظار موافقة الإدارة.
            </span>
          </div>

          <button
            type="submit"
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
          >
            إنشاء الدعوة
          </button>
        </form>
      </Card>

      <RecentInvites />
    </Shell>
  );
}

async function RecentInvites() {
  const invited = await db
    .select({
      id: profiles.id,
      displayName: profiles.displayName,
      email: profiles.email,
      positionKey: profiles.positionKey,
    })
    .from(profiles)
    .where(eq(profiles.status, 'invited'))
    .orderBy(profiles.createdAt)
    .limit(20);

  if (invited.length === 0) return null;

  return (
    <Card padded={false} className="max-w-xl">
      <div className="border-b border-[var(--line)] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--text-dim)]">
        دعوات قيد الانتظار · {invited.length}
      </div>
      <ul className="divide-y divide-[var(--line)]">
        {invited.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
            <div className="min-w-0">
              <p className="truncate text-[var(--text)]">{p.displayName}</p>
              <p className="truncate font-mono text-xs text-[var(--text-muted)]">{p.email}</p>
            </div>
            <StatusPill tone="neutral" withDot={false}>
              {p.positionKey ?? '—'}
            </StatusPill>
          </li>
        ))}
      </ul>
    </Card>
  );
}
