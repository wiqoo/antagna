import { redirect } from 'next/navigation';
import { eq, asc } from 'drizzle-orm';
import {
  db,
  equipmentReservations,
  equipment,
  equipmentGroups,
  projects,
  profiles,
} from '@antagna/db';
import {
  PageHeader,
  Card,
  StatBox,
  EmptyState,
} from '@antagna/ui';
import { Shell } from '@/components/Shell';
import Link from 'next/link';
import { Calendar, CalendarClock, CalendarCheck, CalendarX, ArrowRight } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { canMany } from '@/lib/authz';
import { ReservationsManager, type ReservationRow } from './ReservationsManager';

export const dynamic = 'force-dynamic';

function windowOf(startsAt: Date, endsAt: Date, now: Date): ReservationRow['window'] {
  if (endsAt < now) return 'past';
  if (startsAt > now) return 'upcoming';
  return 'active';
}

export default async function EquipmentReservationsPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/equipment/reservations');

  const now = new Date();

  const [raw, perms] = await Promise.all([
    db
      .select({
        id: equipmentReservations.id,
        equipmentId: equipmentReservations.equipmentId,
        eqCode: equipment.code,
        eqModel: equipment.model,
        eqManufacturer: equipment.manufacturer,
        groupNameAr: equipmentGroups.nameAr,
        projectId: equipmentReservations.projectId,
        projectCode: projects.code,
        projectTitle: projects.title,
        projectTitleAr: projects.titleAr,
        startsAt: equipmentReservations.startsAt,
        endsAt: equipmentReservations.endsAt,
        status: equipmentReservations.status,
        notes: equipmentReservations.notes,
        reservedByName: profiles.displayName,
      })
      .from(equipmentReservations)
      .leftJoin(equipment, eq(equipment.id, equipmentReservations.equipmentId))
      .leftJoin(equipmentGroups, eq(equipmentGroups.id, equipmentReservations.groupId))
      .leftJoin(projects, eq(projects.id, equipmentReservations.projectId))
      .leftJoin(profiles, eq(profiles.id, equipmentReservations.reservedById))
      .orderBy(asc(equipmentReservations.startsAt))
      .limit(500),
    canMany(['equipment.checkout', 'equipment.return', 'equipment.update']),
  ]);

  const canCheckout = perms['equipment.checkout'] === true;
  const canReturn = perms['equipment.return'] === true;
  const canCancel = perms['equipment.update'] === true;

  const rows: ReservationRow[] = raw.map((r) => {
    const starts = new Date(r.startsAt);
    const ends = new Date(r.endsAt);
    return {
      id: r.id,
      equipmentId: r.equipmentId,
      eqCode: r.eqCode,
      eqModel: r.eqModel,
      eqManufacturer: r.eqManufacturer,
      groupNameAr: r.groupNameAr,
      projectId: r.projectId,
      projectCode: r.projectCode,
      projectTitle: r.projectTitle,
      projectTitleAr: r.projectTitleAr,
      startsAt: starts.toISOString(),
      endsAt: ends.toISOString(),
      status: r.status,
      notes: r.notes,
      reservedByName: r.reservedByName,
      window: windowOf(starts, ends, now),
      canCheckout,
      canReturn,
      canCancel,
    };
  });

  const total = rows.length;
  const activeCount = rows.filter((r) => r.window === 'active').length;
  const upcomingCount = rows.filter((r) => r.window === 'upcoming').length;
  const checkedOutCount = rows.filter((r) => r.status === 'checked_out').length;

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/equipment">
      <PageHeader
        eyebrow="المعدات · الحجوزات"
        title="حجوزات المعدات"
        subtitle="تسليم واسترجاع وإلغاء حجوزات المعدات حسب المشروع والتوقيت."
        action={
          <Link
            href="/equipment"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 text-[13px] font-semibold text-[var(--text)] hover:border-[var(--accent)]"
          >
            <ArrowRight size={15} />
            الكتالوج
          </Link>
        }
      />

      <section className="grid grid-cols-2 gap-4 stagger-in md:grid-cols-4">
        <StatBox label="إجمالي الحجوزات" value={total} sub="كل الحالات" icon={<Calendar size={16} />} />
        <StatBox
          label="جارٍ الآن"
          value={activeCount}
          tone={activeCount > 0 ? 'warning' : 'default'}
          sub="ضمن الفترة الحالية"
          icon={<CalendarClock size={16} />}
        />
        <StatBox
          label="قادمة"
          value={upcomingCount}
          sub="لم تبدأ بعد"
          icon={<CalendarCheck size={16} />}
        />
        <StatBox
          label="مُسلَّمة"
          value={checkedOutCount}
          tone={checkedOutCount > 0 ? 'warning' : 'default'}
          sub="في الموقع الآن"
          icon={<CalendarX size={16} />}
        />
      </section>

      <section className="space-y-5">
        <header className="flex items-end justify-between gap-4">
          <div>
            <p className="section-rule" style={{ minWidth: 120 }}>
              كل الحجوزات
            </p>
            <h2 className="mt-3 text-xl font-semibold text-[var(--text)]">إدارة الحجوزات</h2>
          </div>
          <span className="text-[11px] text-[var(--text-muted)]">{total} حجز</span>
        </header>

        {total === 0 ? (
          <Card>
            <EmptyState
              icon={<Calendar size={18} />}
              title="لا حجوزات بعد"
              description="احجز معدّة من صفحة المشروع أو الكتالوج لتظهر هنا، ثم سلّمها واسترجعها من هذه الصفحة."
              action={
                <Link
                  href="/equipment"
                  className="magnet inline-flex h-9 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)]"
                >
                  <ArrowRight size={14} />
                  افتح الكتالوج
                </Link>
              }
            />
          </Card>
        ) : (
          <ReservationsManager rows={rows} />
        )}
      </section>

      <div className="flex items-center justify-between border-t border-[var(--line)] pt-6 text-[10px] uppercase tracking-[0.22em] text-[var(--text-dim)]">
        <span>— Antagna Equipment · Reservations</span>
        <span>Volt Production · Jeddah</span>
      </div>
    </Shell>
  );
}
