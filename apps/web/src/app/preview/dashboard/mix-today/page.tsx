import {
  MIX as C, TODAY_ITEMS, KIND_ICONS, AI_PRIORITIES,
  MixTopBar, SideDock, BottomDock, Card,
} from '../mix-shared';

export const dynamic = 'force-static';

// Timeline hour markers (06 → 22)
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6);

function timeToPercent(time: string): number {
  const [h, m] = time.split(':').map(Number);
  const minutesIntoDay = (h ?? 0) * 60 + (m ?? 0);
  const startMin = 6 * 60;
  const endMin = 22 * 60;
  return ((minutesIntoDay - startMin) / (endMin - startMin)) * 100;
}

export default function MixTodayFirst() {
  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'var(--font-arabic), system-ui' }}>
      <style>{`
        .mt-layout { display: grid; grid-template-columns: 1fr 360px; gap: 16px; }
        .mt-cards { display: grid; gap: 10px; grid-template-columns: repeat(2, 1fr); }
        @media (max-width: 1100px) {
          .mt-layout { grid-template-columns: 1fr; }
        }
        @media (max-width: 720px) {
          .mt-cards { grid-template-columns: 1fr; }
          .mt-main { padding: 12px !important; padding-inline-end: 12px !important; }
          .mt-timeline { overflow-x: auto; }
        }
      `}</style>
      <MixTopBar name="Mix · Today-first" />

      <main className="mt-main" style={{ padding: '24px 28px', paddingInlineEnd: 100, maxWidth: 1400, margin: '0 auto' }}>
        {/* Greeting */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
          <p style={{ fontSize: 11, color: C.muted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            الأربعاء، ٢١ مايو
          </p>
          <span style={{ fontSize: 10, color: C.accent, fontWeight: 600 }}>● ٤ بنود اليوم · ٢ urgent</span>
        </div>
        <h1 style={{
          fontSize: 36, fontWeight: 700, letterSpacing: '-0.02em',
          fontFamily: 'var(--font-arabic-display)', marginBottom: 20,
        }}>
          يومك في Volt
        </h1>

        {/* TIMELINE — full-width horizontal visualization */}
        <section className="mt-timeline" style={{
          background: C.surface,
          border: `1px solid ${C.line}`,
          borderRadius: 12,
          padding: '20px 24px',
          marginBottom: 18,
          minHeight: 200,
          position: 'relative',
        }}>
          {/* Hour rail */}
          <div style={{ position: 'relative', height: 140 }}>
            {/* Hour grid lines */}
            <div style={{
              position: 'absolute', inset: 0,
              display: 'grid', gridTemplateColumns: `repeat(${HOURS.length}, 1fr)`,
            }}>
              {HOURS.map((h, i) => (
                <div key={h} style={{
                  borderInlineEnd: i < HOURS.length - 1 ? `1px dashed ${C.line}` : 'none',
                  position: 'relative',
                }}>
                  <span style={{
                    position: 'absolute', top: -4, insetInlineStart: -10,
                    fontSize: 10, color: C.dim,
                    fontFamily: 'var(--font-mono)',
                  }}>{String(h).padStart(2, '0')}</span>
                </div>
              ))}
            </div>

            {/* "Now" indicator (assume 11:30) */}
            <div style={{
              position: 'absolute',
              insetInlineEnd: `${100 - timeToPercent('11:30')}%`,
              top: 14, bottom: 0,
              borderInlineEnd: `2px solid ${C.accent}`,
            }}>
              <span style={{
                position: 'absolute', top: -8, insetInlineEnd: -22,
                fontSize: 9, color: C.accent, fontWeight: 600,
                background: C.bg, padding: '0 4px',
                fontFamily: 'var(--font-mono)',
              }}>NOW</span>
            </div>

            {/* Event pills positioned by time */}
            {TODAY_ITEMS.map((item, i) => {
              const k = KIND_ICONS[item.kind] ?? KIND_ICONS.deliver!;
              const pct = timeToPercent(item.time);
              return (
                <div key={i} style={{
                  position: 'absolute',
                  top: 24 + (i % 2) * 60,
                  insetInlineEnd: `${100 - pct}%`,
                  minWidth: 180,
                  background: item.urgent ? C.accent + '15' : C.bg,
                  border: `1px solid ${item.urgent ? C.accent + '50' : C.lineStrong}`,
                  borderRadius: 10,
                  padding: '8px 12px',
                  fontSize: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{
                      width: 18, height: 18, borderRadius: 4,
                      background: k.color + '25', color: k.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10,
                    }}>{k.icon}</span>
                    <span style={{
                      fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600,
                      color: item.urgent ? C.accent : C.text,
                    }}>{item.time}</span>
                    {item.urgent && (
                      <span style={{
                        fontSize: 8, padding: '1px 5px', borderRadius: 3,
                        background: C.accent + '30', color: C.accent,
                        fontWeight: 600, marginInlineStart: 'auto',
                      }}>!</span>
                    )}
                  </div>
                  <p style={{ fontSize: 11, fontWeight: 500 }}>{item.what}</p>
                  <p style={{ fontSize: 9, color: C.muted, marginTop: 1 }}>{item.who}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* AI + Cards (two columns) */}
        <div className="mt-layout">
          {/* Cards Grid */}
          <section>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.018em', fontFamily: 'var(--font-arabic-display)' }}>اللوحة</h2>
              <button style={{
                marginInlineStart: 'auto',
                padding: '4px 10px', borderRadius: 5,
                background: C.surface, border: `1px solid ${C.line}`,
                color: C.text, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit',
              }}>تخصيص</button>
            </div>
            <div className="mt-cards">
              <Card span={1} title="مشاريع في خطر" badge="3" badgeTone="danger">
                {[['PR-0007', 'متوقف ٥ أيام', 'red'], ['PR-0010', 'وقت ضيق', 'red'], ['PR-0009', 'موافقة معلّقة', 'amber']].map(([code, r, risk]) => (
                  <div key={code} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderTop: `1px solid ${C.line}`, fontSize: 11 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: risk === 'red' ? '#F87171' : '#FBBF24' }} />
                    <span style={{ fontFamily: 'var(--font-mono)', color: C.muted }}>{code}</span>
                    <span style={{ flex: 1 }}>{r}</span>
                  </div>
                ))}
              </Card>
              <Card span={1} title="قائمة الموافقات" badge="5">
                {[['PR-0009 V3', '2h'], ['PR-0010 V1', '5h'], ['PR-0005 V2', '1d']].map(([item, w]) => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderTop: `1px solid ${C.line}`, fontSize: 11 }}>
                    <span style={{ flex: 1, fontWeight: 500 }}>{item}</span>
                    <span style={{ color: C.dim, fontSize: 10 }}>{w}</span>
                  </div>
                ))}
              </Card>
              <Card span={1} title="حمولة الفريق">
                {[['محمد المالكي', 90], ['Khaled', 70], ['Kabsy', 110, true]].map(([name, load, over]) => (
                  <div key={name as string} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 36px', gap: 6, alignItems: 'center', padding: '3px 0' }}>
                    <span style={{ fontSize: 10 }}>{name as string}</span>
                    <div style={{ height: 4, background: C.surface2, borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, load as number)}%`, height: '100%', background: over ? '#F87171' : (load as number) > 80 ? '#FBBF24' : C.accent }} />
                    </div>
                    <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: over ? '#F87171' : C.muted, textAlign: 'end' }}>{load as number}%</span>
                  </div>
                ))}
              </Card>
              <Card span={1} title="توقّع الإيراد" badge="+12%" badgeTone="success">
                <p style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-arabic-display)', color: C.accent }}>
                  ١٨٢K <span style={{ fontSize: 10, color: C.dim }}>SAR</span>
                </p>
                <p style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>متوقّع نهاية الشهر</p>
              </Card>
            </div>
          </section>

          {/* AI Conductor panel */}
          <aside style={{
            background: `linear-gradient(180deg, ${C.accent}12, transparent)`,
            border: `1px solid ${C.accent}25`,
            borderRadius: 12, padding: 16,
            alignSelf: 'start',
          }}>
            <p style={{
              fontSize: 10, color: C.accent, fontWeight: 600,
              letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12,
            }}>Antagna AI · ٣ أولويات</p>
            {AI_PRIORITIES.map((p, i) => (
              <div key={p.p} style={{
                padding: '10px 0',
                borderTop: i ? `1px solid ${C.line}` : 'none',
              }}>
                <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 3 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', color: p.urgent ? C.accent : C.dim, marginInlineEnd: 6 }}>{p.p}</span>
                  {p.text}
                </p>
                <p style={{ fontSize: 10, color: C.muted, marginBottom: 6, paddingInlineStart: 22 }}>↳ {p.insight}</p>
                <div style={{ display: 'flex', gap: 4, paddingInlineStart: 22 }}>
                  <button style={{
                    padding: '3px 8px', borderRadius: 4,
                    background: p.urgent ? C.accent : C.surface2,
                    color: p.urgent ? '#fff' : C.text,
                    border: p.urgent ? 'none' : `1px solid ${C.line}`,
                    fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}>{p.primary}</button>
                </div>
              </div>
            ))}
            <div style={{
              marginTop: 12, padding: 8,
              background: C.surface, borderRadius: 8,
              border: `1px solid ${C.lineStrong}`,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <input
                placeholder="اسأل Claude…"
                style={{ flex: 1, background: 'transparent', border: 'none', color: C.text, fontSize: 11, fontFamily: 'inherit', outline: 'none' }}
              />
              <button style={{
                padding: '3px 8px', borderRadius: 4,
                background: C.gradient, color: '#fff', border: 'none',
                fontSize: 10, cursor: 'pointer', fontFamily: 'inherit',
              }}>↗</button>
            </div>
          </aside>
        </div>
      </main>

      <SideDock />
      <BottomDock />
    </div>
  );
}
