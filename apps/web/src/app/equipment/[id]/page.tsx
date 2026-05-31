import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { sql, eq as drizzleEq } from 'drizzle-orm';
import { db, equipmentGroups, vEquipmentSafe, withProfileScope } from '@antagna/db';
import { requirePermission, getEffectiveProfileId } from '@/lib/authz';
import { PageHeader, Card, CardHeader, StatusPill, EmptyState } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import {
  ArrowLeft,
  Camera,
  MapPin,
  History,
  BatteryCharging,
  Package,
  Wrench,
} from 'lucide-react';
import QRCode from 'qrcode';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { EquipmentControls, type Reservation } from './equipment-controls';

export const dynamic = 'force-dynamic';

const rows = <T,>(r: unknown): T[] => r as unknown as T[];

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  available: 'success',
  checked_out: 'warning',
  repair: 'warning',
  lost: 'danger',
  retired: 'neutral',
};
const STATUS_AR: Record<string, string> = {
  available: 'متوفّرة',
  checked_out: 'مُستلَمة',
  repair: 'في الصيانة',
  lost: 'مفقودة',
  retired: 'مُتقاعدة',
};

type Equip = {
  id: string;
  code: string;
  category: string;
  manufacturer: string | null;
  model: string;
  modelNameAr: string | null;
  serialNumber: string | null;
  status: string;
  currentLocation: string;
  photoUrl: string | null;
  requiresCharging: boolean;
  lastChargedAt: string | null;
  purchasePriceSar: string | null;
  insuranceValueSar: string | null;
  warrantyUntil: string | null;
  notes: string | null;
  specs: Record<string, unknown> | null;
  groupName: string | null;
};

