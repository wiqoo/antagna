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
  PageHeader,
  Card,
  StatusPill,
  EmptyState,
  Counter,
  AIHints,
  type AIHint,
} from '@antagna/ui';
import { StatBox } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { EquipmentCatalog } from './EquipmentCatalog';
import Link from 'next/link';
import {
  Camera,
  Calendar,
  Plus,
  Battery,
  Wrench,
  CheckCircle2,
  ScanLine,
  Boxes,
} from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getTranslations } from 'next-intl/server';

export const dynamic = 'force-dynamic';

export default async function EquipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string }>;
}) {
  const sp = await searchParams;
  const statusFilter = sp.status?.trim() || null;
  const categoryFilter = sp.category?.trim() || null;

  const supabase = await getSupabaseServerClient();
  const t = await getTranslations('pages.equipment');
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
        requiresCharging: equipment.requiresCharging,
        photoUrl: equipment.photoUrl,
        groupNameAr: equipmentGroups.nameAr,
      })
      .from(equipment)
      .leftJoin(equipmentGroups, eq(equipmentGroups.id, equipment.groupId))
      .where(isNull(equipment.archivedAt))
      .orderBy(asc(equipment.category), asc(equipment.code))
      .limit(200),
    db
      .select({ status: equipment.status, count: sql<number>`count(*)::int` })
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
        projectTitleAr: projects.titleAr,
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

  // ?status= / ?category= AI-hint deep links become the catalog's initial
  // filters (applied client-side inside ListWorkspace).
  const initialFilters: Record<string, string> = {};
  if (statusFilter) initialFilters.status = statusFilter;
  if (categoryFilter) initialFilters.category = categoryFilter;

  const totalCount = items.length;
  const availableCount = statusCounts.find((s) => s.status === 'available')?.count ?? 0;
  const checkedOutCount = statusCounts.find((s) => s.status === 'checked_out')?.count ?? 0;
  const repairCount = statusCounts.find((s) => s.status === 'repair')?.count ?? 0;
  const totalInsurance = items.reduce(
    (s, i) => s + (i.insuranceValueSar ? Number(i.insuranceValueSar) : 0),
    0,
  );

  // ── AI hints from real data ────────────────────────────────────────────
  const reservationsByEq = new Map<string, number>();
  for (const r of upcoming) {
    if (!r.eqCode) continue;
    reservationsByEq.set(r.eqCode, (reservationsByEq.get(r.eqCode) ?? 0) + 1);
  }
  const conflicts = Array.from(reservationsByEq.entries()).filter(([, n]) => n > 1);
  const lowBattery = items.filter((i) => i.requiresCharging && i.status === 'available').length;

  const hints: AIHint[] = [];
  if (conflicts.length > 0) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: `${conflicts.length} معدّة عليها حجوزات متداخلة`,
      insight: 'راجع الحجز الأقدم أولاً، أو اقترح بديلاً من نفس المجموعة.',
      urgent: true,
      actions: [{ label: 'افتح الحجوزات', href: '#reservations', primary: true }],
    });
  }
  if (repairCount > 0) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: `${repairCount} معدّة في الصيانة`,
      insight: 'تحقق من ETA الإصلاح قبل الحجز القادم.',
      urgent: repairCount >= 3,
      actions: [{ label: 'افتح متتبّع الصيانة', href: '/equipment/repairs' }],
    });
  }
  if (lowBattery > 0 && hints.length < 3) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: `${lowBattery} معدّة تحتاج شحن قبل التصوير القادم`,
      insight: 'تحقّق من البطاريات/الذاكرة في كل واحدة منها.',
      actions: [{ label: 'افتح الجاهزة', href: '/equipment?status=available' }],
    });
  }

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/equipment">
      {hints.length > 0 && (
        <AIHints
          context="Antagna AI · المعدات"
          headline={`${totalCount} معدّة · ${availableCount} متاح · ${checkedOutCount} في الموقع`}
          hints={hints}
          compact
        />
      )}
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('title')}
        subtitle={t('subtitle')}
        action={
          <div className="flex gap-2">
            <Link
              href="/equipment/reservations"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 text-[13px] font-semibold text-[var(--text)] hover:border-[var(--accent)]"
            >
              <Calendar size={15} />
              الحجوزات
            </Link>
            <Link
              href="/equipment/repairs"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 text-[13px] font-semibold text-[var(--text)] hover:border-[var(--accent)]"
            >
              <Wrench size={15} />
              الصيانة
              {repairCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--danger)] px-1.5 text-[10px] font-bold text-white">
                  {repairCount}
                </span>
              )}
            </Link>
            <Link
              href="/equipment/kits"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 text-[13px] font-semibold text-[var(--text)] hover:border-[var(--accent)]"
            >
              <Boxes size={15} />
              الكيتات
            </Link>
            <Link
              href="/equipment/scan"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 text-[13px] font-semibold text-[var(--text)] hover:border-[var(--accent)]"
            >
              <ScanLine size={15} />
              مسح QR
            </Link>
            <Link
              href="/equipment/new"
              className="magnet inline-flex h-10 items-center gap-2 rounded-md bg-[var(--accent)] px-5 text-[13px] font-semibold text-white hover:bg-[var(--accent-hover)]"
            >
              <Plus size={15} />
              إضافة معدّة
            </Link>
          </div>
        }
      />

      <section className="grid grid-cols-2 gap-4 stagger-in md:grid-cols-4">
        <StatBox
          label="إجمالي"
          value={totalCount}
          sub="وحدة في الكتالوج"
          icon={<Camera size={16} />}
        />
        <StatBox
          label="متاح"
          value={availableCount}
          tone="success"
          sub={`${totalCount > 0 ? Math.round((availableCount / totalCount) * 100) : 0}% من الإجمالي`}
          icon={<CheckCircle2 size={16} />}
        />
        <StatBox
          label="في الموقع"
          value={checkedOutCount}
          tone="warning"
          sub="مع طاقم تصوير"
          icon={<Battery size={16} />}
        />
        <StatBox
          label="صيانة"
          value={repairCount}
          tone={repairCount > 0 ? 'danger' : 'default'}
          sub={
            repairCount > 0
              ? 'تحتاج متابعة'
              : 'لا توجد معدات في الصيانة'
          }
          icon={<Wrench size={16} />}
        />
      </section>

      <div className="flex items-center justify-between border-y border-[var(--line)] py-4">
        <div className="flex items-center gap-6">
          <p className="section-rule" style={{ minWidth: 140 }}>
            القيمة المؤمَّن عليها
          </p>
          <p className="text-2xl font-bold text-[var(--text)] tabular">
            <Counter to={totalInsurance} />
            <span className="ms-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-dim)]">
              SAR
            </span>
          </p>
        </div>
        <p className="hidden text-[11px] text-[var(--text-muted)] md:block">
          محسوبة من{' '}
          <span className="text-[var(--text)]">
            {items.filter((i) => i.insuranceValueSar).length}
          </span>{' '}
          وحدة لها تأمين مسجَّل
        </p>
      </div>

      <section id="reservations" className="space-y-5 scroll-mt-24">
        <header className="flex items-end justify-between gap-4">
          <div>
            <p className="section-rule" style={{ minWidth: 160 }}>
              الحجوزات القادمة
            </p>
            <h2 className="mt-3 text-xl font-semibold text-[var(--text)]">
              الأسبوعين القادمين
            </h2>
          </div>
          <Link
            href="/equipment/reservations"
            className="text-[11px] text-[var(--text-muted)] hover:text-[var(--accent)]"
          >
            {upcoming.length} حجز · إدارة الحجوزات ←
          </Link>
        </header>

        {upcoming.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Calendar size={18} />}
              title="لا حجوزات قادمة"
              description="ابدأ بحجز معدة من صفحة المشروع لتأمين التواجد قبل التصوير."
            />
          </Card>
        ) : (
          <div className="space-y-px stagger-in">
            {upcoming.map((r) => {
              const startStr = new Date(r.startsAt).toISOString();
              const dateStr = startStr.slice(0, 10);
              const timeStr = startStr.slice(11, 16);
              return (
                <div
                  key={r.id}
                  className="grid grid-cols-[80px_1fr_auto] items-center gap-5 border-b border-[var(--line)] bg-[var(--bg-elevated)]/40 px-5 py-4 hover:bg-[var(--bg-elevated)]/80"
                >
                  <div>
                    <p className="font-mono text-[11px] text-[var(--text-dim)]">{dateStr}</p>
                    <p className="font-mono text-[14px] text-[var(--text)]">{timeStr}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] text-[var(--text)]">
                      {r.eqCode ? (
                        <>
                          <span className="font-mono text-[10px] text-[var(--text-dim)]">
                            {r.eqCode}
                          </span>{' '}
                          <span>{r.eqModel}</span>
                        </>
                      ) : (
                        <span className="italic text-[var(--text-muted)]">
                          مجموعة: {r.groupNameAr ?? '—'}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                      {r.projectId ? (
                        <Link
                          href={`/projects/${r.projectId}`}
                          className="hover:text-[var(--accent)]"
                        >
                          <span className="font-mono">{r.projectCode}</span>{' '}
                          {r.projectTitleAr ?? r.projectTitle}
                        </Link>
                      ) : (
                        '—'
                      )}
                      {r.reservedByName && (
                        <>
                          {' '}· بإذن{' '}
                          <span className="text-[var(--text)]">{r.reservedByName}</span>
                        </>
                      )}
                    </p>
                  </div>
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
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-5">
        <header className="flex items-end justify-between gap-4">
          <div>
            <p className="section-rule" style={{ minWidth: 100 }}>
              الكتالوج
            </p>
            <h2 className="mt-3 text-xl font-semibold text-[var(--text)]">
              كل المعدات
            </h2>
          </div>
          <span className="text-[11px] text-[var(--text-muted)]">
            {totalCount} وحدة
          </span>
        </header>

        {totalCount === 0 ? (
          <Card>
            <EmptyState
              icon={<Camera size={18} />}
              title="الكتالوج فارغ"
              description="هتُستورَد المعدات من legacy DB في Pillar 15، أو أضف معدّة الآن."
              action={
                <Link
                  href="/equipment/new"
                  className="magnet inline-flex h-9 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--accent-hover)]"
                >
                  <Plus size={14} />
                  إضافة معدّة
                </Link>
              }
            />
          </Card>
        ) : (
          <EquipmentCatalog
            items={items}
            initialFilters={
              Object.keys(initialFilters).length > 0 ? initialFilters : undefined
            }
          />
        )}
      </section>

      <div className="flex items-center justify-between border-t border-[var(--line)] pt-6 text-[10px] uppercase tracking-[0.22em] text-[var(--text-dim)]">
        <span>— Antagna Equipment</span>
        <span>Volt Production · Jeddah</span>
      </div>
    </Shell>
  );
}

