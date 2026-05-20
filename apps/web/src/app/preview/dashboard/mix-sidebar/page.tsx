import {
  MIX as C, TODAY_ITEMS, KIND_ICONS, AI_PRIORITIES,
  MixTopBar, SideDock, BottomDock, Card,
} from '../mix-shared';

export const dynamic = 'force-static';

export default function MixSidebarAI() {
  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'var(--font-arabic), system-ui' }}>
      <style>{`
        .ms-layout { display: grid; grid-template-columns: 380px 1fr; gap: 0; min-height: calc(100vh - 92px); }
        .ms-cards { display: grid; gap: 12px; grid-template-columns: repeat(6, 1fr); }
        .ms-cards > [data-span="6"] { grid-column: span 6; }
        .ms-cards > [data-span="3"] { grid-column: span 3; }
        .ms-cards > [data-span="2"] { grid-column: span 2; }
        @media (max-width: 1100px) {
          .ms-layout { grid-template-columns: 1fr; }
          .ms-ai { position: static !important; height: auto !important; }
          .ms-cards { grid-template-columns: repeat(4, 1fr); }
          .ms-cards > [data-span="6"] { grid-column: span 4; }
          .ms-cards > [data-span="3"] { grid-column: span 2; }
          .ms-cards > [data-span="2"] { grid-column: span 2; }
        }
        @media (max-width: 720px) {
          .ms-cards { grid-template-columns: 1fr; }
          .ms-cards > * { grid-column: span 1 !important; }
          .ms-content { padding: 16px !important; padding-inline-end: 16px !important; }
        }
      `}</style>
      <MixTopBar name="Mix · Sidebar AI" />

      <div className="ms-layout">
        {/* AI CONDUCTOR — sticky left rail */}
        <aside className="ms-ai" style={{
          background: `linear-gradient(180deg, ${C.accent}10, transparent)`,
          borderInlineStart: `1px solid ${C.line}`,
          padding: '24px 20px',
          position: 'sticky', top: 92, height: 'calc(100vh - 92px)',
          overflowY: 'auto',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ marginBottom: 16 }}>
            <span style={{
              fontSize: 10, padding: '3px 10px', borderRadius: 4,
              background: C.accent + '20', color: C.accent,
              fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>Antagna AI</span>
          </div>
          <h1 style={{
            fontSize: 24, fontWeight: 700, lineHeight: 1.25,
            letterSpacing: '-0.018em', marginBottom: 8,
            fontFamily: 'var(--font-arabic-display)',
          }}>
            صباح الخير محمد
          </h1>
          <p style={{ fontSize: 13, color: C.muted, marginBottom: 18 }}>
            ٣ أولويات + ٤ بنود اليوم. ابدأ من فوق.
          </p>

          <ol style={{ listStyle: 'none', padding: 0, margin: 0, flex: 1 }}>
            {AI_PRIORITIES.map((p, i) => (
              <li key={p.p} style={{
                padding: '12px 0',
                borderTop: i ? `1px solid ${C.line}` : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
                    color: p.urgent ? C.accent : C.dim,
                  }}>{p.p}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{p.text}</span>
                </div>
                <p style={{ fontSize: 11, color: C.muted, marginBottom: 8, paddingInlineStart: 22 }}>
                  ↳ {p.insight}
                </p>
                <div style={{ display: 'flex', gap: 6, paddingInlineStart: 22 }}>
                  <button style={{
                    padding: '4px 10px', borderRadius: 5,
                    background: p.urgent ? C.accent : C.surface2,
                    color: p.urgent ? '#fff' : C.text,
                    border: p.urgent ? 'none' : `1px solid ${C.line}`,
                    fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}>{p.primary}</button>
                  <button style={{
                    padding: '4px 10px', borderRadius: 5,
                    background: 'transparent', border: `1px solid ${C.line}`,
                    color: C.muted, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                  }}>{p.secondary}</button>
                </div>
              </li>
            ))}
          </ol>

          {/* Always-visible ask input at the bottom */}
          <div style={{
            marginTop: 16, padding: 10,
            background: C.surface, borderRadius: 10,
            border: `1px solid ${C.lineStrong}`,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <input
              placeholder="اسأل Claude أي حاجة…"
              style={{
                flex: 1, background: 'transparent', border: 'none',
                color: C.text, fontSize: 12, fontFamily: 'inherit', outline: 'none',
              }}
            />
            <button style={{
              padding: '5px 10px', borderRadius: 6,
              background: C.gradient, color: '#fff', border: 'none',
              fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>↗</button>
          </div>
        </aside>

        {/* CONTENT — Today + Cards */}
        <div className="ms-content" style={{ padding: '24px 28px', paddingInlineEnd: 100, overflow: 'hidden' }}>
          {/* Today strip — compact horizontal */}
          <section style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.018em', fontFamily: 'var(--font-arabic-display)' }}>اليوم</h2>
              <span style={{ fontSize: 10, color: C.dim }}>الأربعاء، ٢١ مايو</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
              {TODAY_ITEMS.map((item) => {
                const k = KIND_ICONS[item.kind] ?? KIND_ICONS.deliver!;
                return (
                  <div key={item.time + item.what} style={{
                    background: C.surface,
                    border: `1px solid ${item.urgent ? C.accent + '40' : C.line}`,
                    borderRadius: 10, padding: 10,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{
                        width: 22, height: 22, borderRadius: 5,
                        background: k.color + '20', color: k.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
                      }}>{k.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)', color: item.urgent ? C.accent : C.text }}>{item.time}</span>
                    </div>
                    <p style={{ fontSize: 12, fontWeight: 500 }}>{item.what}</p>
                    <p style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>{item.who}</p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Cards Grid — 6-col */}
          <section>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.018em', fontFamily: 'var(--font-arabic-display)' }}>اللوحة</h2>
              <span style={{ fontSize: 10, color: C.dim }}>٨ كروت قابلة للتخصيص</span>
              <button style={{
                marginInlineStart: 'auto',
                padding: '4px 10px', borderRadius: 5,
                background: C.surface, border: `1px solid ${C.line}`,
                color: C.text, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit',
              }}>تخصيص</button>
            </div>
            <div className="ms-cards">
              <Card span={3} title="مشاريع في خطر" badge="3" badgeTone="danger">
                {[['PR-0007', 'متوقف ٥ أيام', 'red'], ['PR-0010', 'وقت ضيق', 'red'], ['PR-0009', 'موافقة معلّقة', 'amber']].map(([code, r, risk]) => (
                  <div key={code} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderTop: `1px solid ${C.line}`, fontSize: 11 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: risk === 'red' ? '#F87171' : '#FBBF24' }} />
                    <span style={{ fontFamily: 'var(--font-mono)', color: C.muted }}>{code}</span>
                    <span style={{ flex: 1 }}>{r}</span>
                  </div>
                ))}
              </Card>
              <Card span={3} title="قائمة الموافقات" badge="5">
                {[['PR-0009 V3', '2h'], ['PR-0010 V1', '5h'], ['PR-0005 V2', '1d']].map(([item, w]) => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderTop: `1px solid ${C.line}`, fontSize: 11 }}>
                    <span style={{ flex: 1, fontWeight: 500 }}>{item}</span>
                    <span style={{ color: C.dim, fontSize: 10 }}>{w}</span>
                    <button style={{ padding: '2px 8px', borderRadius: 4, background: C.accent, color: '#fff', border: 'none', fontSize: 9, fontFamily: 'inherit', cursor: 'pointer' }}>راجع</button>
                  </div>
                ))}
              </Card>
              <Card span={6} title="حمولة الفريق" badge="١ عبء زائد" badgeTone="warning">
                {[['محمد المالكي', 90, false], ['Khaled', 70, false], ['Mohsen', 50, false], ['Kabsy', 110, true]].map(([name, load, over]) => (
                  <div key={name as string} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 40px', gap: 8, alignItems: 'center', padding: '3px 0' }}>
                    <span style={{ fontSize: 11 }}>{name}</span>
                    <div style={{ height: 5, background: C.surface2, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, load as number)}%`, height: '100%', background: over ? '#F87171' : (load as number) > 80 ? '#FBBF24' : C.accent }} />
                    </div>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: over ? '#F87171' : C.muted, textAlign: 'end' }}>{load as number}%</span>
                  </div>
                ))}
              </Card>
              <Card span={2}><MiniStat label="Leads باردة" value={5} sub="٥+ أيام" tone="warning" /></Card>
              <Card span={2}><MiniStat label="تسليمات الأسبوع" value={3} /></Card>
              <Card span={2}><MiniStat label="دفعات متأخرة" value="٢١K" tone="danger" /></Card>
              <Card span={3} title="توقّع الإيراد" badge="+12%" badgeTone="success">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 2, height: 36, alignItems: 'end' }}>
                  {[40, 55, 38, 62, 70, 58, 75, 82, 65, 88, 92, 78].map((h, i) => (
                    <div key={i} style={{ height: `${h}%`, background: i > 7 ? C.accent : C.muted, borderRadius: '2px 2px 0 0', opacity: i > 7 ? 1 : 0.35 }} />
                  ))}
                </div>
                <p style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-arabic-display)', color: C.accent, marginTop: 6 }}>
                  ١٨٢K <span style={{ fontSize: 10, color: C.dim }}>SAR متوقّع</span>
                </p>
              </Card>
              <Card span={3} title="تعارضات معدات" badge="2" badgeTone="warning">
                <div style={{ fontSize: 11 }}>
                  <p style={{ marginBottom: 4 }}>Sony FX3 <span style={{ color: '#FBBF24', marginInlineStart: 4 }}>الأربعاء</span></p>
                  <p style={{ color: C.muted, fontSize: 10 }}>PR-0009 + PR-0007</p>
                  <p style={{ marginTop: 8 }}>DJI Ronin <span style={{ color: '#FBBF24', marginInlineStart: 4 }}>الجمعة</span></p>
                </div>
              </Card>
            </div>
          </section>
        </div>
      </div>

      <SideDock />
      <BottomDock />
    </div>
  );
}

function MiniStat({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: 'warning' | 'danger' }) {
  const color = tone === 'warning' ? '#FBBF24' : tone === 'danger' ? '#F87171' : C.text;
  return (
    <>
      <p style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 700, color, letterSpacing: '-0.02em', lineHeight: 1, fontFamily: 'var(--font-arabic-display)' }}>{value}</p>
      {sub && <p style={{ fontSize: 9, color: C.dim, marginTop: 3 }}>{sub}</p>}
    </>
  );
}
