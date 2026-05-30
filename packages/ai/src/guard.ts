import { db } from '@antagna/db';
import { sql } from 'drizzle-orm';

export type AiBudgetScope = 'company-monthly' | 'user-monthly' | 'user-daily';

/**
 * Thrown by `assertAiBudget` when a HARD spend cap is exceeded. Callers should
 * let it propagate (the action fails cleanly) or catch it to show a message.
 */
export class AiBudgetError extends Error {
  readonly scope: AiBudgetScope;
  readonly spentUsd: number;
  readonly limitUsd: number;
  constructor(scope: AiBudgetScope, message: string, spentUsd: number, limitUsd: number) {
    super(message);
    this.name = 'AiBudgetError';
    this.scope = scope;
    this.spentUsd = spentUsd;
    this.limitUsd = limitUsd;
  }
}

async function sumSpend(cond: ReturnType<typeof sql>): Promise<number> {
  const rows = await db.execute<{ total: string }>(
    sql`SELECT COALESCE(SUM(cost_usd), 0)::text AS total FROM ai_usage WHERE ${cond}`,
  );
  const total = (rows as unknown as { total: string }[])[0]?.total;
  return total ? Number(total) : 0;
}

/**
 * Enforce AI spend caps BEFORE a paid model call — the real teeth behind the
 * admin "hard cap يوقف الطلبات عند التجاوز" toggle, which until now was read for
 * display only. Throws `AiBudgetError` when a HARD cap is hit:
 *   - the company monthly budget (`system_settings.ai.monthly_budget_usd`), or
 *   - a user's `ai_user_limits` daily/monthly limit WHEN `hard_cap = true`.
 * Soft caps (hard_cap=false) never block — D-010 "open with guards".
 *
 * Call at the top of every paid AI server action / worker task, passing the
 * acting profile id. Cheap: 1–3 indexed aggregate reads on ai_usage.
 */
export async function assertAiBudget(
  opts: { userId?: string | null; feature?: string } = {},
): Promise<void> {
  // 1) Company-wide monthly budget — a hard stop for everyone once set.
  const budgetRows = await db.execute<{ value: unknown }>(
    sql`SELECT value FROM system_settings WHERE key = 'ai.monthly_budget_usd' LIMIT 1`,
  );
  const budgetVal = (budgetRows as unknown as { value: unknown }[])[0]?.value;
  const companyBudget = typeof budgetVal === 'number' ? budgetVal : Number(budgetVal) || 0;
  if (companyBudget > 0) {
    const companyMtd = await sumSpend(sql`created_at >= date_trunc('month', now())`);
    if (companyMtd >= companyBudget) {
      throw new AiBudgetError(
        'company-monthly',
        `تم بلوغ ميزانية الشركة الشهرية للذكاء الاصطناعي ($${companyMtd.toFixed(2)} / $${companyBudget}). تم إيقاف الطلبات.`,
        companyMtd,
        companyBudget,
      );
    }
  }

  // 2) Per-user hard caps.
  if (opts.userId) {
    const limRows = await db.execute<{
      daily_limit_usd: string;
      monthly_limit_usd: string;
      hard_cap: boolean;
    }>(
      sql`SELECT daily_limit_usd, monthly_limit_usd, hard_cap
          FROM ai_user_limits WHERE user_id = ${opts.userId}::uuid LIMIT 1`,
    );
    const lim = (limRows as unknown as {
      daily_limit_usd: string;
      monthly_limit_usd: string;
      hard_cap: boolean;
    }[])[0];
    if (lim && lim.hard_cap) {
      const monthlyLimit = Number(lim.monthly_limit_usd);
      const userMtd = await sumSpend(
        sql`user_id = ${opts.userId}::uuid AND created_at >= date_trunc('month', now())`,
      );
      if (monthlyLimit > 0 && userMtd >= monthlyLimit) {
        throw new AiBudgetError(
          'user-monthly',
          `تجاوزت حدّك الشهري للذكاء الاصطناعي ($${userMtd.toFixed(2)} / $${monthlyLimit}).`,
          userMtd,
          monthlyLimit,
        );
      }
      const dailyLimit = Number(lim.daily_limit_usd);
      const userToday = await sumSpend(
        sql`user_id = ${opts.userId}::uuid AND created_at >= date_trunc('day', now())`,
      );
      if (dailyLimit > 0 && userToday >= dailyLimit) {
        throw new AiBudgetError(
          'user-daily',
          `تجاوزت حدّك اليومي للذكاء الاصطناعي ($${userToday.toFixed(2)} / $${dailyLimit}).`,
          userToday,
          dailyLimit,
        );
      }
    }
  }
}

/** Non-throwing variant for surfaces that prefer to degrade gracefully. */
export async function checkAiBudget(
  opts: { userId?: string | null } = {},
): Promise<{ ok: boolean; reason?: string }> {
  try {
    await assertAiBudget(opts);
    return { ok: true };
  } catch (e) {
    if (e instanceof AiBudgetError) return { ok: false, reason: e.message };
    throw e;
  }
}
