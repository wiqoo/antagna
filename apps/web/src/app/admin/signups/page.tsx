import Link from 'next/link';
import { asc, eq } from 'drizzle-orm';
import { db, profiles, positions } from '@antagna/db';
import { PageHeader, Card, CardHeader, StatBox, StatusPill, Avatar, EmptyState } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { ArrowLeft, UserPlus, MailWarning, Send, Clock } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requirePermission, can } from '@/lib/authz';
import { resendInviteAction } from './actions';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SignupsAdminPage(props: { searchParams: SearchParams }) {
  await requirePermission('access.manage');

  const params = await props.searchParams;
  const error = typeof params.error === 'string' ? params.error : null;
  const ok = typeof params.ok === 'string' ? params.ok : null;

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [pending, canResend] = await Promise.all([
    db
      .select({
        id: profiles.id,
        displayName: profiles.displayName,
        email: profiles.email,
        positionKey: profiles.positionKey,
        positionNameAr: positions.nameAr,
        createdAt: profiles.createdAt,
      })
      .from(profiles)
      .leftJoin(positions, eq(positions.key, profiles.positionKey))
      .where(eq(profiles.status, 'invited'))
      .orderBy(asc(profiles.createdAt)),
    can('user.invite'),
  ]);

  // Oldest pending invite age in days (gentle nudge on stale onboarding).
  // pending is sorted asc by createdAt, so [0] is the oldest.
  const now = Date.now();
  const oldest = pending[0];
  const oldestDays = oldest
    ? Math.floor((now - new Date(oldest.createdAt).getTime()) / 86_400_000)
    : 0;

  return (
    <Shell user={{ email: user?.email ?? '' }} activePath="/admin">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
      >
        <ArrowLeft size={14} className="rtl:rotate-180" /> الإدارة
      </Link>

      <PageHeader
        eyebrow="Admin · الانضمام"
        title="طلبات الانضمام"
        subtitle="الحسابات المدعوّة بانتظار إكمال التسجيل (status = invited). أعِد إرسال الدعوة عند الحاجة."
      />

      {ok && (
        <p className="rounded-lg border border-[var(--success)]/30 bg-[var(--success)]/10 px-3 py-2 text-[13px] text-[var(--success)]">
          {ok}
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
          {error}
        </p>
      )}

      {pending.length === 0 ? (
        <Card padded={false}>
          <EmptyState
            icon={<UserPlus size={20} />}
            title="لا طلبات انضمام معلّقة"
            description="كل المدعوّين أكملوا تسجيلهم، أو لم تُرسَل دعوات بعد. ادعُ مستخدماً جديداً لتظهر هنا."
            action={
              <Link
                href="/admin/invite-user"
                className="magnet inline-flex h-9 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)]"
              >
                <UserPlus size={14} />
                دعوة مستخدم
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatBox label="قيد الانتظار" value={pending.length} icon={<MailWarning size={16} />} tone="warning" />
            <StatBox
              label="أقدم دعوة"
              value={oldestDays}
              sub="يوماً"
              icon={<Clock size={16} />}
              tone={oldestDays > 7 ? 'danger' : 'default'}
            />
            <StatBox label="بانتظار التفعيل" value={pending.length} icon={<UserPlus size={16} />} />
          </section>

          <Card padded={false}>
            <div className="p-6 pb-4">
              <CardHeader title="الحسابات المدعوّة" subtitle={`${pending.length} حساب`} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--line)] bg-[var(--bg-elevated)]/40 text-start text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-dim)]">
                    <th className="px-5 py-3 text-start">الاسم</th>
                    <th className="px-5 py-3 text-start">البريد</th>
                    <th className="px-5 py-3 text-start">المنصب</th>
                    <th className="px-5 py-3 text-start">دُعي في</th>
                    <th className="px-5 py-3 text-start"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {pending.map((p) => (
                    <tr key={p.id} className="hover:bg-[var(--surface-hover)]">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={p.displayName} size="sm" />
                          <span className="text-[var(--text)]">{p.displayName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-[var(--text-muted)]" dir="ltr">
                        {p.email}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusPill tone="neutral" withDot={false}>
                          {p.positionNameAr ?? p.positionKey ?? '—'}
                        </StatusPill>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-[var(--text-dim)]">
                        {new Date(p.createdAt).toISOString().slice(0, 10)}
                      </td>
                      <td className="px-5 py-3.5 text-end">
                        {canResend && (
                          <form action={resendInviteAction}>
                            <input type="hidden" name="id" value={p.id} />
                            <button
                              type="submit"
                              title="إعادة إرسال الدعوة (الإرسال مُعطّل مؤقتاً)"
                              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[11px] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                            >
                              <Send size={12} />
                              إعادة الدعوة
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-[var(--line)] px-5 py-3 text-[11px] text-[var(--text-dim)]">
              ملاحظة: إرسال بريد الدعوة مُعطّل مؤقتاً (بانتظار موافقة الإدارة) — زر الإعادة يسجّل النية فقط ولا يرسل بريداً.
            </p>
          </Card>
        </>
      )}
    </Shell>
  );
}
