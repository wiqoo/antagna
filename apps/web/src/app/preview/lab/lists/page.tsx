import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Briefcase, MapPin } from 'lucide-react';

const SAMPLE = [
  { id: '1', code: 'PRJ-0007', title: 'تصوير جولة الشوروم — Volt MG', client: 'إم تي إن للسيارات', stage: 'shoot', stageAr: 'تصوير', due: 'بعد ٢ أيام', pct: 45, value: '85,000' },
  { id: '2', code: 'PRJ-0006', title: 'حملة BMW Summer 2026', client: 'BMW السعودية', stage: 'editing', stageAr: 'مونتاج', due: 'متأخر يوم', pct: 78, value: '125,000' },
  { id: '3', code: 'PRJ-0005', title: 'فيديو تعريفي — Rolls Royce', client: 'رولز رويس الرياض', stage: 'review', stageAr: 'مراجعة', due: 'بكرة', pct: 92, value: '210,000' },
  { id: '4', code: 'PRJ-0004', title: 'لقطات سوشيال — لكزس LX', client: 'لكزس', stage: 'brief', stageAr: 'بريف', due: 'بعد ١٤ يوم', pct: 12, value: '45,000' },
];

export default function ListsLab() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto max-w-[1200px] px-6 py-10 md:px-8 md:py-14">
        <Link
          href="/preview/lab"
          className="mb-6 inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
        >
          <ArrowLeft size={13} className="rtl:rotate-180" />
          العودة لـ Design Lab
        </Link>
        <header className="mb-10 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
            القسم ٢ — شكل القوائم
          </p>
          <h1 className="text-[32px] font-bold tracking-[-0.02em]" style={{ fontFamily: 'var(--font-display)' }}>
            ٤ خيارات لـ /projects و الجداول
          </h1>
          <p className="max-w-2xl text-[13px] leading-relaxed text-[var(--text-muted)]">
            نفس البيانات معروضة بـ ٤ طرق. كل واحدة عندها قوة معينة. الـ research من Linear/Notion
            بيقول معظم ops UIs بتدمج بين <strong>list view</strong> الأساسي و <strong>card view</strong> اختياري.
          </p>
        </header>

        {/* Option 1 — current */}
        <Variant
          tag="الخيار ١ — Table (الحالي)"
          subtitle="جدول رسمي، ١٠+ أعمدة، كثيف. ممتاز للـ scanning لكن قاسي بصرياً."
          pros={['Scanning سريع', 'مقارنة أرقام', 'مناسب للأعداد الكبيرة']}
          cons={['كثيف بصرياً', 'بطيء على الموبايل']}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--bg-elevated)]/40 text-[10px] uppercase tracking-[0.15em] text-[var(--text-dim)]">
                  <th className="px-4 py-2.5 text-start">المشروع</th>
                  <th className="px-4 py-2.5 text-start">العميل</th>
                  <th className="px-4 py-2.5 text-start">المرحلة</th>
                  <th className="px-4 py-2.5 text-start">التسليم</th>
                  <th className="px-4 py-2.5 text-start">القيمة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {SAMPLE.map((p) => (
                  <tr key={p.id} className="hover:bg-[var(--surface-hover)]">
                    <td className="px-4 py-3">
                      <p className="text-[var(--text)]">{p.title}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-[var(--text-dim)] opacity-70">{p.code}</p>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">{p.client}</td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-[var(--surface-hover)] px-2 py-0.5 text-[10px]">{p.stageAr}</span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">{p.due}</td>
                    <td className="px-4 py-3 font-mono text-[var(--text)]">{p.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Variant>

        {/* Option 2 — compact rows */}
        <Variant
          tag="الخيار ٢ — Compact rows (موصى به)"
          recommended
          subtitle="صفوف منفصلة، avatar/icon لكل صف، معلومة مكثفة في خانة واحدة. Linear/Height pattern."
          pros={['أنضف بصرياً', 'يشتغل على الموبايل', 'لكل صف "هوية"']}
          cons={['عدد أعمدة أقل']}
        >
          <ul className="divide-y divide-[var(--line)] rounded-lg border border-[var(--line)]">
            {SAMPLE.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-hover)]">
                <div
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[10px] font-bold"
                  style={{
                    background: p.stage === 'review' ? 'rgba(34,197,94,0.18)' : p.stage === 'editing' ? 'rgba(168,85,247,0.18)' : 'rgba(255,107,26,0.18)',
                    color: p.stage === 'review' ? '#22C55E' : p.stage === 'editing' ? '#A855F7' : '#FF8442',
                  }}
                >
                  <Briefcase size={14} strokeWidth={1.8} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-[var(--text)]">{p.title}</p>
                  <p className="truncate text-[11px] text-[var(--text-dim)]">
                    {p.client} · {p.stageAr} · {p.due}
                  </p>
                </div>
                <div className="text-end">
                  <p className="font-mono text-[13px] text-[var(--text)]">{p.value}</p>
                  <p className="text-[10px] text-[var(--text-dim)]">{p.pct}% منجز</p>
                </div>
              </li>
            ))}
          </ul>
        </Variant>

        {/* Option 3 — cards */}
        <Variant
          tag="الخيار ٣ — Card grid"
          subtitle="كرت لكل مشروع، ٣ أو ٤ في الصف، بصرياً أغنى لكن أقل scanning. مناسب لـ '/projects/featured'."
          pros={['كل مشروع له "حضور"', 'مناسب للبصري', 'سهل على الموبايل']}
          cons={['بياخد مساحة', 'مش مناسب لـ 100+ صف']}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {SAMPLE.slice(0, 4).map((p) => (
              <div key={p.id} className="rounded-xl border border-[var(--line)] bg-[var(--bg-elevated)]/40 p-4 hover:border-[var(--accent)]/30">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-[var(--text)]">{p.title}</p>
                    <p className="truncate text-[11px] text-[var(--text-dim)]">{p.client}</p>
                  </div>
                  <span
                    className="rounded bg-[var(--surface-hover)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]"
                    title={p.code}
                  >
                    {p.stageAr}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex-1">
                    <div className="h-1 overflow-hidden rounded-full bg-[var(--surface-hover)]">
                      <div className="h-full bg-[var(--accent)]" style={{ width: `${p.pct}%` }} />
                    </div>
                  </div>
                  <span className="font-mono text-[10px] text-[var(--text-muted)]">{p.pct}%</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px]">
                  <span className="text-[var(--text-dim)]">{p.due}</span>
                  <span className="font-mono text-[var(--text)]">{p.value} ر.س</span>
                </div>
              </div>
            ))}
          </div>
        </Variant>

        {/* Option 4 — dense bullet */}
        <Variant
          tag="الخيار ٤ — Dense bullet (Cron-style)"
          subtitle="سطر واحد لكل مشروع، نقطة لون للحالة، كل المعلومات inline. Cron Calendar pattern."
          pros={['أقصى كثافة', 'scanning سريع جداً', 'مساحة عمودية أقل']}
          cons={['يتطلب اعتياد', 'ضعيف على الموبايل']}
        >
          <ul className="space-y-0.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2">
            {SAMPLE.map((p) => (
              <li key={p.id} className="grid grid-cols-[8px,1fr,auto,auto] items-center gap-3 rounded px-3 py-2 hover:bg-[var(--surface-hover)] text-[12px]">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: p.stage === 'review' ? '#22C55E' : p.stage === 'editing' ? '#A855F7' : '#FF8442' }}
                />
                <span className="truncate text-[var(--text)]">{p.title}</span>
                <span className="text-[var(--text-dim)]">{p.due}</span>
                <span className="font-mono text-[var(--text-muted)]">{p.value}</span>
              </li>
            ))}
          </ul>
        </Variant>

        <Footer />
      </div>
    </div>
  );
}

