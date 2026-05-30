import { redirect } from 'next/navigation';
import { sql, eq } from 'drizzle-orm';
import { db, profiles } from '@antagna/db';
import { PageHeader, Card, CardHeader, StatusPill, EmptyState } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { Clock, MapPin, Plus } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { canAny } from '@/lib/authz';
import { getTranslations } from 'next-intl/server';
import { CheckInPanel } from './checkin-panel';
import { addGeoFence } from './actions';

export const dynamic = 'force-dynamic';

const rows = <T,>(r: unknown): T[] => r as unknown as T[];
// Migrating off legacy profiles.role (L9): the team-attendance + geofence admin
// sections are gated on `access.manage`, OR-ed with the legacy admin roles so
// existing admins/HR aren't locked out during the migration.
const ADMIN_ROLES = ['system_admin', 'general_manager', 'hr'];
const ADMIN_PERMISSIONS = ['access.manage'];

const TYPE_AR: Record<string, string> = {
  check_in_office: 'حضور · مكتب',
  check_out_office: 'انصراف · مكتب',
  check_in_shoot: 'حضور · تصوير',
  check_out_shoot: 'انصراف · تصوير',
  remote_start: 'بدء عن بُعد',
  remote_end: 'انتهاء عن بُعد',
  leave_start: 'بدء إجازة',
  leave_end: 'انتهاء إجازة',
};
const VERIF: Record<string, { ar: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  verified: { ar: 'موثّق', tone: 'success' },
  flagged_location_mismatch: { ar: 'خارج النطاق', tone: 'warning' },
  flagged_pin_failed: { ar: 'فشل الرمز', tone: 'danger' },
  flagged_replay_suspected: { ar: 'اشتباه تكرار', tone: 'danger' },
  flagged_clock_skew: { ar: 'انحراف وقت', tone: 'warning' },
  manually_overridden: { ar: 'تعديل يدوي', tone: 'neutral' },
};

type Rec = {
  type: string;
  verification: string;
  fence: string | null;
  at: string;
  who?: string;
};

