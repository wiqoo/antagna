import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Star, GripVertical, Eye, Layers, UserCircle } from 'lucide-react';

export default function CustomizeLab() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto max-w-[1100px] px-6 py-10 md:px-8 md:py-14">
        <Link
          href="/preview/lab"
          className="mb-6 inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
        >
          <ArrowLeft size={13} className="rtl:rotate-180" />
          العودة
        </Link>
        <header className="mb-10 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
            القسم ٨ — تخصيص أذكى
          </p>
          <h1 className="text-[32px] font-bold tracking-[-0.02em]" style={{ fontFamily: 'var(--font-display)' }}>
            من checkbox بسيط لـ Linear-style views
          </h1>
          <p className="max-w-2xl text-[13px] leading-relaxed text-[var(--text-muted)]">
            الحالي: ✓ Show / ✗ Hide. ده ابتدائي. الـ research بيقول الأفضل = saved views + per-role
            defaults + اختيار حجم لكل كرت + ترتيب بالسحب.
          </p>
        </header>

        <Feature
          tag="١ — Per-Role Defaults (الأهم)"
          recommended
          icon={UserCircle}
          desc="كل دور له default layout مختلف. المدير شايف cashflow + capacity، الـ Editor شايف مهامه + موافقات. ما يحتاجش يخصّص — جاهز."
        >
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <div className="rounded-md border border-[var(--line)] bg-[var(--bg-elevated)]/40 p-2">
              <p className="font-semibold text-[var(--accent)]">المدير</p>
              <p className="text-[var(--text-dim)]">cashflow · capacity · pipeline</p>
            </div>
            <div className="rounded-md border border-[var(--line)] bg-[var(--bg-elevated)]/40 p-2">
              <p className="font-semibold text-[var(--accent)]">PM</p>
              <p className="text-[var(--text-dim)]">مشاريعي · فريقي · معدات</p>
            </div>
            <div className="rounded-md border border-[var(--line)] bg-[var(--bg-elevated)]/40 p-2">
              <p className="font-semibold text-[var(--accent)]">Editor</p>
              <p className="text-[var(--text-dim)]">مهامي · موافقات معلقة</p>
            </div>
          </div>
        </Feature>

        <Feature
          tag="٢ — Saved Views"
          recommended
          icon={Star}
          desc="المستخدم يفلتر/يرتب الكروت، يسمّيها (Morning view, Weekly review)، تظهر في الـ sidebar. Linear pattern."
        >
          <ul className="space-y-1 text-[11px]">
            <li className="flex items-center gap-2"><Star size={10} className="text-[var(--accent)]" /><span>صباحي السريع</span><span className="ms-auto text-[var(--text-dim)]">٤ كروت</span></li>
            <li className="flex items-center gap-2"><Star size={10} className="text-[var(--accent)]" /><span>مراجعة الأسبوع</span><span className="ms-auto text-[var(--text-dim)]">٨ كروت</span></li>
            <li className="flex items-center gap-2"><Star size={10} className="text-[var(--text-dim)]" /><span>اجتماع الإثنين</span><span className="ms-auto text-[var(--text-dim)]">٦ كروت</span></li>
          </ul>
        </Feature>

        <Feature
          tag="٣ — حجم كل كرت"
          icon={Layers}
          desc="كل كرت ٣ أحجام: صغير (٣ عمود)، متوسط (٤)، كبير (٦ - نص الصف)، عريض (١٢ - الصف كامل)."
        >
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-3 h-12 rounded-md bg-[var(--surface)] flex items-center justify-center text-[10px] text-[var(--text-dim)]">٣</div>
            <div className="col-span-4 h-12 rounded-md bg-[var(--surface)] flex items-center justify-center text-[10px] text-[var(--text-dim)]">٤</div>
            <div className="col-span-6 h-12 rounded-md bg-[var(--surface)] flex items-center justify-center text-[10px] text-[var(--text-dim)]">٦</div>
            <div className="col-span-12 h-12 rounded-md bg-[var(--surface)] flex items-center justify-center text-[10px] text-[var(--text-dim)]">١٢ - عريض كامل</div>
          </div>
        </Feature>

        <Feature
          tag="٤ — ترتيب بالسحب"
          icon={GripVertical}
          desc="اسحب الكرت من رمز الستة نقاط، حطّه فين ما تحب. Linear/Notion. لكن: نخليه ثانوي مش أساسي."
        >
          <div className="space-y-1.5">
            {['كرت ١', 'كرت ٢', 'كرت ٣'].map((c) => (
              <div key={c} className="flex items-center gap-2 rounded-md bg-[var(--surface)] p-2 text-[11px]">
                <GripVertical size={12} className="cursor-grab text-[var(--text-dim)]" />
                <span>{c}</span>
                <Eye size={10} className="ms-auto text-[var(--text-muted)]" />
              </div>
            ))}
          </div>
        </Feature>

        {/* Anti-pattern */}
        <section className="mb-10 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-yellow-400 mb-2">
            تحذير من الـ research
          </p>
          <p className="text-[12px] leading-relaxed text-[var(--text-muted)]">
            <strong>تجنّب Grafana-style grid editors.</strong> اللي بيخلوك تحرك كل بكسل وتغيّر كل
            حاجة. ٩٠٪ من المستخدمين ما يلمسوهاش، وبتعمل support load. الـ saved views + role
            defaults أحسن للـ ٩٠٪.
          </p>
        </section>

        <div className="mt-10 rounded-xl border border-[var(--accent)]/25 bg-[var(--accent-tint)] p-5">
          <p className="text-[12px] text-[var(--text)]">
            قولي أرقام الميزات اللي عايزها. الموصى به: ١ + ٢ في sprint أول، ٣ لاحقاً، ٤ كـ
            polish.
          </p>
        </div>
      </div>
    </div>
  );
}

function Feature({
  tag,
  desc,
  recommended,
  icon: Icon,
  children,
}: {
  tag: string;
  desc: string;
  recommended?: boolean;
  icon: typeof Star;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
      <header className="mb-3 flex items-start gap-3">
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
          style={{ background: 'var(--accent-tint)', color: 'var(--accent)' }}
        >
          <Icon size={16} strokeWidth={1.7} />
        </div>
        <div className="flex-1">
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
          <p className="mt-1 text-[12px] text-[var(--text-muted)]">{desc}</p>
        </div>
      </header>
      {children}
    </section>
  );
}
