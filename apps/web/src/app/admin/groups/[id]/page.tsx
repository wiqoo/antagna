import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { and, asc, eq, notInArray } from 'drizzle-orm';
import { db, squads, squadMembers, profiles } from '@antagna/db';
import {
  PageHeader,
  Card,
  CardHeader,
  StatusPill,
  EmptyState,
  Avatar,
} from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { getAdminUser } from '@/lib/auth-admin';
import { requirePermission } from '@/lib/authz';
import { Users2, ChevronRight, Star } from 'lucide-react';
import { SQUAD_PURPOSES, PURPOSE_LABEL_AR } from '../constants';
import { updateSquad, addSquadMember } from '../actions';
import { SquadSettings } from './SquadSettings';
import { MemberControls } from '../MemberControls';

export const dynamic = 'force-dynamic';

const inputCls =
  'h-9 w-full rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)]';
const labelCls = 'mb-1 block text-[11px] font-medium text-[var(--text-dim)]';

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SquadDetailPage(props: {
  params: Params;
  searchParams: SearchParams;
}) {
  await requirePermission('access.manage');
  const admin = await getAdminUser();
  if (!admin) redirect('/login?next=/admin/groups');

  const { id } = await props.params;
  const sp = await props.searchParams;
  const error = typeof sp.error === 'string' ? sp.error : null;
  const ok = typeof sp.ok === 'string' ? sp.ok : null;

  const [squad] = await db.select().from(squads).where(eq(squads.id, id)).limit(1);
  if (!squad) notFound();

  // Current members joined to profiles.
  const members = await db
    .select({
      profileId: squadMembers.profileId,
      defaultRole: squadMembers.defaultRole,
      isCore: squadMembers.isCore,
      notes: squadMembers.notes,
      displayName: profiles.displayName,
      email: profiles.email,
      positionKey: profiles.positionKey,
    })
    .from(squadMembers)
    .innerJoin(profiles, eq(profiles.id, squadMembers.profileId))
    .where(eq(squadMembers.squadId, id))
    .orderBy(asc(profiles.displayName));

  const memberIds = members.map((m) => m.profileId);

  // Candidates for "add member" = active profiles not already in the squad.
  const candidates = await db
    .select({ id: profiles.id, displayName: profiles.displayName, positionKey: profiles.positionKey })
    .from(profiles)
    .where(
      memberIds.length > 0
        ? and(eq(profiles.status, 'active'), notInArray(profiles.id, memberIds))
        : eq(profiles.status, 'active'),
    )
    .orderBy(asc(profiles.displayName));

  return (
    <Shell user={{ email: admin.user.email ?? '' }} activePath="/admin">
      <nav className="flex items-center gap-1.5 text-[12px] text-[var(--text-dim)]">
        <Link href="/admin/groups" className="hover:text-[var(--accent)]">
          المجموعات
        </Link>
        <ChevronRight size={13} className="rotate-180" />
        <span className="font-mono text-[var(--text-muted)]">{squad.code}</span>
      </nav>

      <PageHeader
        eyebrow="Admin · مجموعة"
        title={squad.nameAr}
        subtitle={
          [
            squad.purpose ? (PURPOSE_LABEL_AR[squad.purpose] ?? squad.purpose) : null,
            `${members.length} عضو`,
          ]
            .filter(Boolean)
            .join(' · ')
        }
        action={<SquadSettings id={squad.id} active={squad.active} />}
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.4fr]">
        {/* Edit squad meta */}
        <Card>
          <CardHeader title="بيانات المجموعة" />
          <form action={updateSquad} className="mt-4 space-y-3">
            <input type="hidden" name="id" value={squad.id} />
            <div>
              <label className={labelCls}>الرمز (code)</label>
              <input
                value={squad.code}
                disabled
                className={`${inputCls} font-mono opacity-60`}
              />
            </div>
            <div>
              <label className={labelCls}>الاسم (عربي)</label>
              <input name="name_ar" defaultValue={squad.nameAr} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>الاسم (إنجليزي)</label>
              <input name="name_en" defaultValue={squad.nameEn ?? ''} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>الغرض</label>
              <select name="purpose" defaultValue={squad.purpose ?? ''} className={inputCls}>
                <option value="">— بدون —</option>
                {SQUAD_PURPOSES.map((p) => (
                  <option key={p} value={p}>
                    {PURPOSE_LABEL_AR[p] ?? p}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="magnet inline-flex h-9 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)]"
            >
              حفظ
            </button>
          </form>
        </Card>

        {/* Members */}
        <Card padded={false}>
          <div className="p-6 pb-4">
            <CardHeader title="الأعضاء" subtitle={`${members.length} عضو`} />
          </div>

          {/* Add member */}
          {candidates.length > 0 && (
            <form
              action={addSquadMember}
              className="flex flex-wrap items-end gap-2 border-b border-[var(--line)] px-6 pb-4"
            >
              <input type="hidden" name="squad_id" value={squad.id} />
              <div className="min-w-[160px] flex-1">
                <label className={labelCls}>إضافة عضو</label>
                <select name="profile_id" defaultValue="" className={inputCls} required>
                  <option value="" disabled>
                    — اختر عضواً —
                  </option>
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.displayName}
                      {c.positionKey ? ` · ${c.positionKey}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-[120px]">
                <label className={labelCls}>الدور الافتراضي</label>
                <input name="default_role" placeholder="مصوّر…" className={inputCls} />
              </div>
              <label className="flex h-9 cursor-pointer items-center gap-2 text-[12px] text-[var(--text)]">
                <input type="checkbox" name="is_core" defaultChecked className="h-4 w-4 accent-[var(--accent)]" />
                أساسي
              </label>
              <button
                type="submit"
                className="magnet inline-flex h-9 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)]"
              >
                إضافة
              </button>
            </form>
          )}

          {members.length === 0 ? (
            <EmptyState
              icon={<Users2 size={20} />}
              title="لا أعضاء بعد"
              description="أضف أعضاء من القائمة أعلاه ليظهروا هنا."
            />
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {members.map((m) => (
                <li
                  key={m.profileId}
                  className="flex items-center gap-3 px-6 py-3.5 hover:bg-[var(--surface-hover)]"
                >
                  <Avatar name={m.displayName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm text-[var(--text)]">
                      {m.displayName}
                      {m.isCore && <Star size={11} className="text-[var(--accent)]" fill="currentColor" />}
                    </p>
                    <p className="text-[11px] text-[var(--text-dim)]">
                      {m.defaultRole || m.positionKey || m.email}
                    </p>
                  </div>
                  {!m.isCore && (
                    <StatusPill tone="neutral" withDot={false}>
                      مساعد
                    </StatusPill>
                  )}
                  <MemberControls squadId={squad.id} profileId={m.profileId} isCore={m.isCore} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </Shell>
  );
}
