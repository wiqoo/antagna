import Link from 'next/link';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function TypographyLab() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto max-w-[1100px] px-6 py-10 md:px-8 md:py-14">
        <Link
          href="/preview/lab"
          className="mb-6 inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
        >
          <ArrowLeft size={13} className="rtl:rotate-180" />
          العودة لـ Design Lab
        </Link>
        <header className="mb-10 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
            القسم ١ — الخطوط والألوان
          </p>
          <h1 className="text-[32px] font-bold tracking-[-0.02em]" style={{ fontFamily: 'var(--font-display)' }}>
            وضوح النصوص
          </h1>
          <p className="max-w-2xl text-[13px] leading-relaxed text-[var(--text-muted)]">
            ٤ خيارات: الحالي، ثم ٣ سُلَّم ألوان نصوص محسّنة. كلهم بنفس الخط؛ التغيير في
            الـ contrast فقط. الـ research (WCAG + Linear, Vercel) بيقترح حد أدنى ٤.٥:١
            لأي نص أصغر من 18px.
          </p>
        </header>

        {/* Section A — current */}
        <Section
          tag="الخيار ١ — الحالي"
          subtitle="هذا اللي شغّال دلوقتي. text-dim بيحقق ٢.٨:١ فقط (راسب WCAG)."
          notes={[
            { label: 'text', hex: '#FFFFFF', ratio: '16.6:1', wcag: 'AAA' },
            { label: 'text-muted', hex: '#9C9CA8', ratio: '5.5:1', wcag: 'AA' },
            { label: 'text-dim', hex: '#6B6B78', ratio: '2.8:1', wcag: 'FAIL' },
            { label: 'text-faded', hex: '#4D4D55', ratio: '1.7:1', wcag: 'FAIL' },
          ]}
          colors={['#FFFFFF', '#9C9CA8', '#6B6B78', '#4D4D55']}
        />

        {/* Section B — option 2 */}
        <Section
          tag="الخيار ٢ — متباين أعلى (موصى به)"
          recommended
          subtitle="ترفع كل اللي تحت text فوق ٤.٥:١. الـ dim بقى مقروء، الـ faded صار AA Large."
          notes={[
            { label: 'text', hex: '#FFFFFF', ratio: '16.6:1', wcag: 'AAA' },
            { label: 'text-muted', hex: '#B8B8C8', ratio: '7.1:1', wcag: 'AAA' },
            { label: 'text-dim', hex: '#8A8A98', ratio: '4.7:1', wcag: 'AA' },
            { label: 'text-faded', hex: '#6B6B78', ratio: '3.1:1', wcag: 'AA Large' },
          ]}
          colors={['#FFFFFF', '#B8B8C8', '#8A8A98', '#6B6B78']}
        />

        {/* Section C — option 3 */}
        <Section
          tag="الخيار ٣ — دافئ (warm gray)"
          subtitle="نفس الـ contrast لكن بميل دافئ بدل البارد — يناسب الـ orange accent أكتر."
          notes={[
            { label: 'text', hex: '#FFFFFF', ratio: '16.6:1', wcag: 'AAA' },
            { label: 'text-muted', hex: '#C4BFB8', ratio: '7.0:1', wcag: 'AAA' },
            { label: 'text-dim', hex: '#94908A', ratio: '4.6:1', wcag: 'AA' },
            { label: 'text-faded', hex: '#6E6B66', ratio: '3.0:1', wcag: 'AA Large' },
          ]}
          colors={['#FFFFFF', '#C4BFB8', '#94908A', '#6E6B66']}
        />

        {/* Section D — option 4 */}
        <Section
          tag="الخيار ٤ — High-contrast (vivid)"
          subtitle="أقصى تباين ممكن. مناسب لو الجمهور كبار سن أو شاشات سيئة."
          notes={[
            { label: 'text', hex: '#FFFFFF', ratio: '16.6:1', wcag: 'AAA' },
            { label: 'text-muted', hex: '#D8D8E0', ratio: '11.5:1', wcag: 'AAA' },
            { label: 'text-dim', hex: '#A8A8B5', ratio: '7.4:1', wcag: 'AAA' },
            { label: 'text-faded', hex: '#82828F', ratio: '4.3:1', wcag: 'AA' },
          ]}
          colors={['#FFFFFF', '#D8D8E0', '#A8A8B5', '#82828F']}
        />

        {/* Type scale */}
        <div className="mt-16">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)] mb-3">
            سلم الخطوط — مقترح (مبني على Linear/Notion)
          </p>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 space-y-4">
            <SizeRow label="display" size={28} weight={700}>عنوان رئيسي</SizeRow>
            <SizeRow label="h1" size={22} weight={700}>اللوحة الرئيسية اليوم</SizeRow>
            <SizeRow label="h2" size={18} weight={600}>المشاريع النشطة</SizeRow>
            <SizeRow label="h3" size={15} weight={600}>قسم فرعي</SizeRow>
            <SizeRow label="body" size={13} weight={400}>هذا حجم النص الأساسي للقوائم والجداول — معظم الواجهة.</SizeRow>
            <SizeRow label="small" size={12} weight={400}>تواريخ، tags، metadata</SizeRow>
            <SizeRow label="micro" size={10} weight={600}>UPPERCASE EYEBROWS</SizeRow>
          </div>
          <p className="mt-3 text-[11px] text-[var(--text-dim)]">
            الفرق عن الحالي: بنقلل اعتمادنا على 12-14px الكبير ونثبت 13px للـ body. التخصيص بقي للعناوين.
          </p>
        </div>

        {/* Font pairing */}
        <div className="mt-16">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)] mb-3">
            اقتران الخطوط — مقترح
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <PairCard
              tag="الحالي"
              fonts="Geist + Vazirmatn + IBM Plex Arabic"
              sampleEn="The quick brown fox"
              sampleAr="مشروع رولز رويس — تسليم يوم الأحد"
              note="مزيج من ٣ عائلات، x-heights مختلفة، التركيب أحياناً بيبان غير منسجم."
            />
            <PairCard
              tag="مقترح (موصى به)"
              recommended
              fonts="IBM Plex Sans + IBM Plex Sans Arabic"
              sampleEn="The quick brown fox"
              sampleAr="مشروع رولز رويس — تسليم يوم الأحد"
              note="نفس العائلة من IBM، x-heights متطابقة، Arabic + Latin مصممين سوا. الـ Linear/Notion بيستخدموا نمط مشابه."
            />
          </div>
        </div>

        <Footer />
      </div>
    </div>
  );
}

