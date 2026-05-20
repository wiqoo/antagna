import { FRAME_COLORS as C, FrameContent, NavPreviewBar } from '../../frame-shared';

export const dynamic = 'force-static';

const TOP_NAV = [
  { label: 'لوحة التحكم', active: true },
  { label: 'المشاريع' },
  { label: 'المهام' },
  { label: 'العملاء' },
  { label: 'المعدات' },
  { label: 'التقويم' },
  { label: 'التقارير' },
];

export default function TopNav() {
  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'var(--font-arabic), system-ui' }}>
      <NavPreviewBar slug="top" name="Top Horizontal" />

      {/* Top nav bar */}
      <div style={{
        background: C.surface,
        borderBottom: `1px solid ${C.line}`,
        position: 'sticky', top: 40, zIndex: 50,
      }}>
        <div style={{
          maxWidth: 1400, margin: '0 auto',
          padding: '0 24px',
          display: 'flex', alignItems: 'center', gap: 24,
          height: 56,
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 28, height: 28, borderRadius: 6,
              background: C.gradient,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 12, color: '#fff',
            }}>A</span>
            <span style={{ fontWeight: 600, fontSize: 16 }}>Antagna</span>
          </div>

          {/* Nav links */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 4, marginInlineStart: 24 }}>
            {TOP_NAV.map((item) => (
              <a key={item.label} href="#" style={{
                padding: '6px 12px', borderRadius: 6,
                fontSize: 13,
                color: item.active ? C.text : C.muted,
                background: item.active ? C.accent + '15' : 'transparent',
                fontWeight: item.active ? 500 : 400,
                textDecoration: 'none',
                position: 'relative',
              }}>
                {item.label}
                {item.active && (
                  <span style={{
                    position: 'absolute',
                    bottom: -17, left: '50%', transform: 'translateX(-50%)',
                    width: 24, height: 2,
                    background: C.accent,
                  }} />
                )}
              </a>
            ))}
            <a href="#" style={{
              padding: '6px 12px', borderRadius: 6,
              fontSize: 13, color: C.muted, textDecoration: 'none',
            }}>المزيد ▾</a>
          </nav>

          {/* Right side */}
          <div style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              padding: '5px 10px',
              border: `1px solid ${C.line}`,
              background: C.bg,
              borderRadius: 6,
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 12, color: C.dim,
              minWidth: 200,
            }}>
              <span>بحث…</span>
              <span style={{ marginInlineStart: 'auto', fontSize: 10, fontFamily: 'var(--font-mono)' }}>⌘K</span>
            </div>
            <button style={{
              background: C.gradient, color: '#fff', border: 'none',
              borderRadius: 6, padding: '6px 14px',
              fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
            }}>+ مشروع جديد</button>
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: '#34D399', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 600,
            }}>M</div>
          </div>
        </div>

        {/* Sub-nav / breadcrumb */}
        <div style={{
          maxWidth: 1400, margin: '0 auto',
          padding: '6px 24px',
          fontSize: 11, color: C.muted,
          display: 'flex', alignItems: 'center', gap: 8,
          borderTop: `1px solid ${C.line}`,
        }}>
          <span>الرئيسية</span>
          <span style={{ color: C.dim }}>/</span>
          <span style={{ color: C.text }}>لوحة التحكم</span>
        </div>
      </div>

      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '28px 36px' }}>
        <FrameContent />
      </main>
    </div>
  );
}
