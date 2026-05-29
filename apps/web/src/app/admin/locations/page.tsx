import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { PageHeader, Card } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { ArrowLeft } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/authz';
import {
  LocationsManager,
  type LocationRow,
  type FenceRow,
  type ClientOption,
} from './LocationsManager';

export const dynamic = 'force-dynamic';

const rows = <T,>(r: unknown): T[] => r as unknown as T[];

export default async function LocationsAdminPage() {
  await requirePermission('access.manage');

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [fenceRows, locationRows, clientRows] = await Promise.all([
    db.execute(sql`
      SELECT
        g.id::text                AS id,
        g.name_ar                 AS "nameAr",
        g.name_en                 AS "nameEn",
        g.center_lat::text        AS "centerLat",
        g.center_lng::text        AS "centerLng",
        g.radius_meters           AS "radiusMeters",
        g.kind,
        g.client_id::text         AS "clientId",
        c.name_ar                 AS "clientName",
        g.active,
        (SELECT count(*)::int FROM locations l WHERE l.geo_fence_id = g.id) AS "locationCount"
      FROM geo_fences g
      LEFT JOIN clients c ON c.id = g.client_id
      ORDER BY g.kind, g.name_ar
    `),
    db.execute(sql`
      SELECT
        l.id::text          AS id,
        l.code,
        l.name_ar           AS "nameAr",
        l.name_en           AS "nameEn",
        l.city,
        l.district,
        l.address_lines     AS "addressLines",
        l.coordinates,
        l.geo_fence_id::text AS "geoFenceId",
        g.name_ar           AS "geoFenceName",
        l.best_time_to_shoot AS "bestTimeToShoot",
        l.parking_info      AS "parkingInfo",
        l.permit_required   AS "permitRequired",
        l.has_power         AS "hasPower"
      FROM locations l
      LEFT JOIN geo_fences g ON g.id = l.geo_fence_id
      WHERE l.archived_at IS NULL
      ORDER BY l.code
    `),
    db.execute(sql`
      SELECT id::text AS id, name_ar AS name
      FROM clients
      WHERE archived_at IS NULL
      ORDER BY name_ar
    `),
  ]);

  const fences = rows<FenceRow>(fenceRows);
  const locations = rows<LocationRow>(locationRows);
  const clients = rows<ClientOption>(clientRows);

  return (
    <Shell user={{ email: user?.email ?? '' }} activePath="/admin">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
      >
        <ArrowLeft size={14} className="rtl:rotate-180" /> الإدارة
      </Link>

      <PageHeader
        eyebrow="Admin · Ops"
        title="المواقع والسياجات"
        subtitle="عرّف المكتب والاستوديو ومواقع التصوير، وارسم السياجات الجغرافية للحضور والتحقّق الموقعي."
      />

      <Card>
        <LocationsManager locations={locations} fences={fences} clients={clients} />
      </Card>
    </Shell>
  );
}
