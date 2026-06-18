import { requireOwner } from '../auth';
import { ensureAreas } from '../areas';
import { computePatterns, getProfile } from '../brain';
import { computeWheel, listInsights } from '../insights-engine';
import { refreshInsightsAction, learnNow } from '../actions6';
import { teach, dismissInsight } from '../actions3';
import { Rater } from './Rater';

export const dynamic = 'force-dynamic';

const SEV_TONE: Record<string, string> = { warn: 'var(--danger)', good: '#34D399', info: 'var(--accent)' };

export default async function InsightsPage() {
  const me = await requireOwner();
  await ensureAreas(me.profileId);
  const [patterns, profile, wheel, insights] = await Promise.all([
    computePatterns(me.profileId), getProfile(me.profileId), computeWheel(me.profileId), listInsights(me.profileId),
  ]);
  const traitEntries = Object.entries(profile.traits ?? {}).filter(([, v]) => typeof v === 'string' && v);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold">رؤى</h1>
          <p className="text-[11px] text-[var(--text-dim)]">أنماطك · بتتحدّث مع استخدامك</p>
        </div>
        <form action={refreshInsightsAction}><button className="rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-[11px] text-[var(--text-muted)]">↻ حدّث</button></form>
      </div>

      {/* AI + rule insights */}
      {insights.length > 0 && (
        <section className="mb-5 flex flex-col gap-2">
          {insights.map((ins) => (
            <div key={ins.id} className="rounded-xl border bg-[var(--surface)] p-3.5" style={{ borderColor: (SEV_TONE[ins.severity] ?? 'var(--line)') + '55' }}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13.5px] font-semibold" style={{ color: SEV_TONE[ins.severity] }}>{ins.title}</p>
                <form action={dismissInsight.bind(null, ins.id)}><button className="shrink-0 text-[12px] text-[var(--text-dim)]">✕</button></form>
              </div>
              {ins.body && <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-muted)]">{ins.body}</p>}
            </div>
          ))}
        </section>
      )}

      {/* Behavioral patterns (exact, from his data) */}
      <section className="mb-5">
        <h2 className="mb-2 text-[12px] font-semibold text-[var(--text-muted)]">📈 أنماطك (من سلوكك الفعلي)</h2>
        <div className="grid grid-cols-2 gap-2">
          {patterns.productiveWindow && <Stat icon="🌅" label="نافذة تركيزك" value={patterns.productiveWindow} />}
          {patterns.busiestDay && <Stat icon="🔥" label="أكثر يوم بتنجز" value={patterns.busiestDay} />}
          <Stat icon="✅" label="إنجاز الأسبوع" value={`${patterns.doneThisWeek} مهمة`} />
          {patterns.monthlyBurn != null && <Stat icon="💸" label="متوسط الحرق/شهر" value={`${patterns.monthlyBurn} ر.س`} />}
          {patterns.habitBest && <Stat icon="🎯" label="أقوى عادة" value={`${patterns.habitBest.title} · ${patterns.habitBest.streak}ي`} />}
        </div>
        {!patterns.productiveWindow && patterns.doneThisWeek === 0 && (
          <p className="mt-2 text-[12px] text-[var(--text-dim)]">كل ما تستخدم النظام أكتر، الأنماط هتظهر هنا.</p>
        )}
      </section>

      {/* Wheel of life */}
      <section className="mb-5">
        <h2 className="mb-1 text-[12px] font-semibold text-[var(--text-muted)]">🛞 عجلة الحياة</h2>
        <p className="mb-2 text-[11px] text-[var(--text-dim)]">قيّم كل مجال بصراحة — ده اللي يكشف الاختلال.</p>
        <div className="flex flex-col gap-2">
          {wheel.map((w) => (
            <Rater key={w.areaId} areaId={w.areaId} name={w.name} icon={w.icon} color={w.color} self={w.self} activity={w.activity} />
          ))}
        </div>
      </section>

      {/* What I've learned about you */}
      <section className="mb-5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold">🧠 اللي اتعلمته عنك</h2>
          <form action={learnNow}><button className="text-[11px] text-[var(--accent)]">↻ تعلّم دلوقتي</button></form>
        </div>
        {profile.summary ? (
          <>
            <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">{profile.summary}</p>
            {traitEntries.length > 0 && (
              <div className="mt-3 flex flex-col gap-1.5">
                {traitEntries.map(([k, v]) => (
                  <div key={k} className="text-[12px]"><span className="text-[var(--text-dim)]">{TRAIT_LABEL[k] ?? k}: </span><span>{String(v)}</span></div>
                ))}
              </div>
            )}
            {profile.learnedAt && <p className="mt-3 text-[10px] text-[var(--text-dim)]">آخر تحديث للبروفايل: {new Date(profile.learnedAt).toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'short' })}</p>}
          </>
        ) : (
          <p className="text-[12.5px] leading-relaxed text-[var(--text-dim)]">لسه بتعرّف عليك. استخدم المساعد وسجّل شغلك وفلوسك، وبعد كده اضغط "تعلّم دلوقتي" علشان أبني صورة عنك.</p>
        )}
      </section>

      {/* Teach the system */}
      <section className="mb-4">
        <h2 className="mb-2 text-[12px] font-semibold text-[var(--text-muted)]">📝 علّم مساعدك</h2>
        <p className="mb-2 text-[11px] text-[var(--text-dim)]">أي تفضيل أو تصحيح — هيحترمه في كل اقتراحاته بعد كده.</p>
        <form action={teach} className="flex gap-2">
          <input type="hidden" name="signal" value="note" />
          <input type="hidden" name="scope" value="general" />
          <input name="note" required placeholder="مثلاً: متحطّش لي اجتماعات قبل ١٠ الصبح" className="flex-1 rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2.5 text-[13px] outline-none focus:border-[var(--accent)]" />
          <button className="rounded-xl bg-[var(--accent)] px-4 text-[13px] font-semibold text-[#1a1a1a]">علّم</button>
        </form>
      </section>
    </div>
  );
}

const TRAIT_LABEL: Record<string, string> = {
  energy_windows: 'نوافذ طاقته', working_style: 'أسلوب شغله', people: 'الناس المهمين',
  spending: 'الصرف', priorities: 'أولوياته', preferences: 'تفضيلاته', vocabulary: 'مصطلحاته',
};

function Stat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
      <p className="text-[10.5px] text-[var(--text-dim)]">{icon} {label}</p>
      <p className="mt-0.5 text-[13.5px] font-semibold">{value}</p>
    </div>
  );
}
