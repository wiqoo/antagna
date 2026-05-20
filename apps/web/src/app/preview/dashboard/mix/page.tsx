import Link from 'next/link';
import { FRAME_COLORS as C } from '../../frame-shared';

export const dynamic = 'force-static';

const TODAY_ITEMS = [
  { time: '09:00', what: 'تصوير HRMNY', who: 'جدة · ٧ طاقم', kind: 'shoot', urgent: false, code: 'PR-0009' },
  { time: '14:00', what: 'وافق على V3', who: 'PR-0009', kind: 'approve', urgent: true, code: 'PR-0009' },
  { time: '16:00', what: 'مكالمة مع MTN', who: 'PR-0007 متوقف', kind: 'call', urgent: true, code: 'PR-0007' },
  { time: '17:30', what: 'follow-up leads باردة', who: '٣ عملاء', kind: 'send', urgent: false },
];

const KIND_ICONS: Record<string, { icon: string; color: string }> = {
  shoot: { icon: '◰', color: '#FBBF24' },
  approve: { icon: '✓', color: '#34D399' },
  call: { icon: '☎', color: '#60A5FA' },
  send: { icon: '✉', color: '#A78BFA' },
  deliver: { icon: '◇', color: C.accent },
};

const AI_PRIORITIES = [
  {
    p: '01',
    text: 'PR-0007 متوقف ٥ أيام في brief',
    insight: 'العميل MTN ما ردش على إيميل البرِيف، الـ shoot بعد ٥ أيام.',
    primary: 'ابعت reminder',
    secondary: 'افتح المشروع',
    urgent: true,
  },
  {
    p: '02',
    text: 'PR-0010 تسليم خلال ٣ أيام، ٦٠٪ فقط',
    insight: 'Khaled على ١٤٠٪ load. اقترح: حوّل color + sound لـ Mohsen (٥٠٪ load).',
    primary: 'نفّذ التحويل',
    secondary: 'وريني المهام',
    urgent: true,
  },
  {
    p: '03',
    text: 'فرصة من WPP بـ ٨٠K — حرارة ٧٨/١٠٠',
    insight: 'تاريخ WPP قوي (٣ مشاريع، متوسط ٧٥K). proposal سريع موصى به.',
    primary: 'أنشئ proposal',
    secondary: 'افتح الـ lead',
    urgent: false,
  },
];

