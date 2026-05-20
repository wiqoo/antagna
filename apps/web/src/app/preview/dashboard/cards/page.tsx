import Link from 'next/link';
import { FRAME_COLORS as C } from '../../frame-shared';

export const dynamic = 'force-static';

export default function CardsGridDashboard() {
  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'var(--font-arabic), system-ui' }}>
      <style>{`
        .cards-grid { display: grid; gap: 14px; grid-template-columns: repeat(12, 1fr); }
        @media (max-width: 1100px) {
          /* Tablet: collapse to 6-col grid */
          .cards-grid { grid-template-columns: repeat(6, 1fr); }
          .cards-grid > [data-span="8"], .cards-grid > [data-span="6"] { grid-column: span 6 !important; }
          .cards-grid > [data-span="4"] { grid-column: span 3 !important; }
          .cards-grid > [data-span="3"] { grid-column: span 3 !important; }
        }
        @media (max-width: 720px) {
          /* Mobile: stack everything full-width */
          .cards-grid { grid-template-columns: 1fr; }
          .cards-grid > * { grid-column: span 1 !important; }
          .cards-main { padding: 20px 14px !important; padding-inline-end: 14px !important; }
        }
      `}</style>
      <TopBar />

      <main className="cards-main" style={{ padding: '28px 36px', maxWidth: 1400, margin: '0 auto', paddingInlineEnd: 100 }}>
        {/* Hero */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 11, color: C.muted, marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            صباح الخير · الأربعاء، ٢١ مايو
          </p>
          <h1 style={{
            fontSize: 36, fontWeight: 700, letterSpacing: '-0.02em',
            fontFamily: 'var(--font-arabic-display)',
            marginBottom: 8,
          }}>
            لوحة محمد
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <p style={{ fontSize: 13, color: C.muted }}>
              ١٢ كرت ذكي · مرتّب على {`{`}capacity, risk, today{`}`}
            </p>
            <button style={{
              padding: '5px 12px', borderRadius: 6,
              background: C.surface, border: `1px solid ${C.line}`,
              color: C.text, fontSize: 11, cursor: 'pointer',
              fontFamily: 'inherit',
            }}>+ أضف كرت</button>
            <button style={{
              padding: '5px 12px', borderRadius: 6,
              background: 'transparent', border: `1px solid ${C.line}`,
              color: C.muted, fontSize: 11, cursor: 'pointer',
              fontFamily: 'inherit',
            }}>تخصيص</button>
          </div>
        </div>

        {/* Cards Grid — 12 col masonry (responsive: 12 → 6 → 1) */}
        <div className="cards-grid">
          {/* ROW 1 — AI Briefing (8 col) + Today Stats (4 col) */}
          <Card span={8} title="ملخص اليوم · AI" eyebrow="LIVE" accent>
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.3, marginBottom: 6 }}>
                يوم مزدحم — اولوياتك الـ٣
              </p>
              <p style={{ fontSize: 13, color: C.muted }}>
                Claude لخّص أنشطة آخر ٢٤ ساعة و رتّب الـ٣ بنود اللي تحتاج عليك قرار.
              </p>
            </div>
            {[
              { p: '01', text: 'PR-0007 متوقف ٥ أيام في brief', action: 'كلّم MTN النهارده', urgent: true },
              { p: '02', text: 'PR-0010 تسليم بعد ٣ أيام، ٦٠% فقط', action: 'وزّع المهام على Khaled' },
              { p: '03', text: 'Lead من WPP بارد منذ ٦ أيام', action: 'ابعت follow-up' },
            ].map((b) => (
              <div key={b.p} style={{
                display: 'grid', gridTemplateColumns: '40px 1fr auto',
                gap: 12, padding: '10px 0',
                borderTop: `1px solid ${C.line}`, alignItems: 'center',
              }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 600,
                  color: b.urgent ? C.accent : C.dim,
                }}>{b.p}</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500 }}>{b.text}</p>
                  <p style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>↳ {b.action}</p>
                </div>
                <button style={{
                  padding: '6px 12px', borderRadius: 6,
                  background: b.urgent ? C.accent : C.surface2,
                  color: b.urgent ? '#fff' : C.text,
                  border: 'none', fontSize: 11, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>تنفيذ</button>
              </div>
            ))}
          </Card>

          <Card span={4} title="إجراء اليوم">
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ fontSize: 72, fontWeight: 700, color: C.accent, letterSpacing: '-0.03em', lineHeight: 1, fontFamily: 'var(--font-arabic-display)' }}>
                7
              </p>
              <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
                بنود تحتاج قرارك
              </p>
              <p style={{ fontSize: 11, color: C.dim, marginTop: 12, fontFamily: 'var(--font-mono)' }}>
                3 موافقات · 2 تسليم · 2 حجز
              </p>
            </div>
          </Card>

          {/* ROW 2 — At Risk (4) + Approval Queue (4) + Conflicts (4) */}
          <Card span={4} title="مشاريع في خطر" badge="3" badgeTone="danger">
            {[
              { code: 'PR-0007', reason: 'متوقف ٥ أيام', risk: 'red' },
              { code: 'PR-0010', reason: 'وقت ضيق', risk: 'red' },
              { code: 'PR-0009', reason: 'موافقة معلّقة', risk: 'amber' },
            ].map((p) => (
              <div key={p.code} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 0', borderTop: `1px solid ${C.line}`,
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: p.risk === 'red' ? '#F87171' : '#FBBF24',
                }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: C.muted }}>{p.code}</span>
                <span style={{ flex: 1, fontSize: 12 }}>{p.reason}</span>
                <span style={{ fontSize: 10, color: C.dim }}>←</span>
              </div>
            ))}
          </Card>

          <Card span={4} title="قائمة الموافقات" badge="5">
            {[
              { item: 'PR-0009 V3', from: 'Khaled', waiting: '2h' },
              { item: 'PR-0010 V1', from: 'Mohsen', waiting: '5h' },
              { item: 'PR-0005 V2', from: 'Hamada', waiting: '1d' },
            ].map((a, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 0', borderTop: `1px solid ${C.line}`,
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: C.surface2, color: C.text,
                  fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{a.from[0]}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 500 }}>{a.item}</p>
                  <p style={{ fontSize: 10, color: C.dim }}>{a.from} · منذ {a.waiting}</p>
                </div>
                <button style={{
                  padding: '4px 10px', borderRadius: 4,
                  background: C.accent, color: '#fff',
                  border: 'none', fontSize: 10, fontFamily: 'inherit', cursor: 'pointer',
                }}>راجع</button>
              </div>
            ))}
          </Card>

          <Card span={4} title="تعارضات معدات" badge="2" badgeTone="warning">
            {[
              { eq: 'Sony FX3', date: 'الأربعاء', conflict: 'PR-0009 + PR-0007' },
              { eq: 'DJI Ronin', date: 'الجمعة', conflict: 'PR-0010 + PR-0006' },
            ].map((c, i) => (
              <div key={i} style={{ padding: '10px 0', borderTop: `1px solid ${C.line}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{c.eq}</span>
                  <span style={{ fontSize: 10, color: '#FBBF24', marginInlineStart: 'auto' }}>{c.date}</span>
                </div>
                <p style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{c.conflict}</p>
                <p style={{ fontSize: 10, color: C.accent, marginTop: 4, cursor: 'pointer' }}>← حلّ التعارض</p>
              </div>
            ))}
          </Card>

          {/* ROW 3 — Team Capacity (6) + Revenue (6) */}
          <Card span={6} title="حمولة الفريق · ٧ أيام" badge="3 مشاريع نشطة">
            <div style={{ display: 'grid', gap: 6 }}>
              {[
                { name: 'محمد المالكي', load: 90, projects: 3 },
                { name: 'Khaled', load: 70, projects: 2 },
                { name: 'Mohsen', load: 50, projects: 2 },
                { name: 'Hamada', load: 30, projects: 1 },
                { name: 'Kabsy', load: 110, projects: 4, over: true },
              ].map((p) => (
                <div key={p.name} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 40px', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11 }}>{p.name}</span>
                  <div style={{ height: 8, background: C.surface2, borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                    <div style={{
                      width: `${Math.min(100, p.load)}%`, height: '100%',
                      background: p.over ? '#F87171' : p.load > 80 ? '#FBBF24' : C.accent,
                    }} />
                  </div>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: p.over ? '#F87171' : C.muted, textAlign: 'end' }}>
                    {p.load}%
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card span={6} title="توقّع الإيراد · ٣٠ يوم" badge="+12% MoM" badgeTone="success">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 4, height: 80, alignItems: 'end' }}>
              {[40, 55, 38, 62, 70, 58, 75, 82, 65, 88, 92, 78].map((h, i) => (
                <div key={i} style={{
                  height: `${h}%`,
                  background: i > 7 ? C.accent : C.muted,
                  borderRadius: '3px 3px 0 0',
                  opacity: i > 7 ? 1 : 0.4,
                }} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
              <div>
                <p style={{ fontSize: 10, color: C.muted }}>متوقّع نهاية الشهر</p>
                <p style={{ fontSize: 20, fontWeight: 600, fontFamily: 'var(--font-mono)', color: C.accent }}>
                  ١٨٢K <span style={{ fontSize: 10, color: C.dim }}>SAR</span>
                </p>
              </div>
              <div>
                <p style={{ fontSize: 10, color: C.muted }}>محصّل حتى الآن</p>
                <p style={{ fontSize: 20, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  ١٤٥K
                </p>
              </div>
            </div>
          </Card>

          {/* ROW 4 — Quick stats row */}
          <Card span={3}><MiniStat label="Leads باردة" value={5} sub="منذ ٥+ أيام" tone="warning" /></Card>
          <Card span={3}><MiniStat label="تسليمات هذا الأسبوع" value={3} sub="١ منهم متأخر" /></Card>
          <Card span={3}><MiniStat label="معدات في الصيانة" value={2} sub="مدّة متوسطة ٣ أيام" /></Card>
          <Card span={3}><MiniStat label="مدفوعات متأخرة" value="٢١K" sub="٤ فواتير" tone="danger" /></Card>

          {/* ROW 5 — Add card hint */}
          <div style={{
            gridColumn: 'span 12',
            padding: 24, textAlign: 'center',
            border: `1px dashed ${C.line}`, borderRadius: 12,
            color: C.muted, fontSize: 12,
            cursor: 'pointer',
          }}>
            + أضف كرت آخر · 12 كرت متاح في الـ catalog
          </div>
        </div>
      </main>

      {/* Side dock (mirrored from previous preview) */}
      <SideDock />
    </div>
  );
}

function Card({
  span, title, eyebrow, badge, badgeTone, accent, children,
}: {
  span: number;
  title?: string;
  eyebrow?: string;
  badge?: string;
  badgeTone?: 'success' | 'warning' | 'danger';
  accent?: boolean;
  children: React.ReactNode;
}) {
  const badgeColor = badgeTone === 'success' ? '#34D399' :
                     badgeTone === 'warning' ? '#FBBF24' :
                     badgeTone === 'danger' ? '#F87171' : C.muted;
  return (
    <div data-span={span} style={{
      gridColumn: `span ${span}`,
      background: accent ? `linear-gradient(135deg, ${C.accent}08, transparent)` : C.surface,
      border: `1px solid ${accent ? C.accent + '25' : C.line}`,
      borderRadius: 12,
      padding: 18,
      position: 'relative',
    }}>
      {(title || eyebrow || badge) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          {eyebrow && (
            <span style={{
              fontSize: 9, padding: '2px 6px', borderRadius: 3,
              background: C.accent + '20', color: C.accent,
              fontWeight: 600, letterSpacing: '0.04em',
            }}>{eyebrow}</span>
          )}
          {title && <h3 style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{title}</h3>}
          {badge && (
            <span style={{
              marginInlineStart: 'auto',
              fontSize: 11, padding: '2px 8px', borderRadius: 4,
              background: badgeColor + '20', color: badgeColor,
              fontWeight: 500,
            }}>{badge}</span>
          )}
          <span style={{ fontSize: 12, color: C.dim, cursor: 'grab', marginInlineStart: title ? 0 : 'auto' }}>⋮⋮</span>
        </div>
      )}
      {children}
    </div>
  );
}

function MiniStat({ label, value, sub, tone }: { label: string; value: string | number; sub: string; tone?: 'warning' | 'danger' }) {
  const color = tone === 'warning' ? '#FBBF24' : tone === 'danger' ? '#F87171' : C.text;
  return (
    <>
      <p style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 28, fontWeight: 700, color, letterSpacing: '-0.02em', lineHeight: 1, fontFamily: 'var(--font-arabic-display)' }}>{value}</p>
      <p style={{ fontSize: 10, color: C.dim, marginTop: 6 }}>{sub}</p>
    </>
  );
}

function TopBar() {
  return (
    <>
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: C.surface, borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '8px 16px', fontSize: 11,
        display: 'flex', alignItems: 'center', gap: 12, color: C.text,
      }}>
        <Link href="/preview/dashboard" style={{ color: 'inherit', textDecoration: 'none' }}>← Dashboard concepts</Link>
        <span style={{ opacity: 0.4 }}>·</span>
        <span style={{ fontWeight: 500 }}>Cards Grid · Customizable</span>
      </div>
      <div style={{
        background: C.bg, borderBottom: `1px solid ${C.line}`,
        padding: '0 24px', height: 52,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 28, height: 28, borderRadius: 6, background: C.gradient,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 12, color: '#fff',
          }}>A</span>
          <span style={{ fontWeight: 600, fontSize: 16 }}>Antagna</span>
        </div>
        <div style={{
          flex: 1, maxWidth: 400, padding: '5px 12px', marginInlineStart: 32,
          border: `1px solid ${C.line}`, borderRadius: 8,
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 12, color: C.dim, background: C.surface,
        }}>
          <span>ابحث…</span>
          <span style={{ marginInlineStart: 'auto', fontSize: 10, fontFamily: 'var(--font-mono)' }}>⌘K</span>
        </div>
        <div style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button style={{
            background: C.gradient, color: '#fff', border: 'none',
            borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
          }}>+ مشروع</button>
          <div style={{
            width: 30, height: 30, borderRadius: '50%', background: '#34D399', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 600,
          }}>M</div>
        </div>
      </div>
    </>
  );
}

function SideDock() {
  const ITEMS = [
    { icon: '◇', label: 'الرئيسية', active: true },
    { icon: '▢', label: 'المشاريع', badge: '12' },
    { icon: '✓', label: 'المهام', badge: '8' },
    { icon: '✉', label: 'الوارد', badge: '3' },
    { icon: '▦', label: 'التقويم' },
    { icon: '☰', label: 'المزيد' },
  ];
  return (
    <div className="hidden md:flex" style={{
      position: 'fixed',
      insetInlineEnd: 24, top: '50%',
      transform: 'translateY(-50%)',
      zIndex: 50,
      flexDirection: 'column',
      background: C.surface,
      borderRadius: 16, padding: 6,
      border: `1px solid ${C.lineStrong}`,
      boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5)',
      gap: 4,
    }}>
      {ITEMS.map((i) => (
        <a key={i.label} href="#" style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          padding: '10px 12px', borderRadius: 12,
          color: i.active ? C.text : C.muted,
          background: i.active ? C.accent + '15' : 'transparent',
          textDecoration: 'none', minWidth: 56, position: 'relative',
        }}>
          <span style={{ fontSize: 16, color: i.active ? C.accent : C.dim, position: 'relative' }}>
            {i.icon}
            {i.badge && (
              <span style={{
                position: 'absolute', top: -4, insetInlineEnd: -8,
                minWidth: 14, height: 14, padding: '0 4px',
                background: C.accent, color: '#fff', borderRadius: 7,
                fontSize: 9, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-mono)',
              }}>{i.badge}</span>
            )}
          </span>
          <span style={{ fontSize: 9 }}>{i.label}</span>
        </a>
      ))}
    </div>
  );
}
