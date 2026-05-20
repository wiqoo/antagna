import { FRAME_COLORS as C, FrameContent } from '../../frame-shared';
import Link from 'next/link';

export const dynamic = 'force-static';

const DOCK_ITEMS = [
  { icon: '◇', label: 'الرئيسية', active: true },
  { icon: '▢', label: 'المشاريع', badge: '12' },
  { icon: '✓', label: 'المهام', badge: '8' },
  { icon: '✉', label: 'الوارد', badge: '3' },
  { icon: '◉', label: 'العملاء' },
  { icon: '▦', label: 'التقويم' },
  { icon: '☰', label: 'المزيد' },
];

export default function SideDock() {
  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'var(--font-arabic), system-ui' }}>
      {/* Top bar — minimal */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: C.surface, borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '8px 16px', fontSize: 11,
        display: 'flex', alignItems: 'center', gap: 12, color: C.text,
      }}>
        <Link href="/preview/nav" style={{ color: 'inherit', textDecoration: 'none' }}>← Nav patterns</Link>
        <span style={{ opacity: 0.4 }}>·</span>
        <span style={{ fontWeight: 500 }}>Side Dock — RTL aware, customizable</span>
        <span style={{ marginInlineStart: 'auto', opacity: 0.6 }}>desktop dock يمين · موبايل أسفل</span>
      </div>

      {/* App top bar */}
      <div style={{
        background: C.bg,
        borderBottom: `1px solid ${C.line}`,
        padding: '0 24px',
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
          padding: '5px 12px', marginInlineStart: 32,
          border: `1px solid ${C.line}`, borderRadius: 8,
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 12, color: C.dim, background: C.surface,
        }}>
          <span>ابحث عن مشروع، عميل، شخص…</span>
          <span style={{ marginInlineStart: 'auto', fontSize: 10, fontFamily: 'var(--font-mono)' }}>⌘K</span>
        </div>

        <div style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button style={{
            background: C.gradient, color: '#fff', border: 'none',
            borderRadius: 8, padding: '6px 14px',
            fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
          }}>+ مشروع</button>
          <button style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'transparent', border: `1px solid ${C.line}`,
            color: C.muted, fontSize: 14, cursor: 'pointer',
          }} title="إعدادات الـ Dock">⚙</button>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: '#34D399', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 600,
          }}>M</div>
        </div>
      </div>

      {/* Content + side-dock layout */}
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 92px)', position: 'relative' }}>
        {/* Main content */}
        <main style={{
          flex: 1, padding: '28px 36px',
          paddingInlineEnd: 100, /* leave space for dock */
          maxWidth: 1400, margin: '0 auto',
        }}>
          {/* Customization preview banner */}
          <div style={{
            padding: 16,
            background: C.accent + '08',
            border: `1px solid ${C.accent}30`,
            borderRadius: 10,
            marginBottom: 24,
            display: 'flex', alignItems: 'center', gap: 16,
          }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 11, color: C.accent, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4 }}>
                Customizable Dock
              </p>
              <p style={{ fontSize: 14, fontWeight: 500 }}>
                المستخدم يقدر يخصص: الموقع، الحجم، و العناصر الظاهرة.
              </p>
            </div>
            <button style={{
              background: C.surface,
              color: C.text,
              border: `1px solid ${C.lineStrong}`,
              borderRadius: 8,
              padding: '8px 14px',
              fontSize: 12,
              fontWeight: 500,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}>خصّص الـ Dock</button>
          </div>

          <FrameContent />
        </main>

        {/* Floating side dock — desktop only */}
        <div className="hidden md:flex" style={{
          position: 'fixed',
          insetInlineEnd: 24, top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 50,
          flexDirection: 'column',
          background: C.surface,
          borderRadius: 16,
          padding: 6,
          border: `1px solid ${C.lineStrong}`,
          boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
          gap: 4,
        }}>
          {DOCK_ITEMS.map((item) => (
            <a key={item.label} href="#" style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '10px 12px', borderRadius: 12,
              color: item.active ? C.text : C.muted,
              background: item.active ? C.accent + '15' : 'transparent',
              textDecoration: 'none',
              minWidth: 56,
              position: 'relative',
            }}>
              <span style={{ fontSize: 16, color: item.active ? C.accent : C.dim, position: 'relative' }}>
                {item.icon}
                {item.badge && (
                  <span style={{
                    position: 'absolute',
                    top: -4, insetInlineEnd: -8,
                    minWidth: 14, height: 14, padding: '0 4px',
                    background: C.accent, color: '#fff',
                    borderRadius: 7, fontSize: 9, fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-mono)',
                  }}>{item.badge}</span>
                )}
              </span>
              <span style={{ fontSize: 9, fontWeight: item.active ? 600 : 400 }}>{item.label}</span>
              {item.active && (
                <span style={{
                  position: 'absolute',
                  insetInlineStart: -3, top: '50%', transform: 'translateY(-50%)',
                  width: 2, height: 16, borderRadius: 1, background: C.accent,
                }} />
              )}
            </a>
          ))}
        </div>

        {/* Mobile bottom dock — same items, different position */}
        <div className="md:hidden" style={{
          position: 'fixed',
          bottom: 16, left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50,
          background: C.surface,
          borderRadius: 16,
          padding: 6,
          border: `1px solid ${C.lineStrong}`,
          boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
          display: 'flex',
          gap: 4,
        }}>
          {DOCK_ITEMS.slice(0, 5).map((item) => (
            <a key={item.label} href="#" style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '10px 14px', borderRadius: 12,
              color: item.active ? C.text : C.muted,
              background: item.active ? C.accent + '15' : 'transparent',
              textDecoration: 'none',
              minWidth: 56, position: 'relative',
            }}>
              <span style={{ fontSize: 18, color: item.active ? C.accent : C.dim }}>{item.icon}</span>
              <span style={{ fontSize: 9 }}>{item.label}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Customization panel — mockup of settings */}
      <div style={{
        position: 'fixed',
        bottom: 24, insetInlineStart: 24,
        background: C.surface,
        border: `1px solid ${C.lineStrong}`,
        borderRadius: 12,
        padding: 16,
        width: 320,
        boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5)',
      }}>
        <p style={{ fontSize: 11, color: C.dim, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>
          Dock Settings (Preview)
        </p>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>التخصيص</h3>

        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>الموقع</p>
          <div style={{ display: 'flex', gap: 4 }}>
            {['يسار', 'يمين', 'أسفل'].map((p, i) => (
              <button key={p} style={{
                flex: 1, padding: '6px 8px',
                background: i === 1 ? C.accent + '20' : C.bg,
                color: i === 1 ? C.accent : C.muted,
                border: `1px solid ${i === 1 ? C.accent : C.line}`,
                borderRadius: 6, fontSize: 11,
                fontFamily: 'inherit', cursor: 'pointer',
              }}>{p}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>الحجم</p>
          <div style={{ display: 'flex', gap: 4 }}>
            {['صغير', 'عادي', 'كبير'].map((s, i) => (
              <button key={s} style={{
                flex: 1, padding: '6px 8px',
                background: i === 1 ? C.accent + '20' : C.bg,
                color: i === 1 ? C.accent : C.muted,
                border: `1px solid ${i === 1 ? C.accent : C.line}`,
                borderRadius: 6, fontSize: 11,
                fontFamily: 'inherit', cursor: 'pointer',
              }}>{s}</button>
            ))}
          </div>
        </div>

        <div>
          <p style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>العناصر الظاهرة (7 من 12)</p>
          <div style={{ maxHeight: 120, overflowY: 'auto' }}>
            {DOCK_ITEMS.map((item, i) => (
              <div key={item.label} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 6px', borderRadius: 4,
                fontSize: 12,
                background: i % 2 ? 'transparent' : C.bg,
              }}>
                <span style={{ color: C.dim, fontFamily: 'var(--font-mono)', fontSize: 10 }}>⋮⋮</span>
                <span style={{ color: C.muted }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                <input type="checkbox" defaultChecked style={{ accentColor: C.accent }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