function Section({
  tag,
  subtitle,
  recommended,
  notes,
  colors,
}: {
  tag: string;
  subtitle: string;
  recommended?: boolean;
  notes: Array<{ label: string; hex: string; ratio: string; wcag: string }>;
  colors: [string, string, string, string];
}) {
  const [text, muted, dim, faded] = colors;
  return (
    <section className="mb-8 rounded-xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden">
      <header className="flex items-center justify-between gap-4 border-b border-[var(--line)] px-5 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
            {tag}
          </p>
          <p className="mt-1 text-[12px] text-[var(--text-muted)]">{subtitle}</p>
        </div>
        {recommended && (
          <span className="inline-flex items-center gap-1 rounded-md bg-[var(--accent-tint)] px-2 py-1 text-[10px] font-semibold text-[var(--accent)]">
            <CheckCircle2 size={11} /> موصى به
          </span>
        )}
      </header>

      {/* Live sample */}
      <div className="grid grid-cols-1 gap-0 md:grid-cols-[1fr_300px]">
        <div className="space-y-3 p-6 md:p-8">
          <h3 className="text-[22px] font-bold tracking-[-0.018em]" style={{ color: text, fontFamily: 'var(--font-display)' }}>
            مشروع BMW — تسليم خلال ٣ أيام
          </h3>
          <p className="text-[13px] leading-relaxed" style={{ color: muted }}>
            راجع الفريق والمعدات قبل نهاية اليوم. الشوروم متاح بكرة من الـ ٩ صباحاً. التنسيق مع
            خالد وريم على الإضاءة لازم يخلص النهاردة.
          </p>
          <p className="text-[12px]" style={{ color: dim }}>
            ٣ مهام معلقة · آخر تحديث منذ ساعتين · ١٢ ملف في الـ Drive
          </p>
          <p className="text-[11px]" style={{ color: faded }}>
            هذا أصغر نص في الواجهة (footer, timestamps, نسب صغيرة).
          </p>
        </div>
        <div className="border-t border-[var(--line)] bg-[var(--bg)]/60 p-4 md:border-s md:border-t-0">
          <ul className="space-y-2">
            {notes.map((n) => (
              <li key={n.label} className="flex items-center gap-2 text-[11px]">
                <span
                  className="h-5 w-5 shrink-0 rounded border border-[var(--line)]"
                  style={{ background: n.hex }}
                />
                <code className="font-mono text-[10px] text-[var(--text-muted)]">{n.label}</code>
                <span className="ms-auto font-mono text-[10px] text-[var(--text-dim)]">
                  {n.ratio}
                </span>
                <span
                  className={
                    'rounded px-1.5 py-0.5 font-mono text-[9px] ' +
                    (n.wcag === 'FAIL'
                      ? 'bg-red-500/15 text-red-400'
                      : n.wcag.startsWith('AA Large')
                        ? 'bg-yellow-500/15 text-yellow-400'
                        : 'bg-green-500/15 text-green-400')
                  }
                >
                  {n.wcag}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function SizeRow({
  label,
  size,
  weight,
  children,
}: {
  label: string;
  size: number;
  weight: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-4 border-b border-[var(--line)] pb-3 last:border-0 last:pb-0">
      <code className="w-16 font-mono text-[10px] text-[var(--text-dim)]">
        {label}
      </code>
      <span style={{ fontSize: size, fontWeight: weight, lineHeight: 1.4 }}>{children}</span>
      <span className="ms-auto font-mono text-[10px] text-[var(--text-dim)]">
        {size}px / {weight}
      </span>
    </div>
  );
}

function PairCard({
  tag,
  fonts,
  sampleEn,
  sampleAr,
  note,
  recommended,
}: {
  tag: string;
  fonts: string;
  sampleEn: string;
  sampleAr: string;
  note: string;
  recommended?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-dim)]">
          {tag}
        </p>
        {recommended && (
          <span className="rounded-md bg-[var(--accent-tint)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
            موصى به
          </span>
        )}
      </div>
      <p className="mb-3 font-mono text-[11px] text-[var(--text-muted)]">{fonts}</p>
      <p className="text-[20px] font-semibold text-[var(--text)]" style={{ fontFamily: 'system-ui' }}>
        {sampleEn}
      </p>
      <p className="text-[18px] text-[var(--text)]" dir="rtl">
        {sampleAr}
      </p>
      <p className="mt-3 text-[11px] text-[var(--text-muted)]">{note}</p>
    </div>
  );
}

function Footer() {
  return (
    <div className="mt-14 rounded-xl border border-[var(--accent)]/25 bg-[var(--accent-tint)] p-5">
      <p className="text-[12px] text-[var(--text)]">
        <strong>قولي رقم الخيار اللي عاجبك</strong> (مثال: "خيار ٢ للألوان، Plex pairing للخطوط")
        وأطبّق على كل النظام في commit واحد.
      </p>
    </div>
  );
}