export default async function AttendancePage() {
  const supabase = await getSupabaseServerClient();
  const t = await getTranslations('pages.attendance');
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/attendance');

  const [me] = await db
    .select({ id: profiles.id, role: profiles.role })
    .from(profiles)
    .where(eq(profiles.authUserId, user.id))
    .limit(1);
  // Pass on EITHER the new `access.manage` permission OR the legacy admin role.
  const isAdmin =
    ADMIN_ROLES.includes(me?.role ?? '') || (await canAny(ADMIN_PERMISSIONS));

  const [mineR, fencesR, teamR] = await Promise.all([
    db.execute(sql`
      SELECT type::text AS type, verification::text AS verification,
             resolved_location_label AS fence, server_timestamp AS at
      FROM attendance_records WHERE profile_id = ${me?.id ?? null}::uuid
      ORDER BY server_timestamp DESC LIMIT 12`),
    db.execute(sql`
      SELECT id::text AS id, name_ar AS name, center_lat::float8 AS lat,
             center_lng::float8 AS lng, radius_meters AS radius, kind
      FROM geo_fences WHERE active ORDER BY name_ar`),
    isAdmin
      ? db.execute(sql`
          SELECT ar.type::text AS type, ar.verification::text AS verification,
                 ar.resolved_location_label AS fence, ar.server_timestamp AS at,
                 p.display_name AS who
          FROM attendance_records ar
          LEFT JOIN profiles p ON p.id = ar.profile_id
          WHERE ar.server_timestamp >= date_trunc('day', now())
          ORDER BY ar.server_timestamp DESC LIMIT 50`)
      : Promise.resolve([]),
  ]);

  const mine = rows<Rec>(mineR);
  const fences = rows<{
    id: string;
    name: string;
    lat: number;
    lng: number;
    radius: number;
    kind: string;
  }>(fencesR);
  const team = rows<Rec>(teamR);

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/attendance">
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('title')}
        subtitle={t('subtitle')}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="تسجيل جديد" subtitle="صورة ذاتية + موقع" />
          <div className="mt-3">
            <CheckInPanel />
          </div>
        </Card>

        <Card padded={false}>
          <div className="p-6 pb-4">
            <CardHeader title="سجلّي" subtitle="آخر تسجيلاتك" />
          </div>
          {mine.length === 0 ? (
            <EmptyState icon={<Clock size={20} />} title="لا تسجيلات بعد" description="سجّل أول حضور من اللوحة المجاورة." />
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {mine.map((r, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-6 py-3">
                  <div>
                    <p className="text-[13px] text-[var(--text)]">{TYPE_AR[r.type] ?? r.type}</p>
                    <p className="font-mono text-[11px] text-[var(--text-dim)]">
                      {new Date(r.at).toISOString().slice(0, 16).replace('T', ' ')}
                      {r.fence ? ` · ${r.fence}` : ''}
                    </p>
                  </div>
                  <StatusPill tone={VERIF[r.verification]?.tone ?? 'neutral'} withDot={false}>
                    {VERIF[r.verification]?.ar ?? r.verification}
                  </StatusPill>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {isAdmin && (
        <>
          <Card padded={false}>
            <div className="p-6 pb-4">
              <CardHeader title="حضور الفريق اليوم" subtitle={`${team.length} تسجيل`} />
            </div>
            {team.length === 0 ? (
              <EmptyState icon={<Clock size={20} />} title="لا تسجيلات اليوم" description="" />
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {team.map((r, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-6 py-3">
                    <div>
                      <p className="text-[13px] text-[var(--text)]">{r.who ?? '—'}</p>
                      <p className="text-[11px] text-[var(--text-dim)]">
                        {TYPE_AR[r.type] ?? r.type} ·{' '}
                        <span className="font-mono">
                          {new Date(r.at).toISOString().slice(11, 16)}
                        </span>
                        {r.fence ? ` · ${r.fence}` : ''}
                      </p>
                    </div>
                    <StatusPill tone={VERIF[r.verification]?.tone ?? 'neutral'} withDot={false}>
                      {VERIF[r.verification]?.ar ?? r.verification}
                    </StatusPill>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="النطاقات الجغرافية (geofences)"
              subtitle="حدّد مواقع المكتب والاستوديو — التسجيل داخلها يُوثَّق تلقائياً"
            />
            <div className="mt-3 space-y-2">
              {fences.length === 0 ? (
                <p className="text-[12px] text-[var(--text-dim)]">
                  لا نطاقات بعد — أضف أول نطاق (مثلاً موقع المكتب) بإحداثياته.
                </p>
              ) : (
                fences.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-2 text-[12px]"
                  >
                    <span className="inline-flex items-center gap-1.5 text-[var(--text)]">
                      <MapPin size={12} className="text-[var(--accent)]" /> {f.name}
                      <span className="text-[var(--text-dim)]">· {f.kind}</span>
                    </span>
                    <span className="font-mono text-[11px] text-[var(--text-dim)]" dir="ltr">
                      {f.lat.toFixed(5)}, {f.lng.toFixed(5)} · {f.radius}m
                    </span>
                  </div>
                ))
              )}
            </div>

            <form
              action={addGeoFence}
              className="mt-4 grid grid-cols-1 gap-2 border-t border-[var(--line)] pt-4 sm:grid-cols-[1fr_1fr_1fr_90px_110px_auto]"
            >
              <input name="nameAr" required placeholder="الاسم (مثل: المكتب)" className="gf-in" />
              <input name="lat" required type="number" step="any" placeholder="lat" dir="ltr" className="gf-in" />
              <input name="lng" required type="number" step="any" placeholder="lng" dir="ltr" className="gf-in" />
              <input name="radius" type="number" defaultValue={100} placeholder="م" dir="ltr" className="gf-in" />
              <select name="kind" defaultValue="office" className="gf-in">
                <option value="office">مكتب</option>
                <option value="studio">استوديو</option>
                <option value="recurring_client_site">موقع عميل</option>
              </select>
              <button
                type="submit"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-[var(--accent)] px-3 text-[12px] font-semibold text-black hover:opacity-90"
              >
                <Plus size={14} /> أضف
              </button>
            </form>
          </Card>
        </>
      )}

      <style>{`
        .gf-in { height:36px; border-radius:8px; border:1px solid var(--line); background:var(--bg-elevated); color:var(--text); font-size:13px; padding:0 10px; }
        .gf-in:focus { outline:none; border-color:var(--accent); }
      `}</style>
    </Shell>
  );
}
