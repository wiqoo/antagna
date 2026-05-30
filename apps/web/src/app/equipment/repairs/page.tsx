import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import {
  PageHeader,
  StatBox,
  AIHints,
  type AIHint,
} from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { ArrowLeft, Wrench, AlertTriangle, Send, CheckCircle2 } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/authz';
import { RepairsWorkspace, type RepairRow, type EquipOption } from './RepairsWorkspace';

export const dynamic = 'force-dynamic';

const rows = <T,>(r: unknown): T[] => r as unknown as T[];

export default async function EquipmentRepairsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; severity?: string; equipment?: string }>;
}) {
  const sp = await searchParams;
  const presetEquipmentId = sp.equipment?.trim() || null;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/equipment/repairs');

  // Page guard: viewing equipment repairs is gated on equipment.read.
  await requirePermission('equipment.read');

  const [repairR, equipR] = await Promise.all([
    db.execute(sql`
      SELECT
        r.id::text                         AS "id",
        r.equipment_id::text               AS "equipmentId",
        e.code                             AS "equipmentCode",
        e.model                            AS "equipmentModel",
        e.manufacturer                     AS "equipmentManufacturer",
        r.issue_description                AS "issueDescription",
        r.severity                         AS "severity",
        r.status                           AS "status",
        r.vendor                           AS "vendor",
        r.cost_sar                         AS "costSar",
        r.returned_at                      AS "eta",
        r.reported_at                      AS "reportedAt",
        prof.display_name                  AS "reporterName"
      FROM equipment_repairs r
      JOIN equipment e ON e.id = r.equipment_id
      LEFT JOIN profiles prof ON prof.id = r.reported_by_id
      ORDER BY
        CASE r.status WHEN 'reported' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
        r.reported_at DESC
      LIMIT 300
    `),
    // Bookable units to attach a new repair to (exclude retired).
    db.execute(sql`
      SELECT e.id::text AS "id", e.code, e.model, e.manufacturer, e.status::text AS status
      FROM equipment e
      WHERE e.archived_at IS NULL AND e.status <> 'retired'::equipment_status
      ORDER BY e.code
      LIMIT 500
    `),
  ]);

  const repairs = rows<RepairRow>(repairR);
  const equipmentOptions = rows<EquipOption>(equipR);

  const openCount = repairs.filter((r) => r.status === 'reported').length;
  const inProgressCount = repairs.filter((r) => r.status === 'in_progress').length;
  const fixedCount = repairs.filter((r) => r.status === 'fixed').length;
  const unusableOpen = repairs.filter(
    (r) => r.status !== 'fixed' && r.severity === 'unusable',
  ).length;

  const initialFilters: Record<string, string> = {};
  if (sp.status?.trim()) initialFilters.status = sp.status.trim();
  if (sp.severity?.trim()) initialFilters.severity = sp.severity.trim();

  // ── AI hints from real data ──────────────────────────────────────────────
  const today = new Date();
  const overdue = repairs.filter((r) => {
    if (r.status === 'fixed' || !r.eta) return false;
    return new Date(r.eta) < today;
  });
  const hints: AIHint[] = [];
  if (unusableOpen > 0) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: `${unusableOpen} معدّة معطّلة تماماً وما زالت مفتوحة`,
      insight: 'هذه أعلى أولوية — قد تعطّل تصويراً قادماً. ابدأ إصلاحها أولاً.',
      urgent: true,
      actions: [{ label: 'اعرض المعطّلة', href: '/equipment/repairs?severity=unusable', primary: true }],
    });
  }
  if (overdue.length > 0) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: `${overdue.length} إصلاح تجاوز موعد الإرجاع المتوقّع (ETA)`,
      insight: 'تابع مع جهة الإصلاح أو حدِّث الـ ETA حتى لا يَعلَق الحجز.',
      urgent: overdue.length >= 2,
      actions: [{ label: 'افتح قيد الإصلاح', href: '/equipment/repairs?status=in_progress' }],
    });
  }
  if (openCount > 0 && hints.length < 3) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: `${openCount} بلاغ جديد بانتظار البدء`,
      insight: 'حوّلها إلى «قيد الإصلاح» وأسندها لجهة إصلاح لتتابع الـ ETA.',
      actions: [{ label: 'اعرض الجديدة', href: '/equipment/repairs?status=reported' }],
    });
  }

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/equipment/repairs">
      <Link
        href="/equipment"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
      >
        <ArrowLeft size={14} className="rtl:rotate-180" /> المعدات
      </Link>

      {hints.length > 0 && (
        <AIHints
          context="Antagna AI · الصيانة"
          headline={`${openCount + inProgressCount} بلاغ مفتوح · ${fixedCount} مُصلَح`}
          hints={hints}
          compact
        />
      )}

      <PageHeader
        eyebrow="المعدات · الصيانة"
        title="الصيانة والتشخيص"
        subtitle="تتبّع أعطال المعدات من البلاغ حتى الإصلاح — مع جهة الإصلاح، الـ ETA، والتكلفة."
      />

      <section className="grid grid-cols-2 gap-4 stagger-in md:grid-cols-4">
        <StatBox
          label="بلاغات جديدة"
          value={openCount}
          tone={openCount > 0 ? 'danger' : 'default'}
          sub="بانتظار البدء"
          icon={<AlertTriangle size={16} />}
        />
        <StatBox
          label="قيد الإصلاح"
          value={inProgressCount}
          tone={inProgressCount > 0 ? 'warning' : 'default'}
          sub="مع جهة الإصلاح"
          icon={<Send size={16} />}
        />
        <StatBox
          label="معطّلة تماماً"
          value={unusableOpen}
          tone={unusableOpen > 0 ? 'danger' : 'default'}
          sub="أعلى أولوية"
          icon={<Wrench size={16} />}
        />
        <StatBox
          label="تم الإصلاح"
          value={fixedCount}
          tone="success"
          sub="عادت للتوفّر"
          icon={<CheckCircle2 size={16} />}
        />
      </section>

      <RepairsWorkspace
        rows={repairs}
        equipmentOptions={equipmentOptions}
        presetEquipmentId={presetEquipmentId}
        initialFilters={
          Object.keys(initialFilters).length > 0 ? initialFilters : undefined
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] pt-6 text-[10px] uppercase tracking-[0.22em] text-[var(--text-dim)]">
        <span>— Antagna Equipment · Repairs</span>
        <span>Volt Production · Jeddah</span>
      </div>
    </Shell>
  );
}
