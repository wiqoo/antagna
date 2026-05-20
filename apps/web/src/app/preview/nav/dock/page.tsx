import { FRAME_COLORS as C, FrameContent, NavPreviewBar } from '../../frame-shared';

export const dynamic = 'force-static';

const DOCK_ITEMS = [
  { icon: '◇', label: 'الرئيسية', active: true },
  { icon: '▢', label: 'المشاريع' },
  { icon: '✉', label: 'الوارد' },
  { icon: '▦', label: 'التقويم' },
  { icon: '☰', label: 'المزيد' },
];

export default function DockNav() {
  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'var(--font-arabic), system-ui', paddingBottom: 90 }}>
      <NavPreviewBar slug="dock" name="Bottom Dock — Mobile-first" />

      {/* Minimal top bar */}
      <div style={{
        position: 'sticky', top: 40, zIndex: 50,
        background: C.bg,
        borderBottom: `1px solid ${C.line}`,
        padding: '0 20px',
        height: 52,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 28, height: 28, borderRadius: 6,
            background: C.gradient,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 12, color: '#fff',
          }}>A</span>
          <span style={{ fontWeight: 600, fontSize: 16 }}>Antagna</span>
        </div>

        <div style={{
          flex: 1, maxWidth: 400,
          padding: '5px 12px', marginInlineStart: 24,
          border: `1px solid ${C.line}`, borderRadius: 6,
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 12, color: C.dim,
        }}>
          <span>بحث…</span>
          <span style={{ marginInlineStart: 'auto', fontSize: 10, fontFamily: 'var(--font-mono)' }}>⌘K</span>
        </div>

        <div style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button style={{
            background: C.gradient, color: '#fff', border: 'none',
            borderRadius: 6, padding: '6px 14px',
            fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
          }}>+ مشروع</button>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: '#34D399', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 600,
          }}>M</div>
        </div>
      </div>

      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '28px 36px' }}>
        <FrameContent />
      </main>

      {/* Floating bottom dock */}
      <div style={{
        position: 'fixed',
        bottom: 16, left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        background: C.surface,
        borderRadius: 16,
        padding: '6px',
        border: `1px solid ${C.lineStrong}`,
        boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
        backdropFilter: 'blur(20px)',
        display: 'flex',
        gap: 4,
      }}>
        {DOCK_ITEMS.map((item) => (
          <a key={item.label} href="#" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            padding: '10px 18px', borderRadius: 12,
            color: item.active ? C.text : C.muted,
            background: item.active ? C.accent + '15' : 'transparent',
            textDecoration: 'none',
            minWidth: 64,
            position: 'relative',
          }}>
            <span style={{ fontSize: 18, color: item.active ? C.accent : C.dim }}>{item.icon}</span>
            <span style={{ fontSize: 10, fontWeight: item.active ? 600 : 400 }}>{item.label}</span>
            {item.active && (
              <span style={{
                position: 'absolute', bottom: -3, left: '50%', transform: 'translateX(-50%)',
                width: 16, height: 2, borderRadius: 1, background: C.accent,
              }} />
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
