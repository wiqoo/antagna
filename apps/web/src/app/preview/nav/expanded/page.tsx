import { FRAME_COLORS as C, FrameContent, NavPreviewBar } from '../../frame-shared';

export const dynamic = 'force-static';

const GROUPS: Array<{ label?: string; items: Array<[string, string, boolean?]> }> = [
  {
    items: [['◇', 'لوحة التحكم', true]],
  },
  {
    label: 'العمليات',
    items: [
      ['▢', 'المشاريع'],
      ['✓', 'المهام'],
      ['✉', 'الوارد'],
      ['◉', 'العملاء'],
      ['◰', 'المعدات'],
      ['▦', 'التقويم'],
      ['◧', 'الفريق'],
    ],
  },
  {
    label: 'الأرشيف',
    items: [
      ['📊', 'مؤشرات الأداء'],
      ['▤', 'التقارير'],
      ['⚙', 'الإعدادات'],
    ],
  },
];

export default function ExpandedNav() {
  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'var(--font-arabic), system-ui' }}>
      <NavPreviewBar slug="expanded" name="Expanded — 240px" />

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 40px)' }}>
        <aside style={{
          width: 240,
          background: C.surface,
          borderInlineStart: `1px solid ${C.line}`,
          padding: '20px 12px',
          position: 'sticky', top: 40, height: 'calc(100vh - 40px)',
          overflowY: 'auto',
        }}>
          {/* Logo block */}
          <div style={{ padding: '4px 8px 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 28, height: 28, borderRadius: 6,
              background: C.gradient,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 12, color: '#fff',
            }}>A</span>
            <span style={{ fontWeight: 600, fontSize: 16 }}>Antagna</span>
          </div>

          {GROUPS.map((g, gi) => (
            <div key={gi} style={{ marginBottom: 16 }}>
              {g.label && (
                <p style={{
                  padding: '8px 10px 6px',
                  fontSize: 10, color: C.dim,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  fontWeight: 600,
                }}>{g.label}</p>
              )}
              {g.items.map(([icon, label, active]) => (
                <a key={label as string} href="#" style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 6,
                  fontSize: 13,
                  color: active ? C.text : C.muted,
                  background: active ? C.accent + '15' : 'transparent',
                  fontWeight: active ? 500 : 400,
                  textDecoration: 'none',
                  marginBottom: 1,
                  position: 'relative',
                }}>
                  <span style={{
                    fontSize: 14,
                    color: active ? C.accent : C.dim,
                    width: 18, textAlign: 'center',
                  }}>{icon as string}</span>
                  <span>{label as string}</span>
                  {active && (
                    <span style={{
                      position: 'absolute',
                      insetInlineEnd: -12, top: '50%', transform: 'translateY(-50%)',
                      width: 3, height: 16, borderRadius: 2,
                      background: C.accent,
                    }} />
                  )}
                </a>
              ))}
            </div>
          ))}

          {/* User at bottom */}
          <div style={{
            marginTop: 'auto', position: 'sticky', bottom: 0,
            padding: '12px 0 0',
            borderTop: `1px solid ${C.line}`,
            background: C.surface,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '6px 10px', borderRadius: 6,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: '#34D399', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 600,
              }}>M</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 500 }}>Mohammed</p>
                <p style={{ fontSize: 10, color: C.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  mohammedelghareib@gmail.com
                </p>
              </div>
            </div>
          </div>
        </aside>

        <main style={{ flex: 1, padding: '28px 36px', maxWidth: 1100, margin: '0 auto' }}>
          <FrameContent />
        </main>
      </div>
    </div>
  );
}
