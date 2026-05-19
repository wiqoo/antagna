import { redirect } from 'next/navigation';
import { sql, eq, asc, isNull, and, lte, gt } from 'drizzle-orm';
import {
  db,
  equipment,
  equipmentGroups,
  equipmentReservations,
  projects,
  profiles,
} from '@antagna/db';
import {
  AppShell,
  PageHeader,
  Card,
  CardHeader,
  StatusPill,
  MoneyDisplay,
  EmptyState,
  Avatar,
} from '@antagna/ui';
import { Camera, Calendar } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  available: 'success',
  checked_out: 'warning',
  repair: 'danger',
  lost: 'danger',
  retired: 'neutral',
};

const STATUS_LABEL: Record<string, string> = {
  available: 'متاح',
  checked_out: 'مخرج',
  repair: 'صيانة',
  lost: 'مفقود',
  retired: 'متقاعد',
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
        serialNumber: equipment.serialNumber,
        status: equipment.status,
        currentLocation: equipment.currentLocation,
        insuranceValueSar: equipment.insuranceValueSar,
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

  const totalInsurance = items.reduce(
    (s, i) => s + (i.insuranceValueSar ? Number(i.insuranceValueSar) : 0),
    0,
  );

  return (
    <AppShell user={{ email: user.email ?? '' }} activePath="/equipment">
      <PageHeader
        eyebrow="Equipment"
        title="المعدات"
        subtitle={`${items.length} وحدة · إجمالي قيمة التأمين ${totalInsurance.toLocaleString('en-US')} ر.س`}
      />

      {/* Status overview */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {statusCounts.map((s) => (
          <Card key={s.status} className="!p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-[--text-dim]">
              {STATUS_LABEL[s.status] ?? s.status}
            </p>
            <p className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-[--text]">
                {s.count}
              </span>
              <StatusPill
                tone={STATUS_TONE[s.status] ?? 'neutral'}
                withDot={false}
                className="!text-[9px]"
              >
                {s.status}
              </StatusPill>
            </p>
          </Card>
        ))}
      </section>

      {/* Upcoming reservations */}
      <Card padded={false}>
        <div className="p-6 pb-4">
          <CardHeader
            title="الحجوزات القادمة"
            subtitle="الـ14 يوم القادمة"
            action={
              <span className="inline-flex items-center gap-1 text-xs text-[--text-dim]">
                <Calendar size={12} />
                {upcoming.length}
              </span>
            }
          />
        </div>
        {upcoming.length === 0 ? (
          <EmptyState
            icon={<Calendar size={20} />}
            title="لا توجد حجوزات قادمة"
            description="المعدات هتظهر هنا لما يتم حجزها لمشروع."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[--line] bg-[--bg-elevated]/40 text-start text-[10px] font-semibold uppercase tracking-[0.15em] text-[--text-dim]">
                  <th className="px-5 py-3 text-start">المعدة</th>
                  <th className="px-5 py-3 text-start">المشروع</th>
                  <th className="px-5 py-3 text-start">المسؤول</th>
                  <th className="px-5 py-3 text-start">من</th>
                  <th className="px-5 py-3 text-start">إلى</th>
                  <th className="px-5 py-3 text-start">حالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[--line]">
                {upcoming.map((r) => (
                  <tr key={r.id} className="hover:bg-[--surface-hover]">
                    <td className="px-5 py-3.5">
                      {r.eqCode ? (
                        <div>
                          <span className="font-mono text-xs text-[--text-dim]">
                            {r.eqCode}
                          </span>{' '}
                          <span className="text-[--text]">{r.eqModel}</span>
                        </div>
                      ) : (
                        <span className="italic text-[--text-dim]">
                          مجموعة: {r.groupNameAr ?? '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {r.projectId ? (
                        <a
                          href={`/projects/${r.projectId}`}
                          className="hover:text-[--accent]"
                        >
                          <span className="font-mono text-xs text-[--text-dim]">
                            {r.projectCode}
                          </span>{' '}
                          <span className="text-sm">{r.projectTitle}</span>
                        </a>
                      ) : (
                        <span className="text-xs text-[--text-dim]">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {r.reservedByName ? (
                        <div className="flex items-center gap-2">
                          <Avatar name={r.reservedByName} size="sm" />
                          <span className="text-xs">{r.reservedByName}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-[--text-dim]">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-[--text-muted]">
                      {new Date(r.startsAt).toISOString().slice(0, 16).replace('T', ' ')}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-[--text-muted]">
                      {new Date(r.endsAt).toISOString().slice(0, 16).replace('T', ' ')}
                    </td>
                    <td className="px-5 py-3.5">
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
          </div>
        )}
      </Card>

      {/* Catalog */}
      <Card padded={false}>
        <div className="p-6 pb-4">
          <CardHeader
            title="الكتالوج"
            subtitle={`${items.length} وحدة معدات في قاعدة البيانات`}
          />
        </div>
        {items.length === 0 ? (
          <EmptyState
            icon={<Camera size={20} />}
            title="الكتالوج فاضي"
            description="هتُستورَد المعدات من legacy DB في Pillar 15."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[--line] bg-[--bg-elevated]/40 text-start text-[10px] font-semibold uppercase tracking-[0.15em] text-[--text-dim]">
                  <th className="px-5 py-3 text-start">code</th>
                  <th className="px-5 py-3 text-start">الفئة</th>
                  <th className="px-5 py-3 text-start">الموديل</th>
                  <th className="px-5 py-3 text-start">serial</th>
                  <th className="px-5 py-3 text-start">الموقع</th>
                  <th className="px-5 py-3 text-start">قيمة تأمين</th>
                  <th className="px-5 py-3 text-start">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[--line]">
                {items.map((it) => (
                  <tr key={it.id} className="hover:bg-[--surface-hover]">
                    <td className="px-5 py-3.5 font-mono text-xs text-[--text-dim]">
                      {it.code}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-[--text-muted]">
                      {it.category}
                    </td>
                    <td className="px-5 py-3.5">
                      {it.manufacturer && (
                        <span className="text-[--text-dim]">{it.manufacturer} </span>
                      )}
                      <span className="text-[--text]">{it.model}</span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-[--text-dim]">
                      {it.serialNumber ?? '—'}
                    </td>
                    <td className="px-5 py-3.5 text-xs">{it.currentLocation}</td>
                    <td className="px-5 py-3.5 text-end">
                      {it.insuranceValueSar ? (
                        <MoneyDisplay
                          amount={Number(it.insuranceValueSar)}
                          currency="SAR"
                          className="text-xs"
                        />
                      ) : (
                        <span className="text-xs text-[--text-dim]">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill tone={STATUS_TONE[it.status] ?? 'neutral'}>
                        {STATUS_LABEL[it.status] ?? it.status}
                      </StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AppShell>
  );
}
