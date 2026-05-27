import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { PageHeader, Card, CardHeader, StatusPill, EmptyState } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import {
  ArrowLeft,
  Camera,
  MapPin,
  History,
  BatteryCharging,
  Package,
} from 'lucide-react';
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

  const [eqR, resR, actR] = await Promise.all([
    db.execute(sql`
      SELECT e.id::text AS id, e.code, e.category, e.manufacturer, e.model,
             e.model_name_ar AS "modelNameAr", e.serial_number AS "serialNumber",
             e.status::text AS status, e.current_location AS "currentLocation",
             e.photo_url AS "photoUrl", e.requires_charging AS "requiresCharging",
             e.last_charged_at AS "lastChargedAt",
             e.purchase_price_sar AS "purchasePriceSar",
             e.insurance_value_sar AS "insuranceValueSar",
             e.warranty_until AS "warrantyUntil", e.notes, e.specs,
             g.name_ar AS "groupName"
      FROM equipment e
      LEFT JOIN equipment_groups g ON g.id = e.group_id
      WHERE e.id = ${id}::uuid LIMIT 1`),
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

  const eq = rows<Equip>(eqR)[0];
  if (!eq) notFound();
  const reservations = rows<Reservation>(resR);
  const activity = rows<{
    eventType: string;
    summary: string | null;
    at: string;
    actor: string | null;
  }>(actR);

  const specEntries = eq.specs ? Object.entries(eq.specs) : [];

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
        </Card>

        {/* Middle+right: controls + specs */}
        <div className="space-y-4 lg:col-span-2">
          <Card padded={false}>
            <div className="p-6 pb-4">
              <CardHeader title="الإجراءات والحجوزات" subtitle="تسليم، استرجاع، وحالة المعدة" />
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

          {specEntries.length > 0 && (
            <Card padded={false}>
              <div className="p-6 pb-4">
                <CardHeader title="المواصفات" />
              </div>
              <dl className="px-6 pb-6 grid grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
                {specEntries.map(([k, v]) => (
                  <Row key={k} k={k} v={String(v)} />
                ))}
              </dl>
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
