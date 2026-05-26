'use client';

import { useMemo, useState, useTransition } from 'react';
import { Check, X, Minus, ShieldAlert } from 'lucide-react';
import {
  setUserRole, toggleRoleDefault, upsertUserOverride, removeUserOverride,
  assignCapability, removeCapability,
} from './actions';

type User = { id: string; name: string; role: string };
type Perm = { key: string; category: string; name: string; risk: string };
type Grant = { role: string; key: string };
type Cap = { key: string; name: string; category: string };
type UserCap = { profileId: string; key: string };
type Override = { profileId: string; key: string; granted: boolean };

const ROLE_AR: Record<string, string> = {
  system_admin: 'مدير النظام', general_manager: 'المدير العام', project_manager: 'مدير مشاريع',
  account_manager: 'مدير حسابات', hr: 'موارد بشرية', finance: 'مالية', user: 'مستخدم',
};

const TABS = [
  { id: 'roles', label: 'المستخدمون والأدوار' },
  { id: 'matrix', label: 'مصفوفة الصلاحيات' },
  { id: 'user', label: 'استثناءات وقدرات لكل مستخدم' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export function AccessManager({
  roles, users, permissions, grants, capabilities, userCaps, overrides,
}: {
  roles: string[];
  users: User[];
  permissions: Perm[];
  grants: Grant[];
  capabilities: Cap[];
  userCaps: UserCap[];
  overrides: Override[];
}) {
  const [tab, setTab] = useState<TabId>('roles');
  const [userId, setUserId] = useState(users[0]?.id ?? '');
  const [, start] = useTransition();

  const grantSet = useMemo(() => new Set(grants.map((g) => `${g.role}|${g.key}`)), [grants]);
  const byCat = useMemo(() => {
    const m = new Map<string, Perm[]>();
    for (const p of permissions) (m.get(p.category) ?? m.set(p.category, []).get(p.category)!).push(p);
    return [...m.entries()];
  }, [permissions]);

  const card = 'rounded-xl border border-white/[0.08] bg-[#17171C]';

  return (
    <div className="space-y-4">
      {/* tabs */}
      <div className="flex flex-wrap gap-1 rounded-lg border border-white/[0.08] bg-[#17171C] p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={'rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ' +
              (tab === t.id ? 'bg-[#FF6B1A] text-black' : 'text-white/60 hover:bg-white/[0.05] hover:text-white')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ─ Users + roles ─ */}
      {tab === 'roles' && (
        <div className={card + ' overflow-hidden'}>
          <table className="w-full text-[12.5px]">
            <thead className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-white/40">
              <tr><th className="px-4 py-2.5 text-start">المستخدم</th><th className="px-4 py-2.5 text-start">الدور</th></tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2 text-white">{u.name}</td>
                  <td className="px-4 py-2">
                    <select
                      defaultValue={u.role}
                      onChange={(e) => start(() => setUserRole(u.id, e.target.value))}
                      className="rounded-md border border-white/[0.1] bg-[#0F0F12] px-2 py-1 text-[12px] text-white outline-none focus:border-[#FF6B1A]/50"
                    >
                      {roles.map((r) => <option key={r} value={r}>{ROLE_AR[r] ?? r}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─ Role × permission matrix ─ */}
      {tab === 'matrix' && (
        <MatrixBody byCat={byCat} roles={roles} grantSet={grantSet} onToggle={(r, k) => start(() => toggleRoleDefault(r, k))} />
      )}

      {/* ─ Per-user overrides + capabilities ─ */}
      {tab === 'user' && (
        <div className="space-y-4">
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="rounded-md border border-white/[0.1] bg-[#0F0F12] px-2.5 py-1.5 text-[12.5px] text-white outline-none focus:border-[#FF6B1A]/50"
          >
            {users.map((u) => <option key={u.id} value={u.id}>{u.name} · {ROLE_AR[u.role] ?? u.role}</option>)}
          </select>

          {/* capabilities */}
          <div className={card + ' p-4'}>
            <p className="mb-3 font-mono text-[10px] uppercase tracking-wider text-white/45">// القدرات</p>
            <div className="flex flex-wrap gap-2">
              {capabilities.map((c) => {
                const on = userCaps.some((uc) => uc.profileId === userId && uc.key === c.key);
                return (
                  <button
                    key={c.key}
                    onClick={() => start(() => (on ? removeCapability(userId, c.key) : assignCapability(userId, c.key)))}
                    className={'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11.5px] transition-colors ' +
                      (on ? 'border-[#FF6B1A]/40 bg-[#FF6B1A]/10 text-[#FF8442]' : 'border-white/[0.1] text-white/55 hover:text-white')}
                  >
                    {on && <Check size={11} />}{c.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* overrides */}
          <div className={card + ' p-4'}>
            <p className="mb-3 font-mono text-[10px] uppercase tracking-wider text-white/45">// استثناءات الصلاحيات (تتجاوز الدور)</p>
            <div className="space-y-1">
              {permissions.map((p) => {
                const ov = overrides.find((o) => o.profileId === userId && o.key === p.key);
                const state: 'grant' | 'deny' | 'default' = ov ? (ov.granted ? 'grant' : 'deny') : 'default';
                const Btn = ({ s, icon, label }: { s: typeof state; icon: React.ReactNode; label: string }) => (
                  <button
                    title={label}
                    onClick={() => start(() => {
                      if (s === 'default') return removeUserOverride(userId, p.key);
                      return upsertUserOverride(userId, p.key, s === 'grant');
                    })}
                    className={'grid h-6 w-6 place-items-center rounded ' +
                      (state === s
                        ? (s === 'grant' ? 'bg-[#FF6B1A]/20 text-[#FF8442]' : s === 'deny' ? 'bg-white/10 text-white' : 'bg-white/[0.06] text-white/60')
                        : 'text-white/30 hover:bg-white/[0.05] hover:text-white/70')}
                  >{icon}</button>
                );
                return (
                  <div key={p.key} className="flex items-center gap-2 text-[11.5px]">
                    <span className="flex-1 font-mono text-white/70">{p.key}</span>
                    {p.risk === 'high' && <ShieldAlert size={11} className="text-[#FF6B1A]" />}
                    <Btn s="grant" icon={<Check size={12} />} label="سماح" />
                    <Btn s="deny" icon={<X size={12} />} label="منع" />
                    <Btn s="default" icon={<Minus size={12} />} label="افتراضي الدور" />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MatrixBody({
  byCat, roles, grantSet, onToggle,
}: {
  byCat: [string, Perm[]][];
  roles: string[];
  grantSet: Set<string>;
  onToggle: (role: string, key: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-[#17171C]">
      <table className="w-full text-[11.5px]">
        <thead className="border-b border-white/[0.06] text-[9.5px] uppercase tracking-wider text-white/40">
          <tr>
            <th className="px-3 py-2 text-start">الصلاحية</th>
            {roles.map((r) => <th key={r} className="px-1.5 py-2 text-center">{ROLE_AR[r] ?? r}</th>)}
          </tr>
        </thead>
        <tbody>
          {byCat.map(([cat, perms]) => (
            <FragmentRows key={cat} cat={cat} perms={perms} roles={roles} grantSet={grantSet} onToggle={onToggle} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FragmentRows({
  cat, perms, roles, grantSet, onToggle,
}: {
  cat: string; perms: Perm[]; roles: string[]; grantSet: Set<string>;
  onToggle: (role: string, key: string) => void;
}) {
  return (
    <>
      <tr className="bg-[#0F0F12]/60">
        <td colSpan={roles.length + 1} className="px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider text-white/35">{cat}</td>
      </tr>
      {perms.map((p) => (
        <tr key={p.key} className="border-t border-white/[0.04]">
          <td className="px-3 py-1.5">
            <span className="font-mono text-white/75">{p.key}</span>
            {p.risk === 'high' && <ShieldAlert size={10} className="ms-1.5 inline text-[#FF6B1A]" />}
          </td>
          {roles.map((r) => {
            const sysAdmin = r === 'system_admin';
            const on = sysAdmin || grantSet.has(`${r}|${p.key}`);
            return (
              <td key={r} className="px-1.5 py-1.5 text-center">
                <button
                  disabled={sysAdmin}
                  onClick={() => onToggle(r, p.key)}
                  className={'grid h-5 w-5 place-items-center rounded ' +
                    (on ? 'bg-[#FF6B1A]/20 text-[#FF8442]' : 'text-white/20 hover:bg-white/[0.05] hover:text-white/50') +
                    (sysAdmin ? ' opacity-60' : '')}
                  title={on ? 'مفعّلة' : 'غير مفعّلة'}
                >
                  {on ? <Check size={11} /> : <Minus size={10} />}
                </button>
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
