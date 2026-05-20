import Link from 'next/link';

export const dynamic = 'force-static';

const OPTIONS = [
  {
    slug: 'mix',
    name: '✓ Mix · المختار',
    nameAr: 'المختار: Conductor + Critical Path + Cards',
    desc: 'مزيج الثلاثة: AI Conductor فوق (يوجّه القرارات)، اليوم time-strip في النص، Cards Grid قابلة للتخصيص تحت، Ask Claude في الأسفل. مع side-dock.',
    cards: ['AI Conductor', 'Today time-strip', 'Cards Grid', 'Ask Claude'],
  },
  {
    slug: 'cards',
    name: 'Cards Grid · Customizable',
    nameAr: 'شبكة كروت قابلة للتخصيص',
    desc: 'كروت ذكية بـ AI suggestions و quick actions، المستخدم يضيف/يحذف/يرتّب أي كرت. كل كرت يفعل حاجة محددة.',
    cards: [
      'AI Daily Briefing',
      'Critical Path Today',
      'At-Risk Projects',
      'Approval Queue',
      'Team Capacity Heatmap',
      'Equipment Conflicts',
      'Cold Leads Warming',
      'Revenue Forecast',
      'Recent Deliveries',
      'Weather + Shoot Impact',
      'Late Payments (Dafterah)',
      'AI Recommendations',
    ],
  },
  {
    slug: 'ai-conductor',
    name: 'AI Conductor · Claude-led',
    nameAr: 'Claude هو الـ Conductor',
    desc: 'الـ AI يقود الـ dashboard — يسأل، يقترح، يحرّك. أنت ترد على Claude والـ dashboard يتطوّر. ChatGPT-like بس مخصص لـ Volt.',
    cards: ['"اللي يستحق انتباهك" - حوار', 'Quick actions inline', 'AI search across everything'],
  },
  {
    slug: 'critical-path',
    name: 'Critical Path · Today-first',
    nameAr: 'مسار الأولوية الحرج',
    desc: 'الـ dashboard يعرض فقط ما يحتاج إجراء اليوم/الأسبوع. كل شيء time-ordered. أبسط شكل ممكن، أعلى تركيز.',
    cards: ['اليوم', 'هذا الأسبوع', 'الأسبوع القادم', 'متوقف / محتاج قرار'],
  },
];

export default function DashboardPreviewsIndex() {
  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100vh',
        background: '#0F0F12',
        color: '#fff',
        fontFamily: 'var(--font-arabic), system-ui',
        padding: '4rem 1.5rem',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <Link href="/preview" style={{ color: '#FF6B1A', fontSize: 12, textDecoration: 'none' }}>
          ← كل المعاينات
        </Link>
        <p style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#888', marginTop: 24, marginBottom: 12 }}>
          Dashboard Concepts · Smart + Customizable
        </p>
        <h1 style={{
          fontSize: 48, fontWeight: 700, lineHeight: 1.1,
          letterSpacing: '-0.02em', marginBottom: 12,
          background: 'linear-gradient(135deg, #FF6B1A, #FF8442)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          fontFamily: 'var(--font-arabic-display)',
        }}>
          ثلاث رؤى للداشبورد
        </h1>
        <p style={{ fontSize: 16, color: '#aaa', maxWidth: 640, lineHeight: 1.6 }}>
          ٣ مفاهيم مختلفة جذرياً لما يجب أن يكون عليه dashboard Antagna — مع كروت ذكية،
          AI فعّال، و تخصيص حقيقي.
        </p>

        <div style={{
          marginTop: 48,
          display: 'grid',
          gap: 14,
          gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
        }}>
          {OPTIONS.map((o) => (
            <Link
              key={o.slug}
              href={`/preview/dashboard/${o.slug}`}
              style={{
                display: 'block',
                background: '#17171C',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12,
                padding: 24,
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <p style={{ fontSize: 11, color: '#888', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
                {o.name}
              </p>
              <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 10 }}>
                {o.nameAr}
              </h2>
              <p style={{ fontSize: 13, color: '#aaa', lineHeight: 1.6, marginBottom: 14 }}>
                {o.desc}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {o.cards.slice(0, 6).map((c) => (
                  <span key={c} style={{
                    padding: '4px 10px', borderRadius: 6,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    fontSize: 11, color: '#bbb',
                  }}>{c}</span>
                ))}
                {o.cards.length > 6 && (
                  <span style={{ padding: '4px 10px', fontSize: 11, color: '#888' }}>
                    +{o.cards.length - 6}
                  </span>
                )}
              </div>
              <p style={{ marginTop: 16, fontSize: 13, color: '#FF6B1A', fontWeight: 500 }}>
                افتح المعاينة ←
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
