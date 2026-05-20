import { FRAME_COLORS as C, FrameContent, NAV_ITEMS, NavPreviewBar } from '../../frame-shared';

export const dynamic = 'force-static';

export default function HoverNav() {
  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'var(--font-arabic), system-ui' }}>
      <NavPreviewBar slug="hover" name="Hover-expand — Linear style" />

      <style>{`
        .hover-sidebar {
          width: 64px;
          transition: width 220ms cubic-bezier(0.16, 1, 0.3, 1);
          overflow: hidden;
        }
        .hover-sidebar:hover {
          width: 240px;
        }
        .hover-sidebar .label {
          opacity: 0;
          transition: opacity 180ms;
          white-space: nowrap;
        }
        .hover-sidebar:hover .label {
          opacity: 1;
        }
      `}</style>

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 40px)' }}>
        <aside
          className="hover-sidebar"
          style={{
            background: C.surface,
            borderInlineStart: `1px solid ${C.line}`,
            padding: '16px 12px',
            position: 'sticky', top: 40, height: 'calc(100vh - 40px)',
            display: 'flex', flexDirection: 'column',
            gap: 2,
          }}
        >
          {/* Logo */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '4px 4px 16px',
          }}>
            <span style={{
              width: 32, height: 32, borderRadius: 8,
              background: C.gradient,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 14, color: '#fff',
              flexShrink: 0,
            }}>A</span>
            <span className="label" style={{ fontWeight: 600, fontSize: 15 }}>
              Antagna
            </span>
          </div>

          {NAV_ITEMS.map((item) => (
            <a key={item.label} href="#" style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '8px 8px', borderRadius: 6,
              color: item.active ? C.text : C.muted,
              background: item.active ? C.accent + '15' : 'transparent',
              textDecoration: 'none', fontWeight: item.active ? 500 : 400,
              position: 'relative',
            }}>
              <span style={{
                fontSize: 16, color: item.active ? C.accent : C.dim,
                width: 24, textAlign: 'center', flexShrink: 0,
              }}>{item.icon}</span>
              <span className="label" style={{ fontSize: 13 }}>{item.label}</span>
              {item.active && (
                <span style={{
                  position: 'absolute',
                  insetInlineEnd: -12, top: '50%', transform: 'translateY(-50%)',
                  width: 3, height: 16, borderRadius: 2,
                  background: C.accent,
                }} />
              )}
            </a>
          ))}

          {/* User */}
          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 12, padding: '8px' }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: '#34D399', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 600, flexShrink: 0,
            }}>M</div>
            <div className="label" style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 500 }}>Mohammed</p>
              <p style={{ fontSize: 10, color: C.dim }}>الحساب</p>
            </div>
          </div>
        </aside>

        <main style={{ flex: 1, padding: '28px 36px', maxWidth: 1200, margin: '0 auto' }}>
          <div style={{
            padding: '10px 14px',
            background: C.accent + '10',
            border: `1px solid ${C.accent}30`,
            borderRadius: 8,
            fontSize: 12,
            marginBottom: 24,
            color: C.accent,
          }}>
            💡 مرّر الماوس على الـ sidebar لترى التوسّع التلقائي.
          </div>
          <FrameContent />
        </main>
      </div>
    </div>
  );
}
