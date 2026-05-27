'use server';

import { revalidatePath } from 'next/cache';
import { sql, eq } from 'drizzle-orm';
import { db, profiles } from '@antagna/db';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { writeActivity } from '@/lib/activity';

const VALID_TYPES = [
  'check_in_office',
  'check_out_office',
  'check_in_shoot',
  'check_out_shoot',
  'remote_start',
  'remote_end',
];

/** Great-circle distance in metres between two lat/lng points. */
function haversineMeters(la1: number, lo1: number, la2: number, lo2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLa = toRad(la2 - la1);
  const dLo = toRad(lo2 - lo1);
  const a =
    Math.sin(dLa / 2) ** 2 +
    Math.cos(toRad(la1)) * Math.cos(toRad(la2)) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Personal-device attendance check-in: selfie + GPS + geofence → attendance_records. */
export async function checkIn(
  formData: FormData,
): Promise<{ ok: boolean; error?: string; verification?: string; fence?: string }> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'انتهت الجلسة' };
  const [actor] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.authUserId, user.id))
    .limit(1);
  if (!actor) return { ok: false, error: 'لا يوجد ملف لهذا المستخدم' };

  const type = formData.get('type')?.toString() ?? '';
  if (!VALID_TYPES.includes(type)) return { ok: false, error: 'نوع غير صالح' };

  const selfie = formData.get('selfie');
  if (!(selfie instanceof File) || selfie.size === 0) {
    return { ok: false, error: 'الصورة الذاتية مطلوبة' };
  }

  const numOrNull = (k: string) => {
    const v = formData.get(k)?.toString();
    return v && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : null;
  };
  const lat = numOrNull('lat');
  const lng = numOrNull('lng');
  const accuracy = numOrNull('accuracy');
  const clientTs = formData.get('clientTs')?.toString() || null;

  // 1) Upload the selfie to the private bucket (service-role).
  const admin = getSupabaseAdmin();
  const ext = selfie.type.includes('png') ? 'png' : selfie.type.includes('webp') ? 'webp' : 'jpg';
  const path = `${actor.id}/${Date.now()}.${ext}`;
  const buf = Buffer.from(await selfie.arrayBuffer());
  const { error: upErr } = await admin.storage
    .from('attendance-selfies')
    .upload(path, buf, { contentType: selfie.type || 'image/jpeg', upsert: false });
  if (upErr) return { ok: false, error: 'تعذّر رفع الصورة: ' + upErr.message };

  // 2) Geofence match (haversine against active fences).
  let geoFenceId: string | null = null;
  let fenceName: string | null = null;
  let verification = 'verified';
  if (lat != null && lng != null) {
    const fences = (await db.execute(sql`
      SELECT id::text AS id, name_ar AS name, center_lat::float8 AS lat,
             center_lng::float8 AS lng, radius_meters AS radius
      FROM geo_fences WHERE active
    `)) as unknown as { id: string; name: string; lat: number; lng: number; radius: number }[];
    let best: { id: string; name: string; dist: number } | null = null;
    for (const f of fences) {
      const d = haversineMeters(lat, lng, f.lat, f.lng);
      if (d <= f.radius && (!best || d < best.dist)) best = { id: f.id, name: f.name, dist: d };
    }
    if (best) {
      geoFenceId = best.id;
      fenceName = best.name;
    } else if (fences.length > 0) {
      verification = 'flagged_location_mismatch'; // outside every configured fence
    }
  } else {
    verification = 'flagged_location_mismatch'; // no GPS provided
  }

  // 3) Record it.
  await db.execute(sql`SELECT set_config('app.acting_as', ${actor.id}, true)`);
  await db.execute(sql`
    INSERT INTO attendance_records
      (profile_id, type, selfie_url, gps_lat, gps_lng, gps_accuracy_meters,
       geo_fence_id, resolved_location_label, client_timestamp, server_timestamp,
       verification, device_info)
    VALUES (
      ${actor.id}::uuid, ${type}::attendance_type, ${path},
      ${lat}, ${lng}, ${accuracy},
      ${geoFenceId ? sql`${geoFenceId}::uuid` : sql`NULL`},
      ${fenceName},
      ${clientTs ? sql`${clientTs}::timestamptz` : sql`now()`}, now(),
      ${verification}::attendance_verification,
      ${JSON.stringify({ ua: 'pwa' })}::jsonb
    )
  `);

  await writeActivity({
    actorId: actor.id,
    entityType: 'attendance',
    entityId: actor.id,
    action: type,
    summaryAr: `تسجيل حضور: ${type}${fenceName ? ` @ ${fenceName}` : ''}`,
    summaryEn: `Attendance: ${type}`,
    metadata: { verification },
  });

  revalidatePath('/attendance');
  return { ok: true, verification, fence: fenceName ?? undefined };
}

/** Admin: add a configurable geofence (so coordinates live in data, not code). */
export async function addGeoFence(formData: FormData): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const nameAr = formData.get('nameAr')?.toString().trim();
  const lat = Number(formData.get('lat'));
  const lng = Number(formData.get('lng'));
  const radius = Number(formData.get('radius') ?? 100);
  const kind = formData.get('kind')?.toString() || 'office';
  if (!nameAr || Number.isNaN(lat) || Number.isNaN(lng)) return;

  await db.execute(sql`
    INSERT INTO geo_fences (name_ar, center_lat, center_lng, radius_meters, kind)
    VALUES (${nameAr}, ${lat}, ${lng}, ${Number.isFinite(radius) ? Math.trunc(radius) : 100}, ${kind})
  `);
  revalidatePath('/attendance');
}
