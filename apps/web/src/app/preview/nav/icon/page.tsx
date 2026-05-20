import { FRAME_COLORS as C, FrameContent, NAV_ITEMS, NavPreviewBar } from '../../frame-shared';

export const dynamic = 'force-static';

export default function IconNav() {
  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'var(--font-arabic), system-ui' }}>
      <NavPreviewBar slug="icon" name="Icon Bar — 64px" />

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 40px)' }}>
        {/* 64px icon-only sidebar */}
        <aside style={{
          width: 64,
          background: C.surface,
          borderInlineStart: `1px solid ${C.line}`,
          padding: '16px 0',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 4,
          position: 'sticky', top: 40, height: 'calc(100vh - 40px)',
        }}>
          {/* Logo */}
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: C.gradient,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 14, color: '#fff',
            marginBottom: 12,
          }}>A</div>
          {/* Icons */}
          {NAV_ITEMS.map((item) => (
            <a key={item.label} href="#" title={item.label} style={{
              width: 40, height: 40, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16,
              color: item.active ? C.accent : C.muted,
              background: item.active ? C.accent + '15' : 'transparent',
              textDecoration: 'none',
              position: 'relative',
            }}>
              {item.icon}
              {item.active && (
                <span style={{
                  position: 'absolute',
                  insetInlineEnd: -8, top: '50%', transform: 'translateY(-50%)',
                  width: 3, height: 16, borderRadius: 2,
                  background: C.accent,
                }} />
              )}
            </a>
          ))}
          {/* User at bottom */}
          <div style={{ marginTop: 'auto', padding: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: '#34D399', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 600,
            }}>M</div>
          </div>
        </aside>

        <main style={{ flex: 1, padding: '28px 36px', maxWidth: 1200, margin: '0 auto' }}>
          <FrameContent />
        </main>
      </div>
    </div>
  );
}