export default function MixDashboard() {
  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'var(--font-arabic), system-ui' }}>
      <style>{`
        .cards-grid { display: grid; gap: 14px; grid-template-columns: repeat(12, 1fr); }
        @media (max-width: 1100px) {
          .cards-grid { grid-template-columns: repeat(6, 1fr); }
          .cards-grid > [data-span="8"], .cards-grid > [data-span="6"] { grid-column: span 6 !important; }
          .cards-grid > [data-span="4"], .cards-grid > [data-span="3"] { grid-column: span 3 !important; }
        }
        @media (max-width: 720px) {
          .cards-grid { grid-template-columns: 1fr; }
          .cards-grid > * { grid-column: span 1 !important; }
          .mix-main { padding: 16px 12px !important; padding-inline-end: 12px !important; }
          .today-strip { grid-template-columns: 1fr !important; }
          .ai-actions { flex-direction: column !important; align-items: stretch !important; }
          .ai-actions > button { width: 100% !important; }
        }
      `}</style>

      {/* Preview top bar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: C.surface, borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '8px 16px', fontSize: 11,
        display: 'flex', alignItems: 'center', gap: 12, color: C.text,
      }}>
        <Link href="/preview/dashboard" style={{ color: 'inherit', textDecoration: 'none' }}>← Dashboard concepts</Link>
        <span style={{ opacity: 0.4 }}>·</span>
        <span style={{ fontWeight: 600 }}>Mix · Conductor + Critical Path + Cards</span>
      </div>

      {/* App top bar */}
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

      <main className="mix-main" style={{ padding: '28px 36px', maxWidth: 1400, margin: '0 auto', paddingInlineEnd: 100 }}>
        {/* ════ HERO: AI Conductor ════════════════════════════════════════ */}
        <section style={{
          background: `linear-gradient(135deg, ${C.accent}12, transparent 60%)`,
          border: `1px solid ${C.accent}25`,
          borderRadius: 16,
          padding: 24,
          marginBottom: 18,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
            <span style={{
              fontSize: 10, padding: '3px 10px', borderRadius: 4,
              background: C.accent + '20', color: C.accent, fontWeight: 600,
              letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>Antagna AI · Conductor</span>
            <span style={{ fontSize: 11, color: C.dim }}>محدّث منذ دقيقة</span>
          </div>
          <h1 style={{
            fontSize: 32, fontWeight: 700, lineHeight: 1.2,
            letterSpacing: '-0.018em', marginBottom: 8,
            fontFamily: 'var(--font-arabic-display)',
          }}>
            صباح الخير محمد — <span style={{
              background: C.gradient,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>٣ أولويات تستحق وقتك</span>
          </h1>
          <p style={{ fontSize: 14, color: C.muted, marginBottom: 18 }}>
            راجعت كل أنشطة Volt من ١٤ ساعة. أنا اقترح ترتيب القرارات كده.
          </p>

          {/* Priority list */}
          <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {AI_PRIORITIES.map((p, i) => (
              <li key={p.p} style={{
                display: 'grid', gridTemplateColumns: '36px 1fr',
                gap: 14, padding: '14px 0',
                borderTop: i ? `1px solid ${C.line}` : 'none',
              }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700,
                  color: p.urgent ? C.accent : C.dim,
                  paddingTop: 2,
                }}>{p.p}</span>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{p.text}</p>
                  <p style={{ fontSize: 12, color: C.muted, marginBottom: 10, lineHeight: 1.5 }}>
                    ↳ {p.insight}
                  </p>
                  <div className="ai-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <button style={{
                      padding: '6px 14px', borderRadius: 6,
                      background: p.urgent ? C.accent : C.surface2,
                      color: p.urgent ? '#fff' : C.text,
                      border: p.urgent ? 'none' : `1px solid ${C.line}`,
                      fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    }}>{p.primary}</button>
                    <button style={{
                      padding: '6px 14px', borderRadius: 6,
                      background: 'transparent', border: `1px solid ${C.line}`,
                      color: C.muted, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                    }}>{p.secondary}</button>
                    <button style={{
                      padding: '6px 10px', borderRadius: 6,
                      background: 'transparent', border: 'none',
                      color: C.dim, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                      marginInlineStart: 'auto',
                    }}>أجّل ⌄</button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ════ TODAY STRIP: Critical Path time-ordered ════════════════════ */}
        <section style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
            <h2 style={{
              fontSize: 22, fontWeight: 700, letterSpacing: '-0.018em',
              fontFamily: 'var(--font-arabic-display)',
            }}>اليوم</h2>
            <span style={{ fontSize: 11, color: C.dim }}>الأربعاء، ٢١ مايو · ٤ بنود</span>
            <Link href="#" style={{
              marginInlineStart: 'auto', fontSize: 11, color: C.accent,
              textDecoration: 'none', fontWeight: 500,
            }}>التقويم الكامل ←</Link>
          </div>
          <div className="today-strip" style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 10,
          }}>
            {TODAY_ITEMS.map((item) => {
              const k = KIND_ICONS[item.kind] ?? KIND_ICONS.deliver!;
              return (
                <div key={item.time + item.what} style={{
                  background: C.surface,
                  border: `1px solid ${item.urgent ? C.accent + '40' : C.line}`,
                  borderRadius: 10,
                  padding: 14,
                  position: 'relative',
                }}>
                  {item.urgent && (
                    <span style={{
                      position: 'absolute', top: 10, insetInlineEnd: 10,
                      fontSize: 8, padding: '1px 5px', borderRadius: 3,
                      background: C.accent + '25', color: C.accent,
                      letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 600,
                    }}>urgent</span>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: (k.color ?? C.muted) + '20',
                      color: k.color ?? C.muted,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13,
                    }}>{k.icon}</span>
                    <span style={{
                      fontSize: 16, fontWeight: 600,
                      fontFamily: 'var(--font-mono)',
                      color: item.urgent ? C.accent : C.text,
                    }}>{item.time}</span>
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{item.what}</p>
                  <p style={{ fontSize: 11, color: C.muted }}>{item.who}</p>
                  {item.code && (
                    <p style={{
                      fontSize: 10, color: C.dim, fontFamily: 'var(--font-mono)',
                      marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.line}`,
                    }}>{item.code}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ════ CUSTOMIZABLE CARDS GRID ════════════════════════════════════ */}
        <section style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
            <h2 style={{
              fontSize: 22, fontWeight: 700, letterSpacing: '-0.018em',
              fontFamily: 'var(--font-arabic-display)',
            }}>اللوحة</h2>
            <span style={{ fontSize: 11, color: C.dim }}>٨ كروت · قابلة للتخصيص</span>
            <button style={{
              marginInlineStart: 'auto',
              padding: '5px 12px', borderRadius: 6,
              background: C.surface, border: `1px solid ${C.line}`,
              color: C.text, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
            }}>تخصيص</button>
          </div>

          <div className="cards-grid">
            {/* Risk projects */}
            <Card span={4} title="مشاريع في خطر" badge="3" badgeTone="danger">
              {[
                { code: 'PR-0007', reason: 'متوقف ٥ أيام', risk: 'red' },
                { code: 'PR-0010', reason: 'وقت ضيق', risk: 'red' },
                { code: 'PR-0009', reason: 'موافقة معلّقة', risk: 'amber' },
              ].map((p) => (
                <div key={p.code} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '7px 0', borderTop: `1px solid ${C.line}`,
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: p.risk === 'red' ? '#F87171' : '#FBBF24',
                  }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: C.muted }}>{p.code}</span>
                  <span style={{ flex: 1, fontSize: 12 }}>{p.reason}</span>
                </div>
              ))}
            </Card>

            {/* Approval queue */}
            <Card span={4} title="قائمة الموافقات" badge="5">
              {[
                { item: 'PR-0009 V3', from: 'Khaled', waiting: '2h' },
                { item: 'PR-0010 V1', from: 'Mohsen', waiting: '5h' },
                { item: 'PR-0005 V2', from: 'Hamada', waiting: '1d' },
              ].map((a, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 0', borderTop: `1px solid ${C.line}`,
                }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: C.surface2, color: C.text,
                    fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{a.from[0]}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 500 }}>{a.item}</p>
                    <p style={{ fontSize: 10, color: C.dim }}>{a.from} · {a.waiting}</p>
                  </div>
                  <button style={{
                    padding: '3px 10px', borderRadius: 4,
                    background: C.accent, color: '#fff',
                    border: 'none', fontSize: 10, fontFamily: 'inherit', cursor: 'pointer',
                  }}>راجع</button>
                </div>
              ))}
            </Card>

            {/* Conflicts */}
            <Card span={4} title="تعارضات معدات" badge="2" badgeTone="warning">
              {[
                { eq: 'Sony FX3', date: 'الأربعاء', conflict: 'PR-0009 + PR-0007' },
                { eq: 'DJI Ronin', date: 'الجمعة', conflict: 'PR-0010 + PR-0006' },
              ].map((c, i) => (
                <div key={i} style={{ padding: '7px 0', borderTop: `1px solid ${C.line}` }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 500 }}>{c.eq}</span>
                    <span style={{ fontSize: 10, color: '#FBBF24', marginInlineStart: 'auto' }}>{c.date}</span>
                  </div>
                  <p style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>{c.conflict}</p>
                </div>
              ))}
            </Card>

            {/* Team capacity */}
            <Card span={6} title="حمولة الفريق · ٧ أيام">
              <div style={{ display: 'grid', gap: 6 }}>
                {[
                  { name: 'محمد المالكي', load: 90 },
                  { name: 'Khaled', load: 70 },
                  { name: 'Mohsen', load: 50 },
                  { name: 'Hamada', load: 30 },
                  { name: 'Kabsy', load: 110, over: true },
                ].map((p) => (
                  <div key={p.name} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 40px', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 11 }}>{p.name}</span>
                    <div style={{ height: 6, background: C.surface2, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.min(100, p.load)}%`, height: '100%',
                        background: p.over ? '#F87171' : p.load > 80 ? '#FBBF24' : C.accent,
                      }} />
                    </div>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: p.over ? '#F87171' : C.muted, textAlign: 'end' }}>
                      {p.load}%
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Revenue forecast */}
            <Card span={6} title="توقّع الإيراد" badge="+12% MoM" badgeTone="success">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 3, height: 60, alignItems: 'end' }}>
                {[40, 55, 38, 62, 70, 58, 75, 82, 65, 88, 92, 78].map((h, i) => (
                  <div key={i} style={{
                    height: `${h}%`,
                    background: i > 7 ? C.accent : C.muted,
                    borderRadius: '2px 2px 0 0',
                    opacity: i > 7 ? 1 : 0.35,
                  }} />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                <div>
                  <p style={{ fontSize: 10, color: C.muted }}>متوقّع نهاية الشهر</p>
                  <p style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-arabic-display)', color: C.accent }}>
                    ١٨٢K <span style={{ fontSize: 10, color: C.dim }}>SAR</span>
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: 10, color: C.muted }}>محصّل</p>
                  <p style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-arabic-display)' }}>
                    ١٤٥K
                  </p>
                </div>
              </div>
            </Card>

            {/* Quick stats — 4 narrow cards */}
            <Card span={3}><MiniStat label="Leads باردة" value={5} sub="منذ ٥+ أيام" tone="warning" /></Card>
            <Card span={3}><MiniStat label="تسليمات الأسبوع" value={3} sub="١ متأخر" /></Card>
            <Card span={3}><MiniStat label="معدات في الصيانة" value={2} sub="٣ أيام متوسط" /></Card>
            <Card span={3}><MiniStat label="مدفوعات متأخرة" value="٢١K" sub="٤ فواتير" tone="danger" /></Card>

            {/* Add card */}
            <div style={{
              gridColumn: 'span 12', padding: 18, textAlign: 'center',
              border: `1px dashed ${C.line}`, borderRadius: 12,
              color: C.muted, fontSize: 12, cursor: 'pointer',
            }}>
              + أضف كرت · ١٢ كرت متاح في الـ catalog
            </div>
          </div>
        </section>

        {/* ════ ASK CLAUDE FOOTER ═════════════════════════════════════════ */}
        <section style={{
          background: C.surface,
          border: `1px solid ${C.lineStrong}`,
          borderRadius: 12,
          padding: 16,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: C.gradient,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700, color: '#fff',
          }}>C</div>
          <input
            placeholder="اسأل Claude أي حاجة عن Volt… (مثال: ما الـ KPI الأسوأ هذا الشهر؟)"
            style={{
              flex: 1, background: 'transparent', border: 'none',
              color: C.text, fontSize: 14, fontFamily: 'inherit', outline: 'none',
            }}
          />
          <button style={{
            padding: '8px 16px', borderRadius: 8,
            background: C.gradient, color: '#fff', border: 'none',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}>↗ اسأل</button>
        </section>
      </main>

      {/* Side dock — desktop */}
      <SideDock />
      {/* Bottom dock — mobile */}
      <BottomDock />
    </div>
  );
}

function Card({
  span, title, eyebrow, badge, badgeTone, children,
}: {
  span: number;
  title?: string;
  eyebrow?: string;
  badge?: string;
  badgeTone?: 'success' | 'warning' | 'danger';
  children: React.ReactNode;
}) {
  const badgeColor = badgeTone === 'success' ? '#34D399'
    : badgeTone === 'warning' ? '#FBBF24'
    : badgeTone === 'danger' ? '#F87171' : C.muted;
  return (
    <div data-span={span} style={{
      gridColumn: `span ${span}`,
      background: C.surface,
      border: `1px solid ${C.line}`,
      borderRadius: 12,
      padding: 16,
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
          {title && <h3 style={{ fontSize: 13, fontWeight: 600 }}>{title}</h3>}
          {badge && (
            <span style={{
              marginInlineStart: 'auto',
              fontSize: 10, padding: '2px 8px', borderRadius: 4,
              background: badgeColor + '20', color: badgeColor,
              fontWeight: 600,
            }}>{badge}</span>
          )}
          <span style={{
            fontSize: 11, color: C.dim, cursor: 'grab',
            marginInlineStart: title || badge ? 0 : 'auto',
          }}>⋮⋮</span>
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
      <p style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>{label}</p>
      <p style={{
        fontSize: 24, fontWeight: 700, color,
        letterSpacing: '-0.02em', lineHeight: 1,
        fontFamily: 'var(--font-arabic-display)',
      }}>{value}</p>
      <p style={{ fontSize: 10, color: C.dim, marginTop: 4 }}>{sub}</p>
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
      position: 'fixed', insetInlineEnd: 24, top: '50%',
      transform: 'translateY(-50%)', zIndex: 50,
      flexDirection: 'column',
      background: C.surface, borderRadius: 16, padding: 6,
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

function BottomDock() {
  const ITEMS = [
    { icon: '◇', label: 'الرئيسية', active: true },
    { icon: '▢', label: 'المشاريع' },
    { icon: '✉', label: 'الوارد' },
    { icon: '▦', label: 'التقويم' },
    { icon: '☰', label: 'المزيد' },
  ];
  return (
    <div className="md:hidden" style={{
      position: 'fixed', bottom: 16, left: '50%',
      transform: 'translateX(-50%)', zIndex: 50,
      background: C.surface, borderRadius: 16, padding: 6,
      border: `1px solid ${C.lineStrong}`,
      boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5)',
      display: 'flex', gap: 4,
    }}>
      {ITEMS.map((i) => (
        <a key={i.label} href="#" style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          padding: '8px 12px', borderRadius: 12,
          color: i.active ? C.text : C.muted,
          background: i.active ? C.accent + '15' : 'transparent',
          textDecoration: 'none', minWidth: 50,
        }}>
          <span style={{ fontSize: 16, color: i.active ? C.accent : C.dim }}>{i.icon}</span>
          <span style={{ fontSize: 9 }}>{i.label}</span>
        </a>
      ))}
    </div>
  );
}
