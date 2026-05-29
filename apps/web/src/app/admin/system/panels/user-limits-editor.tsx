'use client';

import { useMemo, useState, useTransition } from 'react';
import { Loader2, Check, Plus } from 'lucide-react';
import { StatusPill } from '@antagna/ui';
import { upsertUserLimit } from '../actions';

interface LimitRow {
  userId: string;
  name: string | null;
  email: string | null;
  dailyLimitUsd: number;
  monthlyLimitUsd: number;
  hardCap: boolean;
}

function Row({
  userId,
  name,
  daily,
  monthly,
  hard,
  canManage,
}: {
  userId: string;
  name: string;
  daily: number;
  monthly: number;
  hard: boolean;
  canManage: boolean;
}) {
  const [d, setD] = useState(String(daily));
  const [m, setM] = useState(String(monthly));
  const [h, setH] = useState(hard);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const dirty = Number(d) !== daily || Number(m) !== monthly || h !== hard;

  return (
    <tr className="hover:bg-[var(--surface-hover)]">
      <td className="px-5 py-3 text-sm text-[var(--text)]">{name}</td>
      <td className="px-5 py-3">
        <input
          type="number"
          min={0}
          step="0.5"
          value={d}
          disabled={!canManage}
          onChange={(e) => {
            setD(e.target.value);
            setSaved(false);
          }}
          className="h-8 w-20 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-end font-mono text-xs disabled:opacity-50"
        />
      </td>
      <td className="px-5 py-3">
        <input
          type="number"
          min={0}
          step="1"
          value={m}
          disabled={!canManage}
          onChange={(e) => {
            setM(e.target.value);
            setSaved(false);
          }}
          className="h-8 w-24 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-end font-mono text-xs disabled:opacity-50"
        />
      </td>
      <td className="px-5 py-3">
        <button
          onClick={() => {
            if (!canManage) return;
            setH((v) => !v);
            setSaved(false);
          }}
          disabled={!canManage}
          className={
            'rounded-md px-2 py-1 text-[11px] font-medium ' +
            (h
              ? 'bg-[var(--danger-tint)] text-[var(--danger)]'
              : 'bg-[var(--surface-hover)] text-[var(--text-dim)]')
          }
        >
          {h ? 'صارم' : 'تحذير فقط'}
        </button>
      </td>
      <td className="px-5 py-3 text-end">
        {canManage && (
          <div className="inline-flex items-center gap-2">
            {saved && !dirty && <span className="text-[10px] text-[var(--success)]">✓</span>}
            <button
              onClick={() =>
                start(async () => {
                  await upsertUserLimit({
                    userId,
                    dailyLimitUsd: Number(d),
                    monthlyLimitUsd: Number(m),
                    hardCap: h,
                  });
                  setSaved(true);
                })
              }
              disabled={pending || !dirty}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[11px] hover:border-[var(--accent)] disabled:opacity-40"
            >
              {pending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
              حفظ
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

export function UserLimitsEditor({
  limits,
  allUsers,
  canManage,
}: {
  limits: LimitRow[];
  allUsers: { id: string; name: string; email: string }[];
  canManage: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [pending, start] = useTransition();

  const existingIds = useMemo(() => new Set(limits.map((l) => l.userId)), [limits]);
  const unlisted = useMemo(
    () => allUsers.filter((u) => !existingIds.has(u.id)),
    [allUsers, existingIds],
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-y border-[var(--line)] bg-[var(--bg-elevated)]/40 text-start text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-dim)]">
            <th className="px-5 py-3 text-start">المستخدم</th>
            <th className="px-5 py-3 text-start">حد يومي $</th>
            <th className="px-5 py-3 text-start">حد شهري $</th>
            <th className="px-5 py-3 text-start">القفل</th>
            <th className="px-5 py-3 text-end"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--line)]">
          {limits.length === 0 && !adding && (
            <tr>
              <td colSpan={5} className="px-5 py-6 text-center text-xs text-[var(--text-muted)]">
                لا حدود مخصّصة — الكل على الافتراضي ($2 يومي / $30 شهري). أضِف حدًا لمستخدم.
              </td>
            </tr>
          )}
          {limits.map((l) => (
            <Row
              key={l.userId}
              userId={l.userId}
              name={l.name ?? l.email ?? l.userId.slice(0, 8)}
              daily={l.dailyLimitUsd}
              monthly={l.monthlyLimitUsd}
              hard={l.hardCap}
              canManage={canManage}
            />
          ))}
          {adding && (
            <tr className="bg-[var(--surface-hover)]/40">
              <td className="px-5 py-3" colSpan={4}>
                <select
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value)}
                  className="h-8 w-full max-w-sm rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-xs text-[var(--text)]"
                >
                  <option value="">— اختر مستخدمًا —</option>
                  {unlisted.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-5 py-3 text-end">
                <button
                  onClick={() => {
                    if (!newUserId) return;
                    start(async () => {
                      await upsertUserLimit({
                        userId: newUserId,
                        dailyLimitUsd: 2,
                        monthlyLimitUsd: 30,
                        hardCap: false,
                      });
                      setAdding(false);
                      setNewUserId('');
                    });
                  }}
                  disabled={pending || !newUserId}
                  className="inline-flex h-7 items-center gap-1 rounded-md bg-[var(--accent)] px-2.5 text-[11px] font-semibold text-white disabled:opacity-40"
                >
                  {pending ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                  إضافة
                </button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {canManage && !adding && unlisted.length > 0 && (
        <div className="border-t border-[var(--line)] p-3">
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-[var(--line)] px-3 py-1.5 text-[11px] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <Plus size={12} /> إضافة حد لمستخدم
          </button>
        </div>
      )}
      {!canManage && (
        <div className="border-t border-[var(--line)] px-5 py-3">
          <StatusPill tone="neutral">عرض فقط — تحتاج صلاحية ai.manage للتعديل</StatusPill>
        </div>
      )}
    </div>
  );
}
