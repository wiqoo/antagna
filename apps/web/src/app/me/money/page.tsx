import { requireOwner } from '../auth';
import { computeMoney, listSubscriptions, listGoals, latestMoneyInsight } from '../money';
import { addTransaction, deleteTransaction, setFinance, addSubscription, deleteSubscription, markSubUsed, addGoal, contributeGoal, refreshMoney } from '../actions5';
import { todayRiyadh } from '../data';

export const dynamic = 'force-dynamic';

const n = (v: number) => v.toLocaleString('ar-EG-u-nu-latn');

export default async function MoneyPage() {
  const me = await requireOwner();
  const [snap, subs, goals, insight] = await Promise.all([
    computeMoney(me.profileId), listSubscriptions(me.profileId), listGoals(me.profileId), latestMoneyInsight(me.profileId),
  ]);
  const today = todayRiyadh();
  const cur = snap.currency === 'SAR' ? 'ر.س' : snap.currency;
  const runwayTone = snap.runwayMonths == null ? 'var(--text-dim)' : snap.runwayMonths < 3 ? 'var(--danger)' : snap.runwayMonths < 6 ? 'var(--amber, #FBBF24)' : 'var(--success, #34D399)';

  return (
    <div>
      <h1 className="mb-4 text-[20px] font-bold">💰 الفلوس</h1>

      {/* Runway hero */}
      <div className="mb-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <p className="text-[11px] uppercase tracking-wide text-[var(--text-dim)]">المدرج المالي · Runway</p>
        {snap.runwayMonths != null ? (
          <p className="mt-1 text-[30px] font-extrabold" style={{ color: runwayTone }}>{n(snap.runwayMonths)} <span className="text-[15px] font-normal text-[var(--text-muted)]">شهر</span></p>
        ) : (
          <p className="mt-2 text-[13px] text-[var(--text-dim)]">حدّد سيولتك وسجّل مصاريفك علشان أحسبه</p>
        )}
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-[var(--text-muted)]">
          <span>السيولة: <b className="text-[var(--text)]">{n(snap.liquid)}</b> {cur}</span>
          <span>الحرق الشهري: <b className="text-[var(--text)]">{n(snap.burn90)}</b> {cur}</span>
        </div>
      </div>

      {/* Cashflow this month */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        {[
          { label: 'دخل الشهر', val: snap.incomeMtd, tone: '#34D399' },
          { label: 'مصروف الشهر', val: snap.expenseMtd, tone: '#F87171' },
          { label: 'الصافي', val: snap.cashflowMtd, tone: snap.cashflowMtd >= 0 ? '#34D399' : '#F87171' },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-center">
            <p className="text-[10.5px] text-[var(--text-dim)]">{c.label}</p>
            <p className="mt-1 text-[15px] font-bold tabular-nums" style={{ color: c.tone }}>{snap.cashflowMtd >= 0 && c.label === 'الصافي' ? '+' : ''}{n(c.val)}</p>
          </div>
        ))}
      </div>

      {/* AI insight */}
      <div className="mb-4 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent-tint)] p-3.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-[var(--accent)]">🧠 قراءة ذكية</span>
          <form action={refreshMoney}><button className="text-[10.5px] text-[var(--text-dim)]">↻ حدّث</button></form>
        </div>
        <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed">{insight ?? 'اضغط حدّث علشان أحلّل وضعك المالي.'}</p>
      </div>

      {/* Quick add */}
      <details className="mb-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3.5">
        <summary className="cursor-pointer text-[13px] font-semibold text-[var(--accent)]">+ سجّل حركة</summary>
        <form action={addTransaction} className="mt-3 flex flex-col gap-2.5">
          <div className="flex gap-2">
            <select name="kind" className="rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-2 py-2.5 text-[13px] outline-none focus:border-[var(--accent)]">
              <option value="expense">مصروف</option><option value="income">دخل</option>
            </select>
            <input name="amount" inputMode="decimal" required placeholder="المبلغ" className="flex-1 rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--accent)]" />
          </div>
          <div className="flex gap-2">
            <input name="category" placeholder="البند (أكل، مواصلات…)" className="flex-1 rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2.5 text-[13px] outline-none focus:border-[var(--accent)]" />
            <input type="date" name="txn_date" defaultValue={today} className="rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-2 py-2.5 text-[13px] outline-none focus:border-[var(--accent)]" />
          </div>
          <input name="label" placeholder="وصف (اختياري)" className="rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2.5 text-[13px] outline-none focus:border-[var(--accent)]" />
          <button className="rounded-xl bg-[var(--accent)] py-2.5 text-[14px] font-semibold text-[#1a1a1a]">حفظ</button>
        </form>
      </details>

      {/* Categories */}
      {snap.categories.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 text-[12px] font-semibold text-[var(--text-muted)]">أعلى البنود (٩٠ يوم)</h2>
          <div className="flex flex-col gap-2">
            {snap.categories.map((c) => (
              <div key={c.category}>
                <div className="mb-1 flex justify-between text-[12px]"><span>{c.category}</span><span className="tabular-nums text-[var(--text-muted)]">{n(c.total)} {cur}</span></div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-hover)]"><div className="h-full rounded-full bg-[var(--accent)]" style={{ width: c.pct + '%' }} /></div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Subscriptions */}
      <section className="mb-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[12px] font-semibold text-[var(--text-muted)]">الاشتراكات {snap.subsMonthly > 0 && <span className="text-[var(--text-dim)]">· {n(snap.subsMonthly)}/شهر</span>}</h2>
        </div>
        {snap.subsUnused > 0 && (
          <p className="mb-2 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-tint)] px-3 py-2 text-[12px] text-[var(--danger)]">⚠️ {n(snap.subsUnused)} اشتراك مش مستخدم من ٤٥+ يوم — راجعه</p>
        )}
        <div className="flex flex-col gap-1.5">
          {subs.map((s) => (
            <div key={s.id} className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-[13px]">{s.name} {s.unused && <span className="text-[10px] text-[var(--danger)]">· خامل</span>}</p>
                <p className="text-[10.5px] text-[var(--text-dim)]">{n(Math.round(s.amount))} {cur} / {s.cadence === 'yearly' ? 'سنة' : 'شهر'}{s.category ? ' · ' + s.category : ''}</p>
              </div>
              <form action={markSubUsed.bind(null, s.id)}><button className="rounded-lg border border-[var(--line)] px-2 py-1 text-[10px] text-[var(--text-dim)]">استخدمته</button></form>
              <form action={deleteSubscription.bind(null, s.id)}><button className="px-1 text-[12px] text-[var(--text-dim)]">✕</button></form>
            </div>
          ))}
        </div>
        <details className="mt-2">
          <summary className="cursor-pointer text-[11.5px] text-[var(--accent)]">+ اشتراك</summary>
          <form action={addSubscription} className="mt-2 flex flex-col gap-2">
            <div className="flex gap-2">
              <input name="name" required placeholder="الاسم" className="flex-1 rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]" />
              <input name="amount" inputMode="decimal" required placeholder="السعر" className="w-24 rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]" />
            </div>
            <div className="flex gap-2">
              <select name="cadence" className="rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-2 py-2 text-[13px] outline-none focus:border-[var(--accent)]"><option value="monthly">شهري</option><option value="yearly">سنوي</option></select>
              <input name="category" placeholder="التصنيف" className="flex-1 rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]" />
            </div>
            <button className="rounded-xl bg-[var(--accent)] py-2 text-[13px] font-semibold text-[#1a1a1a]">إضافة</button>
          </form>
        </details>
      </section>

      {/* Savings goals */}
      <section className="mb-5">
        <h2 className="mb-2 text-[12px] font-semibold text-[var(--text-muted)]">أهداف الادخار</h2>
        <div className="flex flex-col gap-2.5">
          {goals.map((g) => (
            <div key={g.id} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
              <div className="mb-1.5 flex justify-between text-[13px]"><span>{g.title}</span><span className="tabular-nums text-[var(--text-muted)]">{n(g.saved)} / {n(g.target)} {cur}</span></div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-hover)]"><div className="h-full rounded-full bg-[var(--accent)]" style={{ width: g.pct + '%' }} /></div>
              <form action={contributeGoal.bind(null, g.id)} className="mt-2 flex gap-2">
                <input name="amount" inputMode="decimal" placeholder="أضف للهدف" className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2.5 py-1.5 text-[12px] outline-none focus:border-[var(--accent)]" />
                <button className="rounded-lg border border-[var(--accent)]/40 px-3 text-[12px] text-[var(--accent)]">+</button>
              </form>
            </div>
          ))}
        </div>
        <details className="mt-2">
          <summary className="cursor-pointer text-[11.5px] text-[var(--accent)]">+ هدف ادخار</summary>
          <form action={addGoal} className="mt-2 flex flex-col gap-2">
            <input name="title" required placeholder="عايز توفّر لإيه؟" className="rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]" />
            <div className="flex gap-2">
              <input name="target_amount" inputMode="decimal" required placeholder="المبلغ المطلوب" className="flex-1 rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]" />
              <input name="saved_amount" inputMode="decimal" placeholder="المتوفّر" className="w-24 rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]" />
            </div>
            <button className="rounded-xl bg-[var(--accent)] py-2 text-[13px] font-semibold text-[#1a1a1a]">إضافة</button>
          </form>
        </details>
      </section>

      {/* Recent transactions */}
      {snap.recent.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 text-[12px] font-semibold text-[var(--text-muted)]">آخر الحركات</h2>
          <div className="flex flex-col">
            {snap.recent.map((t) => (
              <div key={t.id} className="flex items-center gap-2 border-b border-[var(--line)] py-2 last:border-0">
                <span className="text-[14px]">{t.kind === 'income' ? '💵' : '💸'}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px]">{t.label || t.category || (t.kind === 'income' ? 'دخل' : 'مصروف')}</p>
                  <p className="text-[10px] text-[var(--text-dim)]">{t.category ?? ''} · {t.date}</p>
                </div>
                <span className="shrink-0 text-[13px] font-medium tabular-nums" style={{ color: t.kind === 'income' ? '#34D399' : 'var(--text)' }}>{t.kind === 'income' ? '+' : '−'}{n(t.amount)}</span>
                <form action={deleteTransaction.bind(null, t.id)}><button className="px-1 text-[11px] text-[var(--text-dim)]">✕</button></form>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Settings */}
      <details className="mb-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3.5">
        <summary className="cursor-pointer text-[12px] font-semibold text-[var(--text-muted)]">⚙️ إعدادات الفلوس</summary>
        <form action={setFinance} className="mt-3 flex flex-col gap-2.5">
          <label className="text-[11px] text-[var(--text-dim)]">الدخل الشهري المتوقّع
            <input name="monthly_income" inputMode="decimal" defaultValue={snap.monthlyIncome || ''} className="mt-1 w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--accent)]" />
          </label>
          <label className="text-[11px] text-[var(--text-dim)]">السيولة الحالية (كاش + بنك)
            <input name="liquid_balance" inputMode="decimal" defaultValue={snap.liquid || ''} className="mt-1 w-full rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--accent)]" />
          </label>
          <button className="rounded-xl bg-[var(--accent)] py-2.5 text-[14px] font-semibold text-[#1a1a1a]">حفظ</button>
        </form>
      </details>
    </div>
  );
}