export default async function EquipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/equipment/${id}`);

  // Page guard: lacking equipment.read → /dashboard (signed-out → /login).
  await requirePermission('equipment.read');
  const effectivePid = await getEffectiveProfileId();

  const [eqRows, resR, actR] = await Promise.all([
    // Detail read masks financial columns (serial / insurance / purchase /
    // book value) behind equipment.read.financial — fetch through the safe
    // view inside a single withProfileScope txn (sets app.current_profile_id).
    // Masked cols come back NULL; the render below already guards each one.
    withProfileScope(effectivePid, (tx) =>
      tx
        .select({
          id: vEquipmentSafe.id,
          code: vEquipmentSafe.code,
          category: vEquipmentSafe.category,
          manufacturer: vEquipmentSafe.manufacturer,
          model: vEquipmentSafe.model,
          modelNameAr: vEquipmentSafe.modelNameAr,
          serialNumber: vEquipmentSafe.serialNumber,
          status: vEquipmentSafe.status,
          currentLocation: vEquipmentSafe.currentLocation,
          photoUrl: vEquipmentSafe.photoUrl,
          requiresCharging: vEquipmentSafe.requiresCharging,
          lastChargedAt: vEquipmentSafe.lastChargedAt,
          purchasePriceSar: vEquipmentSafe.purchasePriceSar,
          insuranceValueSar: vEquipmentSafe.insuranceValueSar,
          warrantyUntil: vEquipmentSafe.warrantyUntil,
          notes: vEquipmentSafe.notes,
          specs: vEquipmentSafe.specs,
          groupName: equipmentGroups.nameAr,
        })
        .from(vEquipmentSafe)
        .leftJoin(equipmentGroups, drizzleEq(equipmentGroups.id, vEquipmentSafe.groupId))
        .where(drizzleEq(vEquipmentSafe.id, id))
        .limit(1),
    ),
    db.execute(sql`
      SELECT r.id::text AS id, r.status,
             r.project_id::text AS "projectId",
             COALESCE(p.title_ar, p.title) AS "projectTitle",
             prof.display_name AS "reserverName",
             r.starts_at AS "startsAt", r.ends_at AS "endsAt"
      FROM equipment_reservations r
      LEFT JOIN projects p ON p.id = r.project_id
      LEFT JOIN profiles prof ON prof.id = r.reserved_by_id
      WHERE r.equipment_id = ${id}::uuid AND r.status IN ('reserved','checked_out')
      ORDER BY r.starts_at`),
    db.execute(sql`
      SELECT a.event_type AS "eventType", a.summary, a.created_at AS at,
             prof.display_name AS actor
      FROM equipment_activity_log a
      LEFT JOIN profiles prof ON prof.id = a.actor_id
      WHERE a.equipment_id = ${id}::uuid
      ORDER BY a.created_at DESC LIMIT 30`),
  ]);

  const row = eqRows[0];
  if (!row || !row.id) notFound();
  // The v_*_safe view declares every column nullable (pgView .existing()), but
  // code/category/model/status/location are NEVER masked — only financial cols
  // are. Coerce the always-present required columns to satisfy Equip; keep the
  // genuinely masked fields (serialNumber / purchasePriceSar / insuranceValueSar)
  // nullable so masking renders "—" / hides those rows.
  const eq: Equip = {
    id: row.id,
    code: row.code ?? '',
    category: row.category ?? '',
    manufacturer: row.manufacturer,
    model: row.model ?? '',
    modelNameAr: row.modelNameAr,
    serialNumber: row.serialNumber,
    status: row.status ?? '',
    currentLocation: row.currentLocation ?? '',
    photoUrl: row.photoUrl,
    requiresCharging: row.requiresCharging ?? false,
    lastChargedAt: row.lastChargedAt ? new Date(row.lastChargedAt).toISOString() : null,
    purchasePriceSar: row.purchasePriceSar,
    insuranceValueSar: row.insuranceValueSar,
    warrantyUntil: row.warrantyUntil,
    notes: row.notes,
    specs: row.specs as Record<string, unknown> | null,
    groupName: row.groupName,
  };
  const reservations = rows<Reservation>(resR);
  const activity = rows<{
    eventType: string;
    summary: string | null;
    at: string;
    actor: string | null;
  }>(actR);

  // Specs render — drop empty/N/A rows, surface human-friendly labels, group
  // priority fields first, and flatten the volt-os ai_meta object so it never
  // shows as "[object Object]" (Mohammed's audit hit this on BAG-001).
  const SPEC_LABELS_AR: Record<string, string> = {
    short_name: 'الاسم المختصر',
    short_name_en: 'Short name',
    model_name_official: 'الاسم الرسمي',
    product_line: 'فئة المنتج',
    key_specs: 'مواصفات أساسية',
    mount_points: 'نقاط التركيب',
    power_input: 'الإدخال',
    power_output: 'الإخراج',
    data_io: 'منافذ البيانات',
    compatibility_tags: 'التوافق',
    complementary_items: 'عناصر مكمِّلة',
    mandatory_companions: 'مرافقات إلزامية',
    recommended_accessories: 'إكسسوارات موصى بها',
    use_cases: 'حالات الاستخدام',
    weight_grams: 'الوزن (جرام)',
    dimensions_cm: 'الأبعاد (سم)',
    release_year: 'سنة الإصدار',
    confidence: 'ثقة التصنيف',
    missing_info: 'معلومات ناقصة',
    supercategory: 'الفئة الأم',
    subcategory: 'الفئة الفرعية',
    tags: 'وسوم',
    firmware_version_latest: 'أحدث firmware',
  };
  const SPEC_ORDER = [
    'short_name','short_name_en','model_name_official','product_line',
    'key_specs','weight_grams','dimensions_cm','release_year',
    'mount_points','power_input','power_output','data_io',
    'compatibility_tags','complementary_items','mandatory_companions',
    'recommended_accessories','use_cases','tags','subcategory',
    'supercategory','firmware_version_latest','confidence','missing_info',
  ];
  function isEmpty(v: unknown): boolean {
    if (v == null) return true;
    if (typeof v === 'string') return v.trim() === '' || v.trim().toUpperCase() === 'N/A';
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === 'object') return Object.keys(v as object).length === 0;
    return false;
  }
  function renderSpecValue(v: unknown): string {
    if (Array.isArray(v)) return v.filter(Boolean).join(' · ');
    if (typeof v === 'object' && v !== null) return JSON.stringify(v);
    return String(v);
  }
  const rawSpecs = (eq.specs ?? {}) as Record<string, unknown>;
  // Surface ai_meta highlights but keep the raw json as a collapsed details.
  const aiMeta = rawSpecs.ai_meta as Record<string, unknown> | undefined;
  const specEntries = Object.entries(rawSpecs)
    .filter(([k, v]) => k !== 'ai_meta' && !isEmpty(v))
    .sort(([a], [b]) => {
      const ia = SPEC_ORDER.indexOf(a);
      const ib = SPEC_ORDER.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });

  // QR label (server-rendered SVG) — scanning opens this item's page.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://antagna.me';
  const qrSvg = await QRCode.toString(`${siteUrl}/equipment/${eq.id}`, {
    type: 'svg',
    margin: 1,
    width: 150,
    color: { dark: '#000000', light: '#ffffff' },
  });

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/equipment">
      <Link
        href="/equipment"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
      >
        <ArrowLeft size={14} className="rtl:rotate-180" /> المعدات
      </Link>

      <PageHeader
        eyebrow={eq.category}
        title={eq.modelNameAr ?? eq.model}
        subtitle={`${eq.manufacturer ? eq.manufacturer + ' · ' : ''}${eq.model} · ${eq.code}`}
        action={
          <StatusPill tone={STATUS_TONE[eq.status] ?? 'neutral'}>
            {STATUS_AR[eq.status] ?? eq.status}
          </StatusPill>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left: photo + key facts */}
        <Card>
          <div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)]">
            {eq.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={eq.photoUrl} alt={eq.model} className="h-full w-full object-cover" />
            ) : (
              <Camera size={32} className="text-[var(--text-dim)]" />
            )}
          </div>
          <dl className="mt-4 space-y-2 text-[13px]">
            <Row k="الكود" v={eq.code} mono />
            <Row k="الرقم التسلسلي" v={eq.serialNumber ?? '—'} mono />
            <Row
              k="الموقع"
              v={
                <span className="inline-flex items-center gap-1">
                  <MapPin size={12} className="text-[var(--text-dim)]" />
                  {eq.currentLocation}
                </span>
              }
            />
            {eq.groupName && <Row k="المجموعة" v={eq.groupName} />}
            {eq.requiresCharging && (
              <Row
                k="آخر شحن"
                v={
                  <span className="inline-flex items-center gap-1">
                    <BatteryCharging size={12} className="text-[var(--accent)]" />
                    {eq.lastChargedAt
                      ? new Date(eq.lastChargedAt).toISOString().slice(0, 10)
                      : 'لم يُسجَّل'}
                  </span>
                }
              />
            )}
            {eq.warrantyUntil && <Row k="الضمان حتى" v={eq.warrantyUntil} mono />}
            {eq.purchasePriceSar && (
              <Row
                k="سعر الشراء"
                v={`${Number(eq.purchasePriceSar).toLocaleString('en-US')} ر.س`}
              />
            )}
            {eq.insuranceValueSar && (
              <Row
                k="قيمة التأمين"
                v={`${Number(eq.insuranceValueSar).toLocaleString('en-US')} ر.س`}
              />
            )}
          </dl>

          {/* QR label — print + stick on the gear; scanning opens this page */}
          <div className="mt-4 flex items-center gap-3 border-t border-[var(--line)] pt-4">
            <div
              className="h-[88px] w-[88px] shrink-0 rounded-md bg-white p-1.5"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <div className="min-w-0 text-[12px] text-[var(--text-muted)]">
              <p className="font-medium text-[var(--text)]">ملصق QR</p>
              <p className="mt-0.5 text-[var(--text-dim)]">
                اطبعه والصقه على المعدة — مسحه يفتح هذه الصفحة مباشرةً.
              </p>
              <span className="mt-1 inline-block font-mono text-[10px] text-[var(--text-dim)]">
                {eq.code}
              </span>
            </div>
          </div>
        </Card>

        {/* Middle+right: controls + specs */}
        <div className="space-y-4 lg:col-span-2">
          <Card padded={false}>
            <div className="flex items-start justify-between gap-3 p-6 pb-4">
              <CardHeader title="الإجراءات والحجوزات" subtitle="تسليم، استرجاع، وحالة المعدة" />
              <Link
                href={`/equipment/repairs?equipment=${eq.id}`}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--text)]"
              >
                <Wrench size={13} /> الصيانة
              </Link>
            </div>
            <div className="px-6 pb-6">
              <EquipmentControls
                equipmentId={eq.id}
                status={eq.status}
                requiresCharging={eq.requiresCharging}
                reservations={reservations}
              />
            </div>
          </Card>

          {(specEntries.length > 0 || aiMeta) && (
            <Card padded={false}>
              <div className="p-6 pb-4">
                <CardHeader title="المواصفات" subtitle="مستخرج من فحص AI" />
              </div>
              {specEntries.length > 0 && (
                <dl className="px-6 pb-2 grid grid-cols-1 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
                  {specEntries.map(([k, v]) => (
                    <Row
                      key={k}
                      k={SPEC_LABELS_AR[k] ?? k.replace(/_/g, ' ')}
                      v={renderSpecValue(v)}
                    />
                  ))}
                </dl>
              )}
              {aiMeta && (
                <details className="border-t border-[var(--line)] px-6 py-4 text-[12px]">
                  <summary className="cursor-pointer text-[var(--text-muted)] hover:text-[var(--text)]">
                    التفاصيل الكاملة (AI metadata)
                  </summary>
                  <pre className="mt-3 max-h-[280px] overflow-auto rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] p-3 text-[11px] leading-relaxed text-[var(--text-muted)]" dir="ltr">
{JSON.stringify(aiMeta, null, 2)}
                  </pre>
                </details>
              )}
            </Card>
          )}

          {eq.notes && (
            <Card>
              <CardHeader title="ملاحظات" />
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-muted)]">
                {eq.notes}
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Activity timeline */}
      <Card padded={false}>
        <div className="p-6 pb-4">
          <CardHeader title="السجل" subtitle="حركة المعدة: تسليم، استرجاع، صيانة، شحن" />
        </div>
        {activity.length === 0 ? (
          <EmptyState
            icon={<History size={20} />}
            title="لا حركة بعد"
            description="ستظهر هنا عمليات التسليم والاسترجاع والصيانة أولاً بأول."
          />
        ) : (
          <ul className="space-y-0">
            {activity.map((a, i) => (
              <li
                key={i}
                className="flex items-start gap-3 border-t border-[var(--line)] px-6 py-3 first:border-t-0"
              >
                <Package size={14} className="mt-0.5 shrink-0 text-[var(--text-dim)]" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[var(--text)]">{a.summary ?? a.eventType}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-dim)]">
                    <span className="font-mono">{a.eventType}</span>
                    {a.actor && (
                      <>
                        <span>·</span>
                        <span>{a.actor}</span>
                      </>
                    )}
                    <span>·</span>
                    <span className="font-mono">
                      {new Date(a.at).toISOString().slice(0, 16).replace('T', ' ')}
                    </span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Shell>
  );
}

function Row({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[var(--text-dim)]">{k}</dt>
      <dd className={'text-[var(--text)] ' + (mono ? 'font-mono text-[12px]' : '')}>{v}</dd>
    </div>
  );
}
