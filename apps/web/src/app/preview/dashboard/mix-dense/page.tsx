import {
  MIX as C, TODAY_ITEMS, KIND_ICONS, AI_PRIORITIES,
  MixTopBar, SideDock, BottomDock,
} from '../mix-shared';

export const dynamic = 'force-static';

export default function MixDense() {
  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'var(--font-arabic), system-ui', fontSize: 12 }}>
      <style>{`
        .md-grid {
          display: grid;
          grid-template-columns: 280px 320px 1fr;
          gap: 10px;
          padding: 14px 16px;
          padding-inline-end: 100px;
        }
        .md-col {
          background: var(--surface, ${C.surface});
          border: 1px solid ${C.line};
          border-radius: 10px;
          padding: 12px;
        }
        .md-row {
          padding: 6px 0;
          border-top: 1px solid ${C.line};
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
        }
        .md-row:first-child { border-top: 0; }
        .md-cards-tight {
          display: grid;
          gap: 8px;
          grid-template-columns: repeat(2, 1fr);
        }
        @media (max-width: 1100px) {
          .md-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 720px) {
          .md-grid { padding: 12px !important; padding-inline-end: 12px !important; }
          .md-cards-tight { grid-template-columns: 1fr; }
        }
      `}</style>
      <MixTopBar name="Mix · Dense (power user)" />

      {/* Compact top bar — alerts band */}
      <div style={{
        background: C.surface,
        borderBottom: `1px solid ${C.line}`,
        padding: '8px 16px',
        display: 'flex', alignItems: 'center', gap: 14,
        fontSize: 11,
      }}>
        <span style={{ color: C.muted }}>صباح الخير محمد · الأربعاء، ٢١ مايو · 11:30</span>
        <span style={{ color: C.dim }}>·</span>
        <span style={{ color: '#F87171', fontWeight: 600 }}>● ٢ urgent</span>
        <span style={{ color: C.dim }}>·</span>
        <span style={{ color: '#FBBF24' }}>● ٣ في خطر</span>
        <span style={{ color: C.dim }}>·</span>
        <span style={{ color: C.muted }}>● ٤ بنود اليوم</span>
        <span style={{ marginInlineStart: 'auto', color: C.dim, fontFamily: 'var(--font-mono)' }}>
          MTD: 145K · forecast 182K
        </span>
      </div>

      <div className="md-grid">
        {/* COL 1 — TODAY */}
        <div className="md-col">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
            <h2 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: C.muted }}>اليوم</h2>
            <span style={{ fontSize: 10, color: C.dim, fontFamily: 'var(--font-mono)' }}>4</span>
          </div>
          {TODAY_ITEMS.map((item) => {
            const k = KIND_ICONS[item.kind] ?? KIND_ICONS.deliver!;
            return (
              <div key={item.time + item.what} className="md-row">
                <span style={{
                  width: 18, height: 18, borderRadius: 4,
                  background: k.color + '25', color: k.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10,
                  flexShrink: 0,
                }}>{k.icon}</span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10,
                  color: item.urgent ? C.accent : C.muted,
                  fontWeight: item.urgent ? 600 : 400,
                  width: 40, flexShrink: 0,
                }}>{item.time}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 11, fontWeight: 500 }}>{item.what}</p>
                  <p style={{ fontSize: 9, color: C.dim }}>{item.who}</p>
                </div>
                {item.urgent && (
                  <span style={{
                    width: 4, height: 4, borderRadius: '50%', background: C.accent, flexShrink: 0,
                  }} />
                )}
              </div>
            );
          })}

          {/* This week sub-section */}
          <h2 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: C.muted, marginTop: 16, marginBottom: 8 }}>
            هذا الأسبوع
          </h2>
          {[
            ['الخميس', '14:00', 'تصوير ALFTM', 'shoot'],
            ['الجمعة', '11:00', 'تصوير MTN', 'shoot'],
            ['الجمعة', '—', 'تسليم PR-0010', 'deliver'],
          ].map(([d, t, w]) => (
            <div key={(d ?? '') + (t ?? '')} className="md-row">
              <span style={{ fontSize: 10, color: C.muted, width: 40, flexShrink: 0 }}>{d}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: C.dim, width: 40, flexShrink: 0 }}>{t}</span>
              <span style={{ flex: 1, fontSize: 11 }}>{w}</span>
            </div>
          ))}
        </div>

        {/* COL 2 — AI PRIORITIES */}
        <div className="md-col" style={{ background: `linear-gradient(180deg, ${C.accent}10, ${C.surface})` }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
            <h2 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: C.accent }}>
              AI · أولويات
            </h2>
            <span style={{ fontSize: 10, color: C.dim }}>محدّث منذ دقيقة</span>
          </div>
          {AI_PRIORITIES.map((p, i) => (
            <div key={p.p} style={{
              padding: '8px 0',
              borderTop: i ? `1px solid ${C.line}` : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 3 }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                  color: p.urgent ? C.accent : C.dim,
                }}>{p.p}</span>
                <span style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.4 }}>{p.text}</span>
              </div>
              <p style={{ fontSize: 10, color: C.muted, marginBottom: 5, paddingInlineStart: 18, lineHeight: 1.4 }}>
                {p.insight}
              </p>
              <div style={{ display: 'flex', gap: 4, paddingInlineStart: 18 }}>
                <button style={{
                  padding: '2px 8px', borderRadius: 4,
                  background: p.urgent ? C.accent : 'transparent',
                  color: p.urgent ? '#fff' : C.accent,
                  border: p.urgent ? 'none' : `1px solid ${C.accent}40`,
                  fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}>{p.primary}</button>
              </div>
            </div>
          ))}

          {/* Ask */}
          <div style={{
            marginTop: 10, padding: 6,
            background: C.surface, borderRadius: 6,
            border: `1px solid ${C.line}`,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <input
              placeholder="اسأل Claude…"
              style={{ flex: 1, background: 'transparent', border: 'none', color: C.text, fontSize: 11, fontFamily: 'inherit', outline: 'none' }}
            />
            <button style={{ background: 'transparent', color: C.accent, border: 'none', cursor: 'pointer', fontSize: 12 }}>↗</button>
          </div>
        </div>

        {/* COL 3 — DENSE CARDS */}
        <div className="md-cards-tight">
          {/* Risk */}
          <div className="md-col">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
              <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#F87171' }}>
                في خطر
              </h3>
              <span style={{ fontSize: 10, color: '#F87171', fontFamily: 'var(--font-mono)' }}>3</span>
            </div>
            {[['PR-0007', 'متوقف ٥ أيام'], ['PR-0010', 'وقت ضيق'], ['PR-0009', 'موافقة معلّقة']].map(([code, r]) => (
              <div key={code} style={{ display: 'flex', gap: 6, padding: '4px 0', fontSize: 11, borderTop: `1px solid ${C.line}` }}>
                <span style={{ fontFamily: 'var(--font-mono)', color: C.muted }}>{code}</span>
                <span style={{ flex: 1 }}>{r}</span>
              </div>
            ))}
          </div>

          {/* Approval */}
          <div className="md-col">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
              <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: C.muted }}>
                موافقات
              </h3>
              <span style={{ fontSize: 10, color: C.dim, fontFamily: 'var(--font-mono)' }}>5</span>
            </div>
            {[['PR-0009 V3', '2h'], ['PR-0010 V1', '5h'], ['PR-0005 V2', '1d']].map(([item, w]) => (
              <div key={item} style={{ display: 'flex', gap: 6, padding: '4px 0', fontSize: 11, borderTop: `1px solid ${C.line}` }}>
                <span style={{ flex: 1, fontWeight: 500 }}>{item}</span>
                <span style={{ color: C.dim, fontSize: 10 }}>{w}</span>
              </div>
            ))}
          </div>

          {/* Conflicts */}
          <div className="md-col">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
              <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#FBBF24' }}>
                تعارضات
              </h3>
              <span style={{ fontSize: 10, color: '#FBBF24', fontFamily: 'var(--font-mono)' }}>2</span>
            </div>
            {[['Sony FX3', 'الأربعاء', 'PR-0009 + PR-0007'], ['DJI Ronin', 'الجمعة', 'PR-0010 + PR-0006']].map(([eq, d, conf]) => (
              <div key={eq} style={{ padding: '4px 0', fontSize: 11, borderTop: `1px solid ${C.line}` }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <span style={{ flex: 1, fontWeight: 500 }}>{eq}</span>
                  <span style={{ color: '#FBBF24', fontSize: 9 }}>{d}</span>
                </div>
                <p style={{ fontSize: 9, color: C.dim }}>{conf}</p>
              </div>
            ))}
          </div>

          {/* Team */}
          <div className="md-col">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
              <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: C.muted }}>
                الفريق
              </h3>
              <span style={{ fontSize: 10, color: '#F87171', fontFamily: 'var(--font-mono)' }}>١ over</span>
            </div>
            {[['Kabsy', 110, true], ['محمد المالكي', 90, false], ['Khaled', 70, false], ['Mohsen', 50, false]].map(([n, l, over]) => (
              <div key={n as string} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 28px', gap: 5, alignItems: 'center', padding: '3px 0', fontSize: 10 }}>
                <span>{n as string}</span>
                <div style={{ height: 4, background: C.surface2, borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, l as number)}%`, height: '100%', background: over ? '#F87171' : (l as number) > 80 ? '#FBBF24' : C.accent }} />
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', color: over ? '#F87171' : C.muted, textAlign: 'end' }}>{l as number}%</span>
              </div>
            ))}
          </div>

          {/* Revenue + KPIs combined */}
          <div className="md-col" style={{ gridColumn: 'span 2' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 6 }}>
              <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: C.muted }}>
                إيراد + KPIs
              </h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
              {[
                ['MTD', '١٤٥K', C.text],
                ['Forecast', '١٨٢K', C.accent],
                ['Leads باردة', '5', '#FBBF24'],
                ['تسليم الأسبوع', '3', C.text],
                ['دفعات متأخرة', '٢١K', '#F87171'],
              ].map(([l, v, c]) => (
                <div key={l as string}>
                  <p style={{ fontSize: 9, color: C.muted, marginBottom: 3 }}>{l as string}</p>
                  <p style={{
                    fontSize: 20, fontWeight: 700,
                    color: c as string,
                    letterSpacing: '-0.018em', lineHeight: 1,
                    fontFamily: 'var(--font-arabic-display)',
                  }}>{v as string}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <SideDock />
      <BottomDock />
    </div>
  );
}
