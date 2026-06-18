'use server';

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { requireOwner } from './auth';
import { refreshMoneyInsight } from './money';

const str = (v: FormDataEntryValue | null, max = 160): string | null => {
  const s = (v == null ? '' : String(v)).trim();
  return s ? s.slice(0, max) : null;
};
const money = (v: FormDataEntryValue | null): number | null => {
  const n = parseFloat(String(v ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};

export async function addTransaction(formData: FormData): Promise<void> {
  const me = await requireOwner();
  const amount = money(formData.get('amount'));
  if (amount == null) return;
  const kind = String(formData.get('kind')) === 'income' ? 'income' : 'expense';
  const category = str(formData.get('category'), 40);
  const label = str(formData.get('label'), 120);
  const date = str(formData.get('txn_date'), 12);
  await db.execute(sql`
    INSERT INTO me_transactions (owner_id, kind, amount, category, label, txn_date)
    VALUES (${me.profileId}::uuid, ${kind}, ${amount}, ${category}, ${label}, ${date ? sql`${date}::date` : sql`current_date`})
  `);
  revalidatePath('/me/money');
}

export async function deleteTransaction(id: string): Promise<void> {
  const me = await requireOwner();
  await db.execute(sql`DELETE FROM me_transactions WHERE id=${id}::uuid AND owner_id=${me.profileId}::uuid`);
  revalidatePath('/me/money');
}

export async function setFinance(formData: FormData): Promise<void> {
  const me = await requireOwner();
  const incomeRaw = String(formData.get('monthly_income') ?? '').trim();
  const liquidRaw = String(formData.get('liquid_balance') ?? '').trim();
  const income = incomeRaw === '' ? null : Math.max(0, parseFloat(incomeRaw.replace(/[^\d.-]/g, '')) || 0);
  const liquid = liquidRaw === '' ? null : Math.max(0, parseFloat(liquidRaw.replace(/[^\d.-]/g, '')) || 0);
  await db.execute(sql`
    INSERT INTO me_finance (owner_id, monthly_income, liquid_balance, updated_at)
    VALUES (${me.profileId}::uuid, ${income ?? 0}, ${liquid ?? 0}, now())
    ON CONFLICT (owner_id) DO UPDATE SET
      monthly_income = ${income != null ? sql`${income}` : sql`me_finance.monthly_income`},
      liquid_balance = ${liquid != null ? sql`${liquid}` : sql`me_finance.liquid_balance`},
      updated_at = now()
  `);
  revalidatePath('/me/money');
}

export async function addSubscription(formData: FormData): Promise<void> {
  const me = await requireOwner();
  const name = str(formData.get('name'), 80);
  const amount = money(formData.get('amount'));
  if (!name || amount == null) return;
  const cadence = String(formData.get('cadence')) === 'yearly' ? 'yearly' : 'monthly';
  const category = str(formData.get('category'), 40);
  await db.execute(sql`
    INSERT INTO me_subscriptions (owner_id, name, amount, cadence, category)
    VALUES (${me.profileId}::uuid, ${name}, ${amount}, ${cadence}, ${category})
  `);
  revalidatePath('/me/money');
}

export async function deleteSubscription(id: string): Promise<void> {
  const me = await requireOwner();
  await db.execute(sql`UPDATE me_subscriptions SET active=false WHERE id=${id}::uuid AND owner_id=${me.profileId}::uuid`);
  revalidatePath('/me/money');
}

export async function markSubUsed(id: string): Promise<void> {
  const me = await requireOwner();
  await db.execute(sql`UPDATE me_subscriptions SET last_used=current_date WHERE id=${id}::uuid AND owner_id=${me.profileId}::uuid`);
  revalidatePath('/me/money');
}

export async function addGoal(formData: FormData): Promise<void> {
  const me = await requireOwner();
  const title = str(formData.get('title'), 120);
  const target = money(formData.get('target_amount'));
  if (!title || target == null) return;
  const saved = money(formData.get('saved_amount')) ?? 0;
  const date = str(formData.get('target_date'), 12);
  await db.execute(sql`
    INSERT INTO me_savings_goals (owner_id, title, target_amount, saved_amount, target_date)
    VALUES (${me.profileId}::uuid, ${title}, ${target}, ${saved}, ${date ? sql`${date}::date` : sql`NULL`})
  `);
  revalidatePath('/me/money');
}

export async function contributeGoal(id: string, formData: FormData): Promise<void> {
  const me = await requireOwner();
  const amount = money(formData.get('amount'));
  if (amount == null) return;
  await db.execute(sql`
    UPDATE me_savings_goals
    SET saved_amount = saved_amount + ${amount},
        status = CASE WHEN saved_amount + ${amount} >= target_amount THEN 'done' ELSE status END
    WHERE id=${id}::uuid AND owner_id=${me.profileId}::uuid
  `);
  revalidatePath('/me/money');
}

export async function refreshMoney(): Promise<void> {
  const me = await requireOwner();
  await refreshMoneyInsight(me.profileId);
  revalidatePath('/me/money');
}
