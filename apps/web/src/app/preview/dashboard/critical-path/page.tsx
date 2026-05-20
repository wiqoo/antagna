import Link from 'next/link';
import { FRAME_COLORS as C } from '../../frame-shared';

export const dynamic = 'force-static';

const TIMELINE = [
  {
    label: 'اليوم',
    eyebrow: 'الأربعاء · ٢١ مايو',
    items: [
      { time: '09:00', what: 'تصوير HRMNY · جدة', who: 'م. المالكي + ٧ طاقم', kind: 'shoot', urgent: false },
      { time: '14:00', what: 'وافق على PR-0009 V3', who: 'Khaled رفع قبل ساعتين', kind: 'approve', urgent: true },
      { time: '16:00', what: 'مكالمة مع MTN عن PR-0007', who: 'مهم — متوقف ٥ أيام', kind: 'call', urgent: true },
      { time: '17:30', what: 'ابعت reminder لـ ٣ leads باردة', who: 'WPP, ABC, XYZ', kind: 'send', urgent: false },
    ],
  },
  {
    label: 'غداً',
    eyebrow: 'الخميس · ٢٢ مايو',
    items: [
      { time: '14:00', what: 'تصوير ALFTM · الرياض', who: 'محسن + ٤ طاقم', kind: 'shoot' },
      { time: '—', what: 'تسليم PR-0010 (٣ أيام متبقية)', who: 'مع Kabsy', kind: 'deliver', urgent: true },
    ],
  },
  {
    label: 'هذا الأسبوع',
    eyebrow: 'حتى الجمعة',
    items: [
      { time: 'الجمعة', what: 'تصوير MTN · جدة', who: 'منصوري + ٤ طاقم', kind: 'shoot' },
      { time: 'الجمعة', what: 'تسليم PR-0010', who: 'موعد نهائي', kind: 'deliver', urgent: true },
      { time: 'الجمعة', what: 'مراجعة V3 لـ PR-0009', who: 'العميل HRMNY', kind: 'review' },
    ],
  },
  {
    label: 'الأسبوع القادم',
    eyebrow: '٢٥ - ٣١ مايو',
    items: [
      { time: 'الإثنين', what: 'تسليم PR-0009', who: 'موعد نهائي', kind: 'deliver' },
      { time: 'الأربعاء', what: 'مراجعة Q4 photoshoot brief', who: 'ALFTM', kind: 'review' },
    ],
  },
];

const STALLED = [
  { code: 'PR-0007', what: 'متوقف ٥ أيام في brief', need: 'رد من MTN', escalate: true },
  { code: 'Lead WPP', what: 'بارد منذ ٦ أيام', need: 'follow-up' },
];

const KIND_ICONS: Record<string, { icon: string; color: string }> = {
  shoot:   { icon: '◰', color: '#FBBF24' },
  approve: { icon: '✓', color: '#34D399' },
  call:    { icon: '☎', color: '#60A5FA' },
  send:    { icon: '✉', color: '#A78BFA' },
  deliver: { icon: '◇', color: '#FF6B1A' },
  review:  { icon: '◉', color: '#FB923C' },
};

