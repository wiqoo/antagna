import Link from 'next/link';
import {
  PROJECTS, SHOOTS_THIS_WEEK, ACTIVITY, AI_BRIEFING, STATS,
} from '../mock-data';

export const dynamic = 'force-static';

const C = {
  bg: '#FFFFFF',
  surface: '#F6F9FC',
  surface2: '#EBF0F4',
  text: '#0A2540',
  muted: '#425466',
  dim: '#8898AA',
  line: '#E5E9F0',
  lineStrong: '#CFD7E0',
  accent: '#635BFF',
  accentDark: '#4338CA',
  positive: '#3CA67D',
  negative: '#CF1124',
};

export default function StripePreview() {
  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100vh',
        background: C.bg,
        color: C.text,
        fontFamily: 'var(--font-arabic), system-ui',
      }}
    >
      <PreviewBar slug="stripe" name="Stripe · Business" bg={C.bg} text={C.text} />

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 40px)' }}>
        <aside
          style={{
            width: 220,
            borderInlineStart: `1px solid ${C.line}`,
            background: C.surface,
            padding: '20px 12px',
            display: 'none',
          }}
          className="md:block"
        >
          <p style={{ padding: '4px 12px 24px', fontWeight: 700, fontSize: 18, color: C.text }}>Antagna</p>

          {[
            ['Home', true],
            ['Projects', false],
            ['Tasks', false],
            ['Inbox', false],
            ['Clients', false],
            ['Equipment', false],
            ['Calendar', false],
            ['Reports', false],
            ['Settings', false],
          ].map(([label, active]) => (
            <a
              key={label as string}
              href="#"
              style={{
                display: 'block',
                padding: '7px 12px',
                fontSize: 13,
                borderRadius: 6,
                fontWeight: active ? 600 : 400,
                color: active ? C.accent : C.muted,
                background: active ? '#fff' : 'transparent',
                textDecoration: 'none',
                marginBottom: 2,
                boxShadow: active ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              {label}
            </a>
          ))}
        </aside>

        <main style={{ flex: 1, padding: '32px 40px' }}>
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <a href="#" style={{ color: C.muted, fontSize: 13, textDecoration: 'none' }}>Home</a>
            <span style={{ color: C.dim }}>/</span>
            <a href="#" style={{ color: C.text, fontSize: 13, textDecoration: 'none' }}>Dashboard</a>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 4 }}>
            صباح الخير، محمد
          </h1>
          <p style={{ fontSize: 14, color: C.muted, marginBottom: 24 }}>
            ٢١ مايو ٢٠٢٦ · الأربعاء
          </p>

          {/* Hero KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
            {[
              { label: 'مشاريع نشطة', value: STATS.activeProjects, delta: '+2 من الأسبوع الماضي', positive: true },
              { label: 'إيراد الشهر', value: '145,000 SAR', delta: '+12% MoM', positive: true },
              { label: 'فرص (leads)', value: STATS.openLeads, delta: '3 جديدة هذا الأسبوع', positive: true },
              { label: 'تسليمات متأخرة', value: STATS.overdueCount, delta: 'تحتاج اهتمام', positive: false },
            ].map((s) => (
              <div key={s.label} style={{
                background: '#fff',
                border: `1px solid ${C.line}`,
                borderRadius: 8,
                padding: 16,
              }}>
                <p style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>{s.label}</p>
                <p style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.02em' }}>{s.value}</p>
                <p style={{ fontSize: 12, color: s.positive ? C.positive : C.negative, marginTop: 8 }}>
                  {s.positive ? '▲' : '▼'} {s.delta}
                </p>
              </div>
            ))}
          </div>

          {/* AI Briefing — outlined notice */}
          <div style={{
            background: C.surface,
            border: `1px solid ${C.line}`,
            borderRadius: 8,
            padding: 20,
            marginBottom: 28,
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: C.accent, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Antagna AI
              </span>
              <span style={{ fontSize: 11, color: C.dim }}>محدّث منذ دقيقة</span>
            </div>
            <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 14 }}>{AI_BRIEFING.headline}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {AI_BRIEFING.bullets.map((b, i) => (
                <div key={i} style={{
                  background: '#fff',
                  border: `1px solid ${C.line}`,
                  borderRadius: 6,
                  padding: 12,
                  fontSize: 13,
                }}>
                  <span style={{
                    display: 'inline-block',
                    fontSize: 10, fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 4,
                    marginBottom: 6,
                    background: b.p === 'high' ? '#FFE5E5' : '#FFF4E5',
                    color: b.p === 'high' ? C.negative : '#9F580A',
                    letterSpacing: '0.04em', textTransform: 'uppercase',
                  }}>
                    {b.p === 'high' ? 'عالي' : 'متوسط'}
                  </span>
                  <p>{b.text}</p>
                  <p style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{b.action}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Projects table — Stripe's signature look */}
          <div style={{
            background: '#fff',
            border: `1px solid ${C.line}`,
            borderRadius: 8,
            overflow: 'hidden',
            marginBottom: 28,
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: `1px solid ${C.line}`,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <p style={{ fontSize: 15, fontWeight: 600 }}>المشاريع النشطة</p>
              <span style={{ fontSize: 12, color: C.dim }}>{PROJECTS.length} مشروع</span>
              <button style={{
                marginInlineStart: 'auto',
                background: C.accent,
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: 500,
                fontFamily: 'inherit',
              }}>
                + مشروع جديد
              </button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: C.surface }}>
                  {['code', 'العنوان', 'العميل', 'المرحلة', 'مدير', 'القيمة', 'التسليم'].map((h) => (
                    <th key={h} style={{
                      textAlign: 'start',
                      padding: '10px 16px',
                      fontSize: 11,
                      color: C.muted,
                      fontWeight: 500,
                      letterSpacing: '0.04em',
                      borderBottom: `1px solid ${C.line}`,
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PROJECTS.map((p, i) => (
                  <tr key={p.code} style={{ borderBottom: i < PROJECTS.length - 1 ? `1px solid ${C.line}` : 'none' }}>
                    <td style={{ padding: '12px 16px', color: C.accent, fontFamily: 'var(--font-mono)', fontSize: 12 }}>{p.code}</td>
                    <td style={{ padding: '12px 16px' }}>{p.titleAr}</td>
                    <td style={{ padding: '12px 16px', color: C.muted }}>{p.client}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        fontSize: 11, padding: '3px 9px', borderRadius: 999,
                        background: stripeBadge(p.stage).bg,
                        color: stripeBadge(p.stage).fg,
                        fontWeight: 500,
                      }}>
                        {p.stageAr}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: C.muted }}>{p.pm}</td>
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)' }}>
                      {p.value.toLocaleString()}
                      <span style={{ fontSize: 10, color: C.dim, marginInlineStart: 4 }}>SAR</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', color: p.dueDays < 0 ? C.dim : p.dueDays < 7 ? C.negative : C.muted }}>
                      {p.dueDays < 0 ? 'مُسلَّم' : `${p.dueDays} يوم`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Shoots + activity */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
            <div style={{
              background: '#fff',
              border: `1px solid ${C.line}`,
              borderRadius: 8,
              overflow: 'hidden',
            }}>
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.line}` }}>
                <p style={{ fontSize: 14, fontWeight: 600 }}>تصوير هذا الأسبوع</p>
              </div>
              {SHOOTS_THIS_WEEK.map((s, i) => (
                <div key={s.code} style={{
                  padding: '14px 20px',
                  borderTop: i ? `1px solid ${C.line}` : 'none',
                  display: 'grid',
                  gridTemplateColumns: '80px 1fr auto',
                  gap: 14,
                  alignItems: 'center',
                }}>
                  <div>
                    <p style={{ fontSize: 11, color: C.dim }}>{s.day}</p>
                    <p style={{ fontSize: 16, fontWeight: 600, fontFamily: 'var(--font-mono)', color: C.accent }}>{s.time}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 500 }}>{s.titleAr}</p>
                    <p style={{ fontSize: 12, color: C.muted }}>{s.client} · {s.city}</p>
                  </div>
                  <span style={{ fontSize: 11, color: C.dim, fontFamily: 'var(--font-mono)' }}>{s.code}</span>
                </div>
              ))}
            </div>

            <div style={{
              background: '#fff',
              border: `1px solid ${C.line}`,
              borderRadius: 8,
              overflow: 'hidden',
            }}>
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.line}` }}>
                <p style={{ fontSize: 14, fontWeight: 600 }}>آخر النشاط</p>
              </div>
              {ACTIVITY.map((a, i) => (
                <div key={i} style={{
                  padding: '10px 20px',
                  borderTop: i ? `1px solid ${C.line}` : 'none',
                  fontSize: 13,
                }}>
                  <p>
                    <span style={{ fontWeight: 600 }}>{a.who}</span>{' '}
                    <span style={{ color: C.muted }}>{a.what}</span>
                  </p>
                  <p style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{a.when}</p>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function stripeBadge(stage: string) {
  const map: Record<string, { bg: string; fg: string }> = {
    brief:     { bg: '#E5E9FF', fg: '#3D4ED8' },
    shooting:  { bg: '#FFF4E5', fg: '#9F580A' },
    editing:   { bg: '#E5F0FF', fg: '#1E5DD8' },
    review:    { bg: '#FFE5F0', fg: '#B23568' },
    planning:  { bg: '#F0E5FF', fg: '#6E2DBD' },
    delivered: { bg: '#D7F5E0', fg: '#0F7B3F' },
  };
  return map[stage] ?? { bg: '#EEE', fg: '#333' };
}

function PreviewBar({ slug, name, bg, text }: { slug: string; name: string; bg: string; text: string }) {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: bg, borderBottom: '1px solid #E5E9F0',
      padding: '8px 16px', fontSize: 11,
      display: 'flex', alignItems: 'center', gap: 12, color: text,
    }}>
      <Link href="/preview" style={{ color: 'inherit', textDecoration: 'none' }}>← كل المعاينات</Link>
      <span style={{ opacity: 0.4 }}>·</span>
      <span style={{ fontWeight: 500 }}>{name}</span>
      <span style={{ marginInlineStart: 'auto', opacity: 0.6 }}>
        {['notion', 'linear', 'stripe', 'frame'].map((s, i) => (
          <span key={s}>
            {i > 0 && ' · '}
            <Link href={`/preview/${s}`} style={{ color: 'inherit', textDecoration: s === slug ? 'underline' : 'none', fontWeight: s === slug ? 600 : 400 }}>{s}</Link>
          </span>
        ))}
      </span>
    </div>
  );
}
