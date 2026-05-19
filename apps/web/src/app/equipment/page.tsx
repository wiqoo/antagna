import { redirect } from 'next/navigation';
import { sql, eq, asc, isNull, and, gte, lte, gt } from 'drizzle-orm';
import {
  db,
  equipment,
  equipmentGroups,
  equipmentReservations,
  projects,
  profiles,
} from '@antagna/db';
import { AppShell, StatusPill, MoneyDisplay } from '@antagna/ui';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  available: 'success',
  checked_out: 'warning',
  repair: 'danger',
  lost: 'danger',
  retired: 'neutral',
};

export default async function EquipmentPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/equipment');

  const now = new Date();
  const in14d = new Date(Date.now() + 14 * 86_400_000);

  const [items, statusCounts, upcoming] = await Promise.all([
    db
      .select({
        id: equipment.id,
        code: equipment.code,
        category: equipment.category,
        manufacturer: equipment.manufacturer,
        model: equipment.model,
        modelNameAr: equipment.modelNameAr,
        serialNumber: equipment.serialNumber,
        status: equipment.status,
        currentLocation: equipment.currentLocation,
        insuranceValueSar: equipment.insuranceValueSar,
        requiresCharging: equipment.requiresCharging,
        lastChargedAt: equipment.lastChargedAt,
        groupCode: equipmentGroups.code,
        groupNameAr: equipmentGroups.nameAr,
      })
      .from(equipment)
      .leftJoin(equipmentGroups, eq(equipmentGroups.id, equipment.groupId))
      .where(isNull(equipment.archivedAt))
      .orderBy(asc(equipment.category), asc(equipment.code))
      .limit(200),
    db
      .select({
        status: equipment.status,
        count: sql<number>`count(*)::int`,
      })
      .from(equipment)
      .where(isNull(equipment.archivedAt))
      .groupBy(equipment.status),
    db
      .select({
        id: equipmentReservations.id,
        startsAt: equipmentReservations.startsAt,
        endsAt: equipmentReservations.endsAt,
        status: equipmentReservations.status,
        eqCode: equipment.code,
        eqModel: equipment.model,
        groupNameAr: equipmentGroups.nameAr,
        projectCode: projects.code,
        projectTitle: projects.title,
        projectId: projects.id,
        reservedByName: profiles.displayName,
      })
      .from(equipmentReservations)
      .leftJoin(equipment, eq(equipment.id, equipmentReservations.equipmentId))
      .leftJoin(equipmentGroups, eq(equipmentGroups.id, equipmentReservations.groupId))
      .leftJoin(projects, eq(projects.id, equipmentReservations.projectId))
      .leftJoin(profiles, eq(profiles.id, equipmentReservations.reservedById))
      .where(
        and(
          gt(equipmentReservations.endsAt, now),
          lte(equipmentReservations.startsAt, in14d),
        ),
      )
      .orderBy(asc(equipmentReservations.startsAt))
      .limit(30),
  ]);

  const totalInsuranceValue = items.reduce(
    (s, i) => s + (i.insuranceValueSar ? Number(i.insuranceValueSar) : 0),
    0,
  );

  return (
    <AppShell user={{ email: user.email ?? '' }} activePath="/equipment">
      <div className="space-y-5">
        <header>
          <h1 className="text-xl font-semibold">المعدات</h1>
          <p className="text-sm text-neutral-500">
            {items.length} وحدة · إجمالي قيمة التأمين:{' '}
            <span className="font-mono">
              {totalInsuranceValue.toLocaleString('en-US')} ر.س
            </span>
          </p>
        </header>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {statusCounts.map((s) => (
            <div
              key={s.status}
              className="rounded-md border border-neutral-800 bg-neutral-900 p-3"
            >
              <div className="text-xs uppercase tracking-wide text-neutral-500">
                {s.status}
              </div>
              <div className="mt-1 text-2xl font-semibold">{s.count}</div>
            </div>
          ))}
        </section>

        <section>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
            الحجوزات (الـ14 يوم القادمة)
          </h2>
          <div className="overflow-hidden rounded-md border border-neutral-800">
            {upcoming.length === 0 ? (
              <div className="bg-neutral-950 px-3 py-6 text-center text-xs text-neutral-500">
                لا حجوزات قادمة.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-neutral-900 text-left text-[11px] uppercase text-neutral-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">المعدة</th>
                    <th className="px-3 py-2 font-medium">المشروع</th>
                    <th className="px-3 py-2 font-medium">المسؤول</th>
                    <th className="px-3 py-2 font-medium">من</th>
                    <th className="px-3 py-2 font-medium">إلى</th>
                    <th className="px-3 py-2 font-medium">حالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800 bg-neutral-950">
                  {upcoming.map((r) => (
                    <tr key={r.id} className="hover:bg-neutral-900">
                      <td className="px-3 py-2 text-xs">
                        {r.eqCode ? (
                          <>
                            <span className="font-mono text-neutral-400">{r.eqCode}</span>{' '}
                            {r.eqModel}
                          </>
                        ) : (
                          <span className="italic text-neutral-500">
                            مجموعة: {r.groupNameAr ?? '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {r.projectId ? (
                          <a
                            href={`/projects/${r.projectId}`}
                            className="text-yellow-500 hover:underline"
                          >
                            <span className="font-mono">{r.projectCode}</span>{' '}
                            <span className="text-neutral-400">{r.projectTitle}</span>
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">{r.reservedByName ?? '—'}</td>
                      <td className="px-3 py-2 font-mono text-xs text-neutral-400">
                        {new Date(r.startsAt).toISOString().slice(0, 16).replace('T', ' ')}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-neutral-400">
                        {new Date(r.endsAt).toISOString().slice(0, 16).replace('T', ' ')}
                      </td>
                      <td className="px-3 py-2">
                        <StatusPill
                          tone={
                            r.status === 'checked_out'
                              ? 'warning'
                              : r.status === 'returned'
                                ? 'success'
                                : r.status === 'cancelled'
                                  ? 'neutral'
                                  : 'info'
                          }
                        >
                          {r.status}
                        </StatusPill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
            الكتالوج
          </h2>
          <div className="overflow-hidden rounded-md border border-neutral-800">
            {items.length === 0 ? (
              <div className="bg-neutral-950 px-3 py-6 text-center text-xs text-neutral-500">
                لا معدات بعد. هتُستورَد من legacy في Pillar 15.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-neutral-900 text-left text-[11px] uppercase text-neutral-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">code</th>
                    <th className="px-3 py-2 font-medium">الفئة</th>
                    <th className="px-3 py-2 font-medium">الموديل</th>
                    <th className="px-3 py-2 font-medium">serial</th>
                    <th className="px-3 py-2 font-medium">الموقع</th>
                    <th className="px-3 py-2 font-medium">قيمة تأمين</th>
                    <th className="px-3 py-2 font-medium">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800 bg-neutral-950">
                  {items.map((it) => (
                    <tr key={it.id} className="hover:bg-neutral-900">
                      <td className="px-3 py-2 font-mono text-xs text-neutral-400">
                        {it.code}
                      </td>
                      <td className="px-3 py-2 text-xs">{it.category}</td>
                      <td className="px-3 py-2 text-xs">
                        {it.manufacturer && <span className="text-neutral-500">{it.manufacturer}</span>}{' '}
                        {it.model}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-neutral-500">
                        {it.serialNumber ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-xs">{it.currentLocation}</td>
                      <td className="px-3 py-2 text-right">
                        {it.insuranceValueSar ? (
                          <MoneyDisplay
                            amount={Number(it.insuranceValueSar)}
                            currency="SAR"
                            className="text-xs"
                          />
                        ) : (
                          <span className="text-xs text-neutral-600">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <StatusPill tone={STATUS_TONE[it.status] ?? 'neutral'}>
                          {it.status}
                        </StatusPill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );

  void gte;
}