export default function CriticalPathDashboard() {
  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'var(--font-arabic), system-ui' }}>
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: C.surface, borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '8px 16px', fontSize: 11,
        display: 'flex', alignItems: 'center', gap: 12, color: C.text,
      }}>
        <Link href="/preview/dashboard" style={{ color: 'inherit', textDecoration: 'none' }}>← Dashboard concepts</Link>
        <span style={{ opacity: 0.4 }}>·</span>
        <span style={{ fontWeight: 500 }}>Critical Path · Today-first</span>
      </div>

      <main style={{ maxWidth: 920, margin: '0 auto', padding: '48px 24px' }}>
        {/* Header */}
        <p style={{ fontSize: 11, color: C.muted, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
          Volt Production · مسار الأولوية
        </p>
        <h1 style={{
          fontSize: 40, fontWeight: 700, lineHeight: 1.1,
          letterSpacing: '-0.02em', marginBottom: 8,
          fontFamily: 'var(--font-arabic-display)',
        }}>
          ٤ بنود حرجة النهارده
        </h1>
        <p style={{ fontSize: 16, color: C.muted, marginBottom: 36 }}>
          كل شيء غير ذلك ممكن ينتظر.
        </p>

        {/* Stalled / requires decision — top */}
        {STALLED.length > 0 && (
          <section style={{
            padding: 16,
            background: C.accent + '08',
            border: `1px solid ${C.accent}30`,
            borderRadius: 12,
            marginBottom: 32,
          }}>
            <p style={{ fontSize: 11, color: C.accent, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 10 }}>
              يحتاج قرارك — معطّل
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {STALLED.map((s, i) => (
                <li key={s.code} style={{
                  display: 'grid', gridTemplateColumns: 'auto 1fr auto',
                  gap: 14, padding: '10px 0',
                  borderTop: i ? `1px solid ${C.line}` : 'none',
                  alignItems: 'center',
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: s.escalate ? '#F87171' : '#FBBF24',
                  }} />
                  <div>
                    <p style={{ fontSize: 13 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', color: C.accent, marginInlineEnd: 8 }}>{s.code}</span>
                      <span>{s.what}</span>
                    </p>
                    <p style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>↳ يحتاج: {s.need}</p>
                  </div>
                  <button style={{
                    padding: '6px 14px', borderRadius: 6,
                    background: C.accent, color: '#fff', border: 'none',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}>تنفيذ</button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Timeline — vertical, by day */}
        {TIMELINE.map((tl, ti) => (
          <section key={tl.label} style={{ marginBottom: 40 }}>
            <div style={{
              display: 'flex', alignItems: 'baseline', gap: 14,
              marginBottom: 16, paddingBottom: 8,
              borderBottom: `1px solid ${C.line}`,
            }}>
              <h2 style={{
                fontSize: ti === 0 ? 28 : 20,
                fontWeight: 700,
                letterSpacing: '-0.018em',
                fontFamily: 'var(--font-arabic-display)',
                color: ti === 0 ? C.text : C.muted,
              }}>{tl.label}</h2>
              <span style={{ fontSize: 11, color: C.dim }}>{tl.eyebrow}</span>
              <span style={{
                marginInlineStart: 'auto',
                fontSize: 11, color: C.dim,
                fontFamily: 'var(--font-mono)',
              }}>{tl.items.length} {tl.items.length === 1 ? 'بند' : 'بنود'}</span>
            </div>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {tl.items.map((item, i) => {
                const k = KIND_ICONS[item.kind] ?? KIND_ICONS.deliver;
                return (
                  <li key={i} style={{
                    display: 'grid',
                    gridTemplateColumns: '90px 32px 1fr auto',
                    gap: 14, padding: '14px 0',
                    borderBottom: i < tl.items.length - 1 ? `1px solid ${C.line}` : 'none',
                    alignItems: 'center',
                  }}>
                    <span style={{
                      fontSize: 13, fontWeight: 500,
                      color: item.urgent ? C.accent : C.muted,
                      fontFamily: 'var(--font-mono)',
                    }}>
                      {item.time}
                    </span>
                    <span style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: (k?.color ?? C.muted) + '20',
                      color: k?.color ?? C.muted,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13,
                    }}>{k?.icon}</span>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 500 }}>
                        {item.what}
                        {item.urgent && (
                          <span style={{
                            marginInlineStart: 8,
                            fontSize: 9, padding: '1px 6px', borderRadius: 3,
                            background: C.accent + '20', color: C.accent,
                            letterSpacing: '0.04em', textTransform: 'uppercase',
                            fontWeight: 600,
                          }}>urgent</span>
                        )}
                      </p>
                      <p style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{item.who}</p>
                    </div>
                    <button style={{
                      padding: '4px 10px', borderRadius: 6,
                      background: 'transparent', border: `1px solid ${C.line}`,
                      color: C.muted, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                    }}>افتح</button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        {/* AI footer hint */}
        <div style={{
          marginTop: 48, padding: 16,
          background: C.surface, borderRadius: 12,
          border: `1px solid ${C.line}`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: C.gradient,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: '#fff',
          }}>C</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 500 }}>
              عايز Claude يلخّص الأسبوع؟ أو يقترح ترتيب أوّليّات مختلف؟
            </p>
          </div>
          <button style={{
            padding: '6px 14px', borderRadius: 8,
            background: C.gradient, color: '#fff', border: 'none',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}>اسأل Claude</button>
        </div>
      </main>
    </div>
  );
}
