'use server';

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { db, withActor } from '@antagna/db';
import { requirePermissionAction } from '@/lib/authz';
import { writeActivity } from '@/lib/activity';

/**
 * Locations + geo_fences CRUD — admin only (access.manage). These two tables
 * were emptied; this lets Mohammed re-add the office + shoot locations and bind
 * geofences (the pending geofence-coords manual item).
 *
 * locations columns: code (UNIQUE), name_ar, name_en, kind is NOT a column — the
 * "kind" lives on geo_fences. locations carry city/district/address/coords/
 * geo_fence_id + a few shoot-logistics flags.
 * geo_fences columns: name_ar, name_en, center_lat, center_lng, radius_meters,
 * kind ('office'|'studio'|'recurring_client_site'), client_id, active.
 *
 * All writes run inside withActor so the audit trigger sees the principal on the
 * same pinned (transaction-pooler) connection.
 */

function txt(v: FormDataEntryValue | null): string | null {
  const s = v?.toString().trim();
  return s ? s : null;
}

function bool(v: FormDataEntryValue | null): boolean {
  return v === 'on' || v === 'true' || v === '1';
}

function num(v: FormDataEntryValue | null): number | null {
  const s = v?.toString().trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Normalise a "lat,lng" free-text field — keep only if it parses to 2 numbers. */
function coordPair(v: FormDataEntryValue | null): string | null {
  const s = txt(v);
  if (!s) return null;
  const parts = s.split(',').map((p) => p.trim());
  if (parts.length !== 2) return s; // store as-is; UI hints the format
  const [lat, lng] = parts.map(Number);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return `${lat},${lng}`;
  return s;
}

// ── locations ──────────────────────────────────────────────────────────────

export async function createLocation(formData: FormData) {
  const actorId = await requirePermissionAction('access.manage');

  const code = txt(formData.get('code'))?.toUpperCase();
  const nameAr = txt(formData.get('nameAr'));
  const nameEn = txt(formData.get('nameEn'));
  const city = txt(formData.get('city'));
  const district = txt(formData.get('district'));
  const addressLines = txt(formData.get('addressLines'));
  const coordinates = coordPair(formData.get('coordinates'));
  const geoFenceId = txt(formData.get('geoFenceId'));
  const bestTimeToShoot = txt(formData.get('bestTimeToShoot'));
  const parkingInfo = txt(formData.get('parkingInfo'));
  const permitRequired = bool(formData.get('permitRequired'));
  const hasPower = bool(formData.get('hasPower'));

  if (!code) throw new Error('code required');
  if (!nameAr) throw new Error('nameAr required');

  await withActor(actorId, (tx) =>
    tx.execute(sql`
      INSERT INTO locations
        (code, name_ar, name_en, city, district, address_lines, coordinates,
         geo_fence_id, best_time_to_shoot, parking_info, permit_required, has_power)
      VALUES (
        ${code}, ${nameAr}, ${nameEn}, ${city}, ${district}, ${addressLines},
        ${coordinates}, ${geoFenceId}::uuid, ${bestTimeToShoot}, ${parkingInfo},
        ${permitRequired}, ${hasPower}
      )
    `),
  );

  await writeActivity({
    actorId,
    entityType: 'location',
    action: 'location.create',
    summaryAr: `أضاف موقعاً ${nameAr}`,
    summaryEn: `Added location ${nameEn ?? code}`,
  });

  revalidatePath('/admin/locations');
}

export async function updateLocation(formData: FormData) {
  const actorId = await requirePermissionAction('access.manage');

  const id = txt(formData.get('id'));
  const nameAr = txt(formData.get('nameAr'));
  const nameEn = txt(formData.get('nameEn'));
  const city = txt(formData.get('city'));
  const district = txt(formData.get('district'));
  const addressLines = txt(formData.get('addressLines'));
  const coordinates = coordPair(formData.get('coordinates'));
  const geoFenceId = txt(formData.get('geoFenceId'));
  const bestTimeToShoot = txt(formData.get('bestTimeToShoot'));
  const parkingInfo = txt(formData.get('parkingInfo'));
  const permitRequired = bool(formData.get('permitRequired'));
  const hasPower = bool(formData.get('hasPower'));

  if (!id) throw new Error('id required');
  if (!nameAr) throw new Error('nameAr required');

  await withActor(actorId, (tx) =>
    tx.execute(sql`
      UPDATE locations SET
        name_ar = ${nameAr},
        name_en = ${nameEn},
        city = ${city},
        district = ${district},
        address_lines = ${addressLines},
        coordinates = ${coordinates},
        geo_fence_id = ${geoFenceId}::uuid,
        best_time_to_shoot = ${bestTimeToShoot},
        parking_info = ${parkingInfo},
        permit_required = ${permitRequired},
        has_power = ${hasPower}
      WHERE id = ${id}::uuid
    `),
  );

  await writeActivity({
    actorId,
    entityType: 'location',
    entityId: id,
    action: 'location.update',
    summaryAr: `حدّث موقع ${nameAr}`,
    summaryEn: `Updated location ${nameEn ?? nameAr}`,
  });

  revalidatePath('/admin/locations');
}

export async function deleteLocation(formData: FormData) {
  const actorId = await requirePermissionAction('access.manage');
  const id = formData.get('id')?.toString();
  if (!id) throw new Error('id required');

  await withActor(actorId, (tx) =>
    tx.execute(sql`DELETE FROM locations WHERE id = ${id}::uuid`),
  );

  await writeActivity({
    actorId,
    entityType: 'location',
    entityId: id,
    action: 'location.delete',
    summaryAr: 'حذف موقعاً',
    summaryEn: 'Deleted a location',
  });

  revalidatePath('/admin/locations');
}

// ── geo_fences ───────────────────────────────────────────────────────────────

const FENCE_KINDS = ['office', 'studio', 'recurring_client_site'] as const;

function fenceKind(v: FormDataEntryValue | null): string {
  const s = txt(v);
  return s && (FENCE_KINDS as readonly string[]).includes(s) ? s : 'office';
}

export async function createGeoFence(formData: FormData) {
  const actorId = await requirePermissionAction('access.manage');

  const nameAr = txt(formData.get('nameAr'));
  const nameEn = txt(formData.get('nameEn'));
  const centerLat = num(formData.get('centerLat'));
  const centerLng = num(formData.get('centerLng'));
  const radiusMeters = num(formData.get('radiusMeters')) ?? 100;
  const kind = fenceKind(formData.get('kind'));
  const clientId = txt(formData.get('clientId'));

  if (!nameAr) throw new Error('nameAr required');
  if (centerLat == null || centerLng == null)
    throw new Error('center coordinates required');

  await withActor(actorId, (tx) =>
    tx.execute(sql`
      INSERT INTO geo_fences
        (name_ar, name_en, center_lat, center_lng, radius_meters, kind, client_id)
      VALUES (
        ${nameAr}, ${nameEn}, ${centerLat}, ${centerLng},
        ${Math.round(radiusMeters)}, ${kind}, ${clientId}::uuid
      )
    `),
  );

  await writeActivity({
    actorId,
    entityType: 'geo_fence',
    action: 'geo_fence.create',
    summaryAr: `أضاف سياجاً جغرافياً ${nameAr}`,
    summaryEn: `Added geofence ${nameEn ?? nameAr}`,
  });

  revalidatePath('/admin/locations');
}

export async function updateGeoFence(formData: FormData) {
  const actorId = await requirePermissionAction('access.manage');

  const id = txt(formData.get('id'));
  const nameAr = txt(formData.get('nameAr'));
  const nameEn = txt(formData.get('nameEn'));
  const centerLat = num(formData.get('centerLat'));
  const centerLng = num(formData.get('centerLng'));
  const radiusMeters = num(formData.get('radiusMeters')) ?? 100;
  const kind = fenceKind(formData.get('kind'));
  const clientId = txt(formData.get('clientId'));
  const active = bool(formData.get('active'));

  if (!id) throw new Error('id required');
  if (!nameAr) throw new Error('nameAr required');
  if (centerLat == null || centerLng == null)
    throw new Error('center coordinates required');

  await withActor(actorId, (tx) =>
    tx.execute(sql`
      UPDATE geo_fences SET
        name_ar = ${nameAr},
        name_en = ${nameEn},
        center_lat = ${centerLat},
        center_lng = ${centerLng},
        radius_meters = ${Math.round(radiusMeters)},
        kind = ${kind},
        client_id = ${clientId}::uuid,
        active = ${active}
      WHERE id = ${id}::uuid
    `),
  );

  await writeActivity({
    actorId,
    entityType: 'geo_fence',
    entityId: id,
    action: 'geo_fence.update',
    summaryAr: `حدّث سياج ${nameAr}`,
    summaryEn: `Updated geofence ${nameEn ?? nameAr}`,
  });

  revalidatePath('/admin/locations');
}

export async function deleteGeoFence(formData: FormData) {
  const actorId = await requirePermissionAction('access.manage');
  const id = formData.get('id')?.toString();
  if (!id) throw new Error('id required');

  // Detach any locations referencing this fence first (no cascade on the FK).
  await withActor(actorId, async (tx) => {
    await tx.execute(
      sql`UPDATE locations SET geo_fence_id = NULL WHERE geo_fence_id = ${id}::uuid`,
    );
    await tx.execute(sql`DELETE FROM geo_fences WHERE id = ${id}::uuid`);
  });

  await writeActivity({
    actorId,
    entityType: 'geo_fence',
    entityId: id,
    action: 'geo_fence.delete',
    summaryAr: 'حذف سياجاً جغرافياً',
    summaryEn: 'Deleted a geofence',
  });

  revalidatePath('/admin/locations');
}
