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
  MoneyDisplay,
  AIHints,
  type AIHint,
} from '@antagna/ui';
import { StatBox } from '@antagna/ui';
import { Shell } from '@/components/Shell';
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

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  available: 'success',
  checked_out: 'warning',
  repair: 'danger',
  lost: 'danger',
  retired: 'neutral',
};

const STATUS_LABEL_AR: Record<string, string> = {
  available: 'متاح',
  checked_out: 'في الموقع',
  repair: 'صيانة',
  lost: 'مفقود',
  retired: 'متقاعد',
};

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

  // Apply URL filters (?status=… / ?category=…) — the AI hints' actions link
  // here, and chips below let users clear or switch.
  const filteredItems = items.filter((it) => {
    if (statusFilter && it.status !== statusFilter) return false;
    if (categoryFilter && it.category !== categoryFilter) return false;
    return true;
  });

  const totalCount = items.length;
  const availableCount = statusCounts.find((s) => s.status === 'available')?.count ?? 0;
  const checkedOutCount = statusCounts.find((s) => s.status === 'checked_out')?.count ?? 0;
  const repairCount = statusCounts.find((s) => s.status === 'repair')?.count ?? 0;
  const totalInsurance = items.reduce(
    (s, i) => s + (i.insuranceValueSar ? Number(i.insuranceValueSar) : 0),
    0,
  );

  const byCategory = filteredItems.reduce<Record<string, typeof items>>((acc, it) => {
    (acc[it.category] ??= []).push(it);
    return acc;
  }, {});

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
      actions: [{ label: 'اعرض في الصيانة', href: '/equipment?status=repair' }],
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

      {(statusFilter || categoryFilter) && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-[var(--text-dim)]">تصفية نشطة:</span>
          {statusFilter && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-1 text-[12px] text-[var(--accent)]">
              الحالة: {STATUS_LABEL_AR[statusFilter] ?? statusFilter}
              <Link
                href={`/equipment${categoryFilter ? `?category=${categoryFilter}` : ''}`}
                aria-label="إزالة فلتر الحالة"
              >
                ✕
              </Link>
            </span>
          )}
          {categoryFilter && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-1 text-[12px] text-[var(--accent)]">
              الفئة: {categoryFilter}
              <Link
                href={`/equipment${statusFilter ? `?status=${statusFilter}` : ''}`}
                aria-label="إزالة فلتر الفئة"
              >
                ✕
              </Link>
            </span>
          )}
          <Link
            href="/equipment"
            className="text-[11px] text-[var(--text-muted)] underline hover:text-[var(--text)]"
          >
            مسح كل الفلاتر
          </Link>
          <span className="ms-auto text-[11px] text-[var(--text-dim)]">
            {filteredItems.length} من {totalCount}
          </span>
        </div>
      )}

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
          <span className="text-[11px] text-[var(--text-muted)]">
            {upcoming.length} حجز
          </span>
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

      <section className="space-y-8">
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
            {items.length} وحدة · {Object.keys(byCategory).length} فئة
          </span>
        </header>

        {Object.keys(byCategory).length === 0 ? (
          <Card>
            <EmptyState
              icon={<Camera size={18} />}
              title="الكتالوج فارغ"
              description="هتُستورَد المعدات من legacy DB في Pillar 15، أو أضف معدّة الآن."
              action={
                <Link
                  href="/equipment/new"
                  className="magnet inline-flex h-9 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[12px] font-semibold text-black hover:bg-[var(--accent-hover)]"
                >
                  <Plus size={14} />
                  إضافة معدّة
                </Link>
              }
            />
          </Card>
        ) : (
          Object.entries(byCategory).map(([cat, list]) => (
            <div key={cat} className="space-y-3">
              <div className="flex items-baseline justify-between">
                <h3 className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
                  {cat}
                </h3>
                <span className="text-[10px] text-[var(--text-dim)]">
                  {list.length} وحدة
                </span>
              </div>
              <div className="overflow-hidden rounded-lg border border-[var(--line)]">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--line)] bg-[var(--bg-elevated)]/60">
                      <th className="px-5 py-3 text-start text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
                        Model
                      </th>
                      <th className="px-5 py-3 text-start text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
                        Serial
                      </th>
                      <th className="px-5 py-3 text-start text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
                        Location
                      </th>
                      <th className="px-5 py-3 text-end text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
                        Insurance
                      </th>
                      <th className="px-5 py-3 text-start text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line)]">
                    {list.map((it) => (
                      <tr
                        key={it.id}
                        className="bg-[var(--bg-elevated)]/30 hover:bg-[var(--bg-elevated)]/80"
                      >
                        <td className="px-5 py-3.5">
                          <Link href={`/equipment/${it.id}`} className="group block">
                            <div className="text-[13px] text-[var(--text)] group-hover:text-[var(--accent)]">
                              {it.manufacturer && (
                                <span className="text-[var(--text-dim)]">
                                  {it.manufacturer}{' '}
                                </span>
                              )}
                              {it.model}
                              {it.requiresCharging && (
                                <Battery
                                  size={11}
                                  className="ms-2 inline text-[var(--text-dim)]"
                                />
                              )}
                            </div>
                            <div className="mt-0.5 font-mono text-[10px] text-[var(--text-dim)] opacity-70">
                              {it.code}
                            </div>
                          </Link>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-[11px] text-[var(--text-dim)]">
                          {it.serialNumber ?? '—'}
                        </td>
                        <td className="px-5 py-3.5 text-[12px] text-[var(--text-muted)]">
                          {it.currentLocation}
                        </td>
                        <td className="px-5 py-3.5 text-end">
                          {it.insuranceValueSar ? (
                            <MoneyDisplay
                              amount={Number(it.insuranceValueSar)}
                              currency="SAR"
                              className="text-[12px]"
                            />
                          ) : (
                            <span className="text-[11px] text-[var(--text-dim)]">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusPill tone={STATUS_TONE[it.status] ?? 'neutral'}>
                            {STATUS_LABEL_AR[it.status] ?? it.status}
                          </StatusPill>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </section>

      <div className="flex items-center justify-between border-t border-[var(--line)] pt-6 text-[10px] uppercase tracking-[0.22em] text-[var(--text-dim)]">
        <span>— Antagna Equipment</span>
        <span>Volt Production · Jeddah</span>
      </div>
    </Shell>
  );
}

