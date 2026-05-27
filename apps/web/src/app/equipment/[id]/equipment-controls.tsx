'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Wrench,
  BatteryCharging,
  LogIn,
  Check,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import {
  checkoutReservation,
  returnReservation,
  setEquipmentStatus,
  markCharged,
} from './actions';

export type Reservation = {
  id: string;
  status: string;
  projectId: string | null;
  projectTitle: string | null;
  reserverName: string | null;
  startsAt: string;
  endsAt: string;
};

const btn =
  'inline-flex items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text)] disabled:opacity-50';
const primaryBtn =
  'inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50';

export function EquipmentControls({
  equipmentId,
  status,
  requiresCharging,
  reservations,
}: {
  equipmentId: string;
  status: string;
  requiresCharging: boolean;
  reservations: Reservation[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error ?? 'تعذّر تنفيذ الإجراء');
      else router.refresh();
    });

  const active = reservations.filter(
    (r) => r.status === 'reserved' || r.status === 'checked_out',
  );

  return (
    <div className="space-y-4">
      {/* Status actions */}
      <div className="flex flex-wrap items-center gap-2">
        {status === 'available' && (
          <button
            className={btn}
            disabled={pending}
            onClick={() => run(() => setEquipmentStatus(equipmentId, 'repair'))}
          >
            <Wrench size={13} /> إرسال للصيانة
          </button>
        )}
        {status === 'repair' && (
          <button
            className={primaryBtn}
            disabled={pending}
            onClick={() => run(() => setEquipmentStatus(equipmentId, 'available'))}
          >
            <Check size={13} /> إعادة للتوفّر
          </button>
        )}
        {requiresCharging && (
          <button
            className={btn}
            disabled={pending}
            onClick={() => run(() => markCharged(equipmentId))}
          >
            <BatteryCharging size={13} /> سُجِّل الشحن الآن
          </button>
        )}
      </div>

      {/* Reservations + checkout/return */}
      {active.length === 0 ? (
        <p className="text-[12px] text-[var(--text-dim)]">لا حجوزات نشطة على هذه المعدة.</p>
      ) : (
        <ul className="space-y-2">
          {active.map((r) => (
            <ReservationRow
              key={r.id}
              equipmentId={equipmentId}
              res={r}
              pending={pending}
              run={run}
            />
          ))}
        </ul>
      )}

      {error && (
        <p className="inline-flex items-center gap-1.5 text-[12px] text-[var(--danger)]">
          <AlertTriangle size={13} /> {error}
        </p>
      )}
    </div>
  );
}

function ReservationRow({
  equipmentId,
  res,
  pending,
  run,
}: {
  equipmentId: string;
  res: Reservation;
  pending: boolean;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>) => void;
}) {
  const [returning, setReturning] = useState(false);
  const [notes, setNotes] = useState('');
  const [damaged, setDamaged] = useState(false);

  return (
    <li className="rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 text-[12px]">
          <span className="text-[var(--text)]">
            {res.projectId && res.projectTitle ? (
              <Link
                href={`/projects/${res.projectId}`}
                className="hover:text-[var(--accent)]"
              >
                {res.projectTitle}
              </Link>
            ) : (
              'حجز عام'
            )}
          </span>
          <span className="mx-1.5 text-[var(--text-dim)]">·</span>
          <span className="text-[var(--text-muted)]">{res.reserverName ?? '—'}</span>
          <span className="mx-1.5 text-[var(--text-dim)]">·</span>
          <span className="font-mono text-[10px] text-[var(--text-dim)]">
            {new Date(res.startsAt).toISOString().slice(0, 10)} →{' '}
            {new Date(res.endsAt).toISOString().slice(0, 10)}
          </span>
        </div>

        {res.status === 'reserved' && (
          <button
            className={primaryBtn}
            disabled={pending}
            onClick={() => run(() => checkoutReservation(equipmentId, res.id))}
          >
            <LogIn size={13} /> تسليم
          </button>
        )}
        {res.status === 'checked_out' && !returning && (
          <button className={btn} disabled={pending} onClick={() => setReturning(true)}>
            <RotateCcw size={13} /> استرجاع
          </button>
        )}
      </div>

      {res.status === 'checked_out' && returning && (
        <div className="mt-2.5 space-y-2 border-t border-[var(--line)] pt-2.5">
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="ملاحظات الحالة (اختياري)"
            className="h-8 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[12px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
          />
          <div className="flex items-center justify-between gap-2">
            <label className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
              <input
                type="checkbox"
                checked={damaged}
                onChange={(e) => setDamaged(e.target.checked)}
                className="accent-[var(--danger)]"
              />
              وصلت بها أضرار
            </label>
            <div className="flex gap-2">
              <button className={btn} onClick={() => setReturning(false)} disabled={pending}>
                إلغاء
              </button>
              <button
                className={primaryBtn}
                disabled={pending}
                onClick={() =>
                  run(() =>
                    returnReservation(equipmentId, res.id, notes.trim() || null, damaged),
                  )
                }
              >
                <RotateCcw size={13} /> تأكيد الاسترجاع
              </button>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}
