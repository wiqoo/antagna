import Link from 'next/link';

export const dynamic = 'force-static';

const STYLES = [
  {
    slug: 'notion',
    name: 'Notion · Minimal',
    nameAr: 'هاديء و فسيح',
    desc: 'كريم، typography كبيرة، whitespace، minimal chrome. مثل Notion / Linear settings.',
    palette: ['#FBFAF7', '#FFFFFF', '#37352F', '#FF6B1A'],
  },
  {
    slug: 'linear',
    name: 'Linear · Dense Dark',
    nameAr: 'مكثّف و سريع',
    desc: 'أسود حقيقي، قوائم مكثّفة، ⌘K، صغير و سريع. للـ power users.',
    palette: ['#08090A', '#141517', '#F4F4F5', '#7C5CFF'],
  },
  {
    slug: 'stripe',
    name: 'Stripe · Business',
    nameAr: 'احترافي تجاري',
    desc: 'أبيض، أزرق هاديء، جداول واضحة، عناوين متوسطة. مثل Stripe Dashboard.',
    palette: ['#FFFFFF', '#F6F9FC', '#0A2540', '#635BFF'],
  },
  {
    slug: 'frame',
    name: 'Frame.io · Studio · ✓ المختار',
    nameAr: 'إستوديو إبداعي (orange)',
    desc: 'داكن، فيديو-أولاً، magazine layout، grids كبيرة. الاتجاه المعتمد — orange accent.',
    palette: ['#0F0F12', '#17171C', '#FFFFFF', '#FF6B1A'],
  },
];

export default function PreviewIndex() {
  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100vh',
        background: '#0a0a0a',
        color: '#fafafa',
        fontFamily: 'var(--font-arabic), system-ui, sans-serif',
        padding: '4rem 1.5rem',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <p
          style={{
            fontSize: 11,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: '#888',
            marginBottom: 12,
          }}
        >
          Antagna · Style Previews
        </p>
        <h1 style={{ fontSize: 48, fontWeight: 700, lineHeight: 1.1, marginBottom: 12 }}>
          اختر اتجاه التصميم
        </h1>
        <p style={{ fontSize: 16, color: '#aaa', maxWidth: 600, lineHeight: 1.6 }}>
          أربع dashboards كاملة — نفس البيانات، شكل و معمارية مختلفة تماماً. تنقّل بينهم
          وقُل لي أيهم يلامس Antagna.
        </p>

        <div
          style={{
            marginTop: 48,
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          }}
        >
          {STYLES.map((s) => (
            <Link
              key={s.slug}
              href={`/preview/${s.slug}`}
              style={{
                display: 'block',
                background: '#141414',
                border: '1px solid #2a2a2a',
                borderRadius: 12,
                padding: 24,
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                {s.palette.map((c) => (
                  <div
                    key={c}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      background: c,
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  />
                ))}
              </div>
              <p style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>{s.name}</p>
              <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 10 }}>
                {s.nameAr}
              </h2>
              <p style={{ fontSize: 14, color: '#aaa', lineHeight: 1.6 }}>{s.desc}</p>
              <p
                style={{
                  marginTop: 16,
                  fontSize: 13,
                  color: '#FF6B1A',
                  fontWeight: 500,
                }}
              >
                افتح المعاينة ←
              </p>
            </Link>
          ))}
        </div>

        <div style={{ marginTop: 48, display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))' }}>
          <Link
            href="/preview/nav"
            style={{
              display: 'block',
              background: 'linear-gradient(135deg, #FF6B1A10, transparent)',
              border: '1px solid #FF6B1A40',
              borderRadius: 12,
              padding: 24,
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <p style={{ fontSize: 11, color: '#FF6B1A', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
              Nav Patterns · 6 options
            </p>
            <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>
              معاينات أسلوب القائمة
            </h2>
            <p style={{ fontSize: 13, color: '#aaa', lineHeight: 1.6 }}>
              ٦ معماريات تنقل — icon-only، expanded، hover-expand، top، bottom dock، side dock customizable.
            </p>
            <p style={{ marginTop: 12, fontSize: 13, color: '#FF6B1A', fontWeight: 500 }}>افتح ←</p>
          </Link>

          <Link
            href="/preview/dashboard"
            style={{
              display: 'block',
              background: 'linear-gradient(135deg, #FF6B1A10, transparent)',
              border: '1px solid #FF6B1A40',
              borderRadius: 12,
              padding: 24,
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <p style={{ fontSize: 11, color: '#FF6B1A', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
              Dashboard Concepts · 3 options
            </p>
            <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>
              معاينات الداشبورد الذكية
            </h2>
            <p style={{ fontSize: 13, color: '#aaa', lineHeight: 1.6 }}>
              ٣ مفاهيم: Cards Grid قابلة للتخصيص، AI Conductor (Claude يقود)، Critical Path (time-first).
            </p>
            <p style={{ marginTop: 12, fontSize: 13, color: '#FF6B1A', fontWeight: 500 }}>افتح ←</p>
          </Link>
        </div>

        <p
          style={{
            marginTop: 64,
            fontSize: 12,
            color: '#666',
            textAlign: 'center',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          Antagna · Volt Production
        </p>
      </div>
    </div>
  );
}
