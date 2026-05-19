'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql, eq } from 'drizzle-orm';
import { db, profiles } from '@antagna/db';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function createEquipment(formData: FormData) {
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

  const code = formData.get('code')?.toString().trim().toUpperCase();
  const category = formData.get('category')?.toString().trim();
  const manufacturer = formData.get('manufacturer')?.toString().trim() || null;
  const model = formData.get('model')?.toString().trim();
  const groupId = formData.get('groupId')?.toString() || null;
  const serialNumber = formData.get('serialNumber')?.toString().trim() || null;
  const currentLocation = formData.get('currentLocation')?.toString().trim() || 'warehouse';
  const purchasePriceSar = formData.get('purchasePriceSar')?.toString() || null;
  const insuranceValueSar = formData.get('insuranceValueSar')?.toString() || null;
  const purchaseDate = formData.get('purchaseDate')?.toString() || null;
  const requiresCharging = formData.get('requiresCharging') === 'on';

  if (!code || !category || !model) throw new Error('code+category+model required');

  const res = await db.execute<{ id: string }>(sql`
    INSERT INTO equipment (
      code, category, manufacturer, model, group_id, serial_number,
      current_location, purchase_price_sar, insurance_value_sar,
      purchase_date, requires_charging
    )
    VALUES (
      ${code}, ${category}, ${manufacturer}, ${model},
      ${groupId ? sql`${groupId}::uuid` : sql`NULL`},
      ${serialNumber}, ${currentLocation},
      ${purchasePriceSar ? sql`${purchasePriceSar}::numeric` : sql`NULL`},
      ${insuranceValueSar ? sql`${insuranceValueSar}::numeric` : sql`NULL`},
      ${purchaseDate},
      ${requiresCharging}
    )
    RETURNING id
  `);

  const arr = res as unknown as Array<{ id: string }>;
  if (!arr[0]?.id) throw new Error('insert failed');

  revalidatePath('/equipment');
  redirect('/equipment');
}
