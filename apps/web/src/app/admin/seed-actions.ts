'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql, eq } from 'drizzle-orm';
import { db, profiles } from '@antagna/db';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requirePermissionAction } from '@/lib/authz';

/**
 * Insert demo data so the empty Antagna-V2 DB has something to show in the UI.
 *
 * Safe to call multiple times — every insert uses ON CONFLICT DO NOTHING on a
 * stable code, so re-runs are idempotent.
 *
 * Skipped tables: profiles (auth-driven), live equipment legacy data (Pillar 15).
 */
export async function seedDevData() {
  // Authz (audit fix): demo-data seeding is admin-only.
  await requirePermissionAction('access.manage');
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [actor] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.authUserId, user.id))
    .limit(1);
  if (actor) {
    await db.execute(sql`SELECT set_config('app.acting_as', ${actor.id}, true)`);
  }

  // ── Clients ───────────────────────────────────────────────────────────────
  await db.execute(sql`
    INSERT INTO clients (code, name_ar, name_en, client_type, industry, country, city, created_by)
    VALUES
      ('MYNM',     'مينام',           'Mynm',                  'brand', 'real estate', 'SA', 'الرياض', ${actor?.id ? sql`${actor.id}::uuid` : sql`NULL`}),
      ('HRMNY',    'هارموني',          'Harmony',               'brand', 'fashion',     'SA', 'جدة',    ${actor?.id ? sql`${actor.id}::uuid` : sql`NULL`}),
      ('ALFTM',    'الفطيم',          'Al-Futtaim',            'brand', 'retail',      'SA', 'الرياض', ${actor?.id ? sql`${actor.id}::uuid` : sql`NULL`}),
      ('WPP',      'WPP',              'WPP',                   'agency','advertising', 'SA', 'الرياض', ${actor?.id ? sql`${actor.id}::uuid` : sql`NULL`}),
      ('MTN-MOTORS','إم تي إن للسيارات','MTN Motors',           'dealer','automotive',  'SA', 'الرياض', ${actor?.id ? sql`${actor.id}::uuid` : sql`NULL`})
    ON CONFLICT (code) DO NOTHING
  `);

  // ── Contacts ──────────────────────────────────────────────────────────────
  await db.execute(sql`
    INSERT INTO contacts (client_id, full_name, job_title, is_primary, is_decision_maker)
    SELECT id, 'Ahmed Al-Saud', 'Marketing Manager', true, true FROM clients WHERE code = 'MYNM'
    ON CONFLICT DO NOTHING
  `);
  await db.execute(sql`
    INSERT INTO contacts (client_id, full_name, job_title, is_primary, is_decision_maker)
    SELECT id, 'Sara Mansour', 'Brand Lead', true, false FROM clients WHERE code = 'HRMNY'
    ON CONFLICT DO NOTHING
  `);

  // ── Equipment groups ──────────────────────────────────────────────────────
  await db.execute(sql`
    INSERT INTO equipment_groups (code, name_ar, name_en, category)
    VALUES
      ('CAM-MIRRORLESS', 'كاميرات mirrorless', 'Mirrorless cameras', 'camera'),
      ('LENS-PRIME',     'عدسات prime',         'Prime lenses',       'lens'),
      ('AUDIO-WIRELESS', 'ميكروفونات لاسلكية',  'Wireless mics',      'audio'),
      ('LIGHTING',       'إضاءة',               'Lighting',           'lighting')
    ON CONFLICT (code) DO NOTHING
  `);

  // ── Equipment items ───────────────────────────────────────────────────────
  await db.execute(sql`
    INSERT INTO equipment (code, group_id, category, manufacturer, model, serial_number, status, insurance_value_sar, requires_charging, current_location)
    SELECT v.code, eg.id, v.cat, v.mfr, v.model, v.serial, v.status::equipment_status, v.value, v.charging, v.loc
    FROM (VALUES
      ('A7S3-01', 'camera',   'Sony',      'A7S III',      'SN123A', 'available',   28000, true,  'warehouse'),
      ('A7S3-02', 'camera',   'Sony',      'A7S III',      'SN124B', 'available',   28000, true,  'warehouse'),
      ('FX3-01',  'camera',   'Sony',      'FX3',          'SN125C', 'available',   35000, true,  'warehouse'),
      ('S5-01',   'camera',   'Panasonic', 'Lumix S5',     'SN126D', 'checked_out', 18000, true,  'on shoot'),
      ('PRIME-50','lens',     'Sony',      '50mm f/1.4',   'L501',   'available',   12000, false, 'warehouse'),
      ('PRIME-85','lens',     'Sony',      '85mm f/1.4',   'L851',   'available',   14000, false, 'warehouse'),
      ('MIC-01',  'audio',    'Sennheiser','MKE 400',      'M001',   'available',    4500, false, 'warehouse'),
      ('ZOOM-H6', 'audio',    'Zoom',      'H6',           'Z601',   'available',    2500, true,  'warehouse'),
      ('APUTURE', 'lighting', 'Aputure',   '300d Mk II',   'AP001',  'available',    9500, false, 'warehouse')
    ) AS v(code, cat, mfr, model, serial, status, value, charging, loc)
    LEFT JOIN equipment_groups eg ON eg.code = (CASE v.cat
      WHEN 'camera' THEN 'CAM-MIRRORLESS'
      WHEN 'lens'   THEN 'LENS-PRIME'
      WHEN 'audio'  THEN 'AUDIO-WIRELESS'
      WHEN 'lighting' THEN 'LIGHTING'
    END)
    ON CONFLICT (code) DO NOTHING
  `);

  // ── Projects ──────────────────────────────────────────────────────────────
  await db.execute(sql`
    INSERT INTO projects (title, title_ar, client_id, project_type, stage, contracted_value_sar, delivery_due_at, shoot_starts_at, created_by)
    SELECT v.title, v.title_ar, c.id, v.ptype::project_type, v.stage::project_stage, v.value, v.due::timestamptz, v.shoot::timestamptz, ${actor?.id ? sql`${actor.id}::uuid` : sql`NULL`}
    FROM (VALUES
      ('Summer Campaign Reels',  'ريلز حملة الصيف',         'MYNM',  'content_creation', 'editing',   45000, (now() + interval '14 days')::text, (now() - interval '3 days')::text),
      ('Brand Anthem Film',      'فيلم العلامة التجارية',   'HRMNY', 'shoot',             'shooting',  120000, (now() + interval '30 days')::text, (now() + interval '2 days')::text),
      ('Q4 Photoshoot',          'تصوير الربع الرابع',      'ALFTM', 'shoot',             'planning',  85000, (now() + interval '21 days')::text, (now() + interval '10 days')::text),
      ('Showroom Walkaround',    'جولة الشوروم',            'MTN-MOTORS', 'live_coverage', 'brief',    25000, (now() + interval '7 days')::text,  (now() + interval '5 days')::text),
      ('Ramadan Campaign',       'حملة رمضان',              'MYNM',  'content_creation', 'delivered', 60000, (now() - interval '14 days')::text, (now() - interval '40 days')::text)
    ) AS v(title, title_ar, client_code, ptype, stage, value, due, shoot)
    INNER JOIN clients c ON c.code = v.client_code
    WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.title = v.title)
  `);

  // ── Leads ─────────────────────────────────────────────────────────────────
  await db.execute(sql`
    INSERT INTO leads (source, unmatched_from_name, unmatched_from_email, status, estimated_value_sar, temperature_score, ai_summary)
    VALUES
      ('email_inbound', 'Khaled M.',     'k.marketing@example.com', 'new',        15000, 60, 'يطلب reels لافتتاح فرع جديد'),
      ('referral',      'Layla Z.',      'layla@brandstudio.sa',    'qualified',  80000, 78, 'وكالة بتدور على شريك تصوير لـ 3 شهور'),
      ('cold_outreach', 'Omar A.',       'omar@startup.io',         'nurturing',  25000, 45, 'startup B2B، ميزانية ضيقة')
    ON CONFLICT DO NOTHING
  `);

  revalidatePath('/', 'layout');
}