function Variant({
  tag,
  subtitle,
  pros,
  cons,
  recommended,
  children,
}: {
  tag: string;
  subtitle: string;
  pros: string[];
  cons: string[];
  recommended?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <header className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
              {tag}
            </p>
            {recommended && (
              <span className="inline-flex items-center gap-1 rounded-md bg-[var(--accent-tint)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
                <CheckCircle2 size={10} /> موصى به
              </span>
            )}
          </div>
          <p className="mt-1 text-[12px] text-[var(--text-muted)]">{subtitle}</p>
        </div>
      </header>
      {children}
      <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
        <div className="rounded-md border border-green-500/20 bg-green-500/5 p-2">
          <p className="mb-1 font-semibold text-green-400">✓ نقاط القوة</p>
          <ul className="space-y-0.5 text-[var(--text-muted)]">
            {pros.map((p) => <li key={p}>· {p}</li>)}
          </ul>
        </div>
        <div className="rounded-md border border-yellow-500/20 bg-yellow-500/5 p-2">
          <p className="mb-1 font-semibold text-yellow-400">⚠ المساوئ</p>
          <ul className="space-y-0.5 text-[var(--text-muted)]">
            {cons.map((c) => <li key={c}>· {c}</li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <div className="mt-12 rounded-xl border border-[var(--accent)]/25 bg-[var(--accent-tint)] p-5">
      <p className="text-[12px] text-[var(--text)]">
        قولي رقم الخيار اللي عاجبك (مثال: "خيار ٢ كـ default، خيار ٣ كـ toggle view") وأطبّق.
      </p>
    </div>
  );
}
