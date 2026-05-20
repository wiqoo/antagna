import Link from 'next/link';
import {
  PROJECTS, SHOOTS_THIS_WEEK, ACTIVITY, AI_BRIEFING, STATS,
} from '../mock-data';

export const dynamic = 'force-static';

const C = {
  bg: '#08090A',
  surface: '#141517',
  surface2: '#1A1B1E',
  text: '#F4F4F5',
  muted: '#A1A1AA',
  dim: '#71717A',
  line: 'rgba(255,255,255,0.06)',
  lineStrong: 'rgba(255,255,255,0.12)',
  accent: '#7C5CFF',
  accentTint: 'rgba(124,92,255,0.12)',
};

const STAGE_COLOR: Record<string, string> = {
  brief: '#A1A1AA',
  shooting: '#FBBF24',
  editing: '#60A5FA',
  review: '#FB923C',
  planning: '#A78BFA',
  delivered: '#34D399',
};

export default function LinearPreview() {
  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100vh',
        background: C.bg,
        color: C.text,
        fontFamily: 'var(--font-arabic), system-ui',
        fontSize: 13,
      }}
    >
      <PreviewBar slug="linear" name="Linear · Dense Dark" bg={C.surface} text={C.text} />

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 40px)' }}>
        {/* Sidebar */}
        <aside
          style={{
            width: 220,
            background: C.bg,
            borderInlineStart: `1px solid ${C.line}`,
            padding: '16px 8px',
            display: 'none',
          }}
          className="md:block"
        >
          <div style={{ padding: '4px 8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 18, height: 18, background: C.accent, borderRadius: 4 }} />
            <span style={{ fontWeight: 600, fontSize: 13 }}>Antagna</span>
          </div>

          {/* Search shortcut */}
          <div style={{
            padding: '5px 10px', margin: '0 0 16px', borderRadius: 4,
            border: `1px solid ${C.line}`, background: C.surface,
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.muted,
          }}>
            <span>بحث…</span>
            <span style={{ marginInlineStart: 'auto', fontSize: 10, color: C.dim, fontFamily: 'var(--font-mono)' }}>⌘K</span>
          </div>

          {[
            { items: [['Inbox', '12'], ['My issues', '5']] },
            { label: 'WORKSPACE', items: [['Projects', null], ['Shoots', null], ['Clients', null], ['Equipment', null], ['Team', null], ['Calendar', null]] },
            { label: 'INSIGHTS', items: [['Reports', null], ['KPIs', null]] },
          ].map((g, gi) => (
            <div key={gi} style={{ marginBottom: 12 }}>
              {g.label && (
                <p style={{ padding: '8px 8px 4px', fontSize: 10, color: C.dim, fontWeight: 500, letterSpacing: '0.04em' }}>
                  {g.label}
                </p>
              )}
              {g.items.map(([label, count], i) => (
                <a
                  key={i}
                  href="#"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px 10px',
                    fontSize: 12,
                    color: C.muted,
                    textDecoration: 'none',
                    borderRadius: 4,
                  }}
                >
                  <span>{label}</span>
                  {count && (
                    <span style={{ marginInlineStart: 'auto', fontSize: 10, color: C.dim, fontFamily: 'var(--font-mono)' }}>
                      {count}
                    </span>
                  )}
                </a>
              ))}
            </div>
          ))}
        </aside>

        {/* Main — very dense */}
        <main style={{ flex: 1, padding: '20px 24px', overflow: 'hidden' }}>
          {/* Top hairline header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <h1 style={{ fontSize: 14, fontWeight: 600 }}>Dashboard</h1>
            <span style={{ fontSize: 12, color: C.dim }}>الأربعاء، ٢١ مايو</span>
            <button style={{
              marginInlineStart: 'auto',
              padding: '4px 10px',
              background: C.accent,
              color: C.text,
              border: 'none',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 500,
              fontFamily: 'inherit',
            }}>
              مشروع جديد
            </button>
          </div>

          {/* AI Briefing — compact */}
          <div style={{
            border: `1px solid ${C.line}`,
            borderRadius: 6,
            padding: '12px 14px',
            marginBottom: 16,
            background: C.surface,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ width: 5, height: 5, background: C.accent, borderRadius: '50%' }} />
              <span style={{ fontSize: 11, color: C.dim, letterSpacing: '0.04em' }}>AI · NOW</span>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{AI_BRIEFING.headline}</span>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {AI_BRIEFING.bullets.map((b, i) => (
                <li key={i} style={{
                  display: 'grid',
                  gridTemplateColumns: '50px 1fr 1fr',
                  gap: 12,
                  padding: '4px 0',
                  fontSize: 12,
                  borderTop: i ? `1px solid ${C.line}` : 'none',
                }}>
                  <span style={{
                    color: b.p === 'high' ? '#F87171' : '#FBBF24',
                    fontSize: 10,
                    textTransform: 'uppercase',
                    paddingTop: 2,
                  }}>
                    {b.p}
                  </span>
                  <span>{b.text}</span>
                  <span style={{ color: C.muted }}>{b.action}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 16 }}>
            {[
              ['نشطة', STATS.activeProjects, null],
              ['مهام', STATS.openTasks, null],
              ['Leads', STATS.openLeads, null],
              ['متأخرة', STATS.overdueCount, '#F87171'],
              ['مراجعة', STATS.pendingReview, '#FBBF24'],
              ['MTD', '145K', '#34D399'],
            ].map(([label, value, color]) => (
              <div key={label as string} style={{
                padding: '8px 10px',
                border: `1px solid ${C.line}`,
                borderRadius: 4,
                background: C.bg,
              }}>
                <p style={{ fontSize: 10, color: C.dim, marginBottom: 4, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label as string}</p>
                <p style={{ fontSize: 18, fontWeight: 600, color: (color as string) ?? C.text, fontFamily: 'var(--font-mono)' }}>{value as string | number}</p>
              </div>
            ))}
          </div>

          {/* Projects list — dense */}
          <div style={{
            border: `1px solid ${C.line}`,
            borderRadius: 6,
            overflow: 'hidden',
            marginBottom: 16,
          }}>
            <div style={{
              padding: '8px 14px',
              background: C.surface,
              borderBottom: `1px solid ${C.line}`,
              display: 'flex', alignItems: 'center', gap: 12,
              fontSize: 11, color: C.dim,
            }}>
              <span>كل المشاريع</span>
              <span style={{ color: C.text, fontFamily: 'var(--font-mono)' }}>{PROJECTS.length}</span>
              <span style={{ marginInlineStart: 'auto', fontFamily: 'var(--font-mono)' }}>⌘F · فلتر</span>
            </div>
            {PROJECTS.map((p, i) => (
              <div key={p.code} style={{
                display: 'grid',
                gridTemplateColumns: '20px 65px 1fr 80px 60px 80px 50px',
                gap: 12,
                alignItems: 'center',
                padding: '7px 14px',
                borderTop: i ? `1px solid ${C.line}` : 'none',
                fontSize: 12,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: STAGE_COLOR[p.stage] }} />
                <span style={{ color: C.dim, fontFamily: 'var(--font-mono)', fontSize: 11 }}>{p.code}</span>
                <span>{p.titleAr}</span>
                <span style={{ color: C.muted, fontSize: 11 }}>{p.client}</span>
                <span style={{ color: C.muted, fontSize: 11 }}>{p.pm}</span>
                <span style={{ color: C.muted, fontSize: 11 }}>{p.stageAr}</span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11,
                  color: p.dueDays < 0 ? C.dim : p.dueDays < 7 ? '#FBBF24' : C.muted,
                  textAlign: 'end',
                }}>
                  {p.dueDays < 0 ? '—' : `${p.dueDays}d`}
                </span>
              </div>
            ))}
          </div>

          {/* Two-column: shoots + activity */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ border: `1px solid ${C.line}`, borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ padding: '8px 14px', background: C.surface, borderBottom: `1px solid ${C.line}`, fontSize: 11, color: C.dim }}>
                هذا الأسبوع · {SHOOTS_THIS_WEEK.length} تصوير
              </div>
              {SHOOTS_THIS_WEEK.map((s, i) => (
                <div key={s.code} style={{
                  padding: '8px 14px',
                  borderTop: i ? `1px solid ${C.line}` : 'none',
                  display: 'grid',
                  gridTemplateColumns: '60px 1fr auto',
                  gap: 10,
                  alignItems: 'center',
                  fontSize: 12,
                }}>
                  <span style={{ color: C.muted, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    {s.day.slice(0, 3)} {s.time}
                  </span>
                  <span>{s.titleAr}</span>
                  <span style={{ color: C.dim, fontSize: 11 }}>{s.client}</span>
                </div>
              ))}
            </div>
            <div style={{ border: `1px solid ${C.line}`, borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ padding: '8px 14px', background: C.surface, borderBottom: `1px solid ${C.line}`, fontSize: 11, color: C.dim }}>
                النشاط
              </div>
              {ACTIVITY.map((a, i) => (
                <div key={i} style={{
                  padding: '8px 14px',
                  borderTop: i ? `1px solid ${C.line}` : 'none',
                  fontSize: 12,
                }}>
                  <p>
                    <span style={{ fontWeight: 500 }}>{a.who}</span>{' '}
                    <span style={{ color: C.muted }}>{a.what}</span>
                  </p>
                  <p style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>{a.when}</p>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function PreviewBar({ slug, name, bg, text }: { slug: string; name: string; bg: string; text: string }) {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: bg, borderBottom: '1px solid rgba(255,255,255,0.06)',
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
