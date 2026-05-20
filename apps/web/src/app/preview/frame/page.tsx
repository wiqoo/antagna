import Link from 'next/link';
import {
  PROJECTS, SHOOTS_THIS_WEEK, ACTIVITY, AI_BRIEFING, STATS,
} from '../mock-data';

export const dynamic = 'force-static';

const C = {
  bg: '#0F0F12',
  surface: '#17171C',
  surface2: '#1F1F26',
  text: '#FFFFFF',
  muted: '#9C9CA8',
  dim: '#6B6B78',
  line: 'rgba(255,255,255,0.08)',
  lineStrong: 'rgba(255,255,255,0.16)',
  accent: '#FF4D6D',
  accent2: '#7C5CFF',
  gradient: 'linear-gradient(135deg, #FF4D6D 0%, #7C5CFF 100%)',
};

const THUMB_COLORS = ['#FF4D6D', '#7C5CFF', '#34D399', '#FBBF24', '#60A5FA', '#FB923C'];

export default function FramePreview() {
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
      <PreviewBar slug="frame" name="Frame.io · Studio" bg={C.surface} text={C.text} />

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 40px)' }}>
        <aside
          style={{
            width: 64,
            background: C.surface,
            borderInlineStart: `1px solid ${C.line}`,
            padding: '16px 0',
            display: 'none',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
          }}
          className="md:flex"
        >
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: C.gradient,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 14,
            marginBottom: 12,
          }}>
            A
          </div>
          {['◇', '▢', '✓', '☰', '🔍', '⚙'].map((g, i) => (
            <a key={i} href="#" style={{
              width: 36, height: 36, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, color: i === 0 ? C.text : C.muted,
              background: i === 0 ? C.surface2 : 'transparent',
              textDecoration: 'none',
            }}>
              {g}
            </a>
          ))}
        </aside>

        <main style={{ flex: 1, padding: '28px 36px' }}>
          {/* Hero — magazine cover style */}
          <div style={{ marginBottom: 36 }}>
            <p style={{ fontSize: 11, color: C.muted, marginBottom: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Volt Production · ٢١ مايو ٢٠٢٦
            </p>
            <h1 style={{
              fontSize: 56, fontWeight: 700, lineHeight: 1.05,
              letterSpacing: '-0.025em', marginBottom: 12,
              background: C.gradient,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              ٣ تصويرات النهارده
            </h1>
            <p style={{ fontSize: 18, color: C.muted, maxWidth: 560 }}>
              {AI_BRIEFING.headline}
            </p>
          </div>

          {/* Hero shoot card */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 1fr',
            gap: 24,
            marginBottom: 36,
          }}>
            <div style={{
              background: C.surface,
              borderRadius: 14,
              overflow: 'hidden',
              border: `1px solid ${C.line}`,
            }}>
              {/* Thumbnail */}
              <div style={{
                aspectRatio: '16 / 9',
                background: `linear-gradient(135deg, ${THUMB_COLORS[0]}40, ${THUMB_COLORS[1]}40), #1a1a22`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(20px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, color: '#fff',
                }}>
                  ▶
                </div>
                <span style={{
                  position: 'absolute', top: 14, insetInlineStart: 14,
                  padding: '4px 10px', borderRadius: 6,
                  background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)',
                  fontSize: 11, fontFamily: 'var(--font-mono)',
                }}>
                  PR-0009 · V3
                </span>
                <span style={{
                  position: 'absolute', top: 14, insetInlineEnd: 14,
                  padding: '4px 10px', borderRadius: 6,
                  background: 'rgba(251,191,36,0.2)',
                  color: '#FBBF24',
                  fontSize: 11, fontWeight: 600,
                  letterSpacing: '0.04em', textTransform: 'uppercase',
                }}>
                  In review
                </span>
              </div>
              {/* Meta */}
              <div style={{ padding: 20 }}>
                <p style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>فيلم العلامة التجارية</p>
                <p style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>HRMNY · جدة · بإذن محمد المالكي</p>
                {/* Approvers */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  {['M', 'A', 'K'].map((n, i) => (
                    <div key={i} style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: i === 0 ? '#34D399' : i === 1 ? '#FBBF24' : C.surface2,
                      color: '#fff', fontSize: 10, fontWeight: 600,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: `2px solid ${C.surface}`,
                      marginInlineStart: i ? -8 : 0,
                    }}>
                      {n}
                    </div>
                  ))}
                  <span style={{ fontSize: 12, color: C.muted, marginInlineStart: 8 }}>
                    ٢/٣ موافقة · بانتظار Khaled
                  </span>
                </div>
                {/* Comments preview */}
                <div style={{
                  padding: 12, borderRadius: 8,
                  background: C.surface2,
                  fontSize: 12, color: C.muted,
                }}>
                  <span style={{ color: '#FBBF24', fontFamily: 'var(--font-mono)' }}>0:14</span>
                  {' · '}
                  <span style={{ color: C.text }}>Ahmed:</span> اللوجو يهتز شوية في الـ outro
                </div>
              </div>
            </div>

            {/* AI panel */}
            <div style={{
              background: C.surface,
              borderRadius: 14,
              padding: 20,
              border: `1px solid ${C.line}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
                <span style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 4,
                  background: C.accent + '20', color: C.accent, fontWeight: 600,
                  letterSpacing: '0.04em', textTransform: 'uppercase',
                }}>
                  AI
                </span>
                <span style={{ fontSize: 11, color: C.dim }}>محدّث الآن</span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {AI_BRIEFING.bullets.map((b, i) => (
                  <li key={i} style={{
                    padding: '10px 0',
                    borderTop: i ? `1px solid ${C.line}` : 'none',
                  }}>
                    <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{b.text}</p>
                    <p style={{ fontSize: 11, color: C.muted }}>{b.action}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Projects gallery — Frame.io style grid */}
          <section style={{ marginBottom: 36 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600 }}>Active Projects</h2>
              <span style={{ fontSize: 12, color: C.dim, fontFamily: 'var(--font-mono)' }}>{STATS.activeProjects}</span>
              <button style={{
                marginInlineStart: 'auto',
                background: C.gradient,
                color: '#fff', border: 'none',
                borderRadius: 8, padding: '8px 16px',
                fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
              }}>
                + مشروع جديد
              </button>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 14,
            }}>
              {PROJECTS.map((p, i) => (
                <div key={p.code} style={{
                  background: C.surface,
                  borderRadius: 10,
                  overflow: 'hidden',
                  border: `1px solid ${C.line}`,
                }}>
                  <div style={{
                    aspectRatio: '16 / 9',
                    background: `linear-gradient(135deg, ${THUMB_COLORS[i % THUMB_COLORS.length]}30, ${THUMB_COLORS[(i + 2) % THUMB_COLORS.length]}30), #1a1a22`,
                    position: 'relative',
                  }}>
                    <span style={{
                      position: 'absolute', top: 8, insetInlineStart: 8,
                      padding: '2px 6px', borderRadius: 4,
                      background: 'rgba(0,0,0,0.6)', fontSize: 9,
                      fontFamily: 'var(--font-mono)', color: '#fff',
                    }}>
                      {p.code}
                    </span>
                    <span style={{
                      position: 'absolute', bottom: 8, insetInlineEnd: 8,
                      padding: '2px 6px', borderRadius: 4,
                      background: 'rgba(0,0,0,0.6)', fontSize: 9, color: '#fff',
                    }}>
                      {p.stageAr}
                    </span>
                  </div>
                  <div style={{ padding: 12 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{p.titleAr}</p>
                    <p style={{ fontSize: 11, color: C.muted }}>{p.client} · {p.pm}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Activity stream — editorial */}
          <section style={{
            background: C.surface,
            border: `1px solid ${C.line}`,
            borderRadius: 12,
            padding: 24,
          }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Activity</h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {ACTIVITY.map((a, i) => (
                <li key={i} style={{
                  display: 'flex', gap: 14, padding: '12px 0',
                  borderTop: i ? `1px solid ${C.line}` : 'none',
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: THUMB_COLORS[i % THUMB_COLORS.length] + '40',
                    color: THUMB_COLORS[i % THUMB_COLORS.length],
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 600, flexShrink: 0,
                  }}>
                    {a.who[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14 }}>
                      <span style={{ fontWeight: 600 }}>{a.who}</span>{' '}
                      <span style={{ color: C.muted }}>{a.what}</span>
                    </p>
                    <p style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{a.when}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </main>
      </div>
    </div>
  );
}

function PreviewBar({ slug, name, bg, text }: { slug: string; name: string; bg: string; text: string }) {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: bg, borderBottom: '1px solid rgba(255,255,255,0.08)',
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
