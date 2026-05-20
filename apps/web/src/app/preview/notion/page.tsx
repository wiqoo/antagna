import Link from 'next/link';
import {
  PROJECTS, SHOOTS_THIS_WEEK, ACTIVITY, AI_BRIEFING, STATS,
} from '../mock-data';

export const dynamic = 'force-static';

const C = {
  bg: '#FBFAF7',
  surface: '#FFFFFF',
  surface2: '#F4F2EE',
  text: '#37352F',
  muted: '#787774',
  dim: '#9B9A97',
  line: 'rgba(55,53,47,0.09)',
  lineStrong: 'rgba(55,53,47,0.16)',
  accent: '#FF6B1A',
  accentTint: 'rgba(255,107,26,0.08)',
};

export default function NotionPreview() {
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
      <PreviewBar slug="notion" name="Notion · Minimal" bg={C.bg} text={C.text} />

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 40px)' }}>
        {/* Sidebar */}
        <aside
          style={{
            width: 240,
            borderInlineStart: `1px solid ${C.line}`,
            padding: '24px 12px',
            display: 'none',
          }}
          className="md:block"
        >
          <p style={{ padding: '4px 12px 16px', fontWeight: 600, fontSize: 15 }}>
            Antagna
          </p>

          {[
            { label: 'المساحة', items: [['لوحة التحكم', true]] },
            { label: 'العمليات', items: [['المشاريع', false], ['المهام', false], ['الوارد', false], ['العملاء', false], ['المعدات', false], ['الفريق', false], ['التقويم', false]] },
            { label: 'الأرشيف', items: [['التقارير', false], ['الإدارة', false]] },
          ].map((g) => (
            <div key={g.label} style={{ marginBottom: 24 }}>
              <p
                style={{
                  padding: '6px 12px 4px',
                  fontSize: 11,
                  color: C.dim,
                  fontWeight: 500,
                }}
              >
                {g.label}
              </p>
              {g.items.map(([label, active]) => (
                <a
                  key={label as string}
                  href="#"
                  style={{
                    display: 'block',
                    padding: '6px 12px',
                    fontSize: 13,
                    borderRadius: 4,
                    color: active ? C.text : C.muted,
                    background: active ? C.surface2 : 'transparent',
                    fontWeight: active ? 500 : 400,
                    textDecoration: 'none',
                    marginBottom: 1,
                  }}
                >
                  {label}
                </a>
              ))}
            </div>
          ))}
        </aside>

        {/* Main */}
        <main style={{ flex: 1, padding: '48px 32px', maxWidth: 860, margin: '0 auto' }}>
          {/* Header */}
          <p style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>
            صباح الخير · الأربعاء، ٢١ مايو
          </p>
          <h1
            style={{
              fontSize: 48,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              marginBottom: 16,
              fontFamily: 'var(--font-arabic-display), var(--font-arabic), system-ui',
            }}
          >
            لوحة التحكم
          </h1>
          <p style={{ fontSize: 16, color: C.muted, lineHeight: 1.6, maxWidth: 560 }}>
            نظرة عامة على كل ما يحرّك Volt اليوم — مع تلخيص الذكاء الاصطناعي.
          </p>

          {/* AI Briefing */}
          <section style={{ marginTop: 48, padding: 24, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 8 }}>
            <p style={{ fontSize: 11, color: C.accent, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 10 }}>
              Antagna AI · ملخص اليوم
            </p>
            <h2 style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.3, marginBottom: 16 }}>
              {AI_BRIEFING.headline}
            </h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {AI_BRIEFING.bullets.map((b, i) => (
                <li key={i} style={{ display: 'flex', gap: 10, padding: '10px 0', borderTop: i ? `1px solid ${C.line}` : 'none' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: b.p === 'high' ? '#B23B3B' : '#B7651C', marginTop: 8, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, lineHeight: 1.5 }}>{b.text}</p>
                    <p style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>↳ {b.action}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Stats — minimal numbers */}
          <section style={{ marginTop: 48 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
              {[
                { label: 'مشاريع نشطة', value: STATS.activeProjects },
                { label: 'إيراد الشهر', value: '145K', unit: 'SAR' },
                { label: 'فرص (leads)', value: STATS.openLeads },
                { label: 'متأخرة', value: STATS.overdueCount, danger: true },
              ].map((s) => (
                <div key={s.label}>
                  <p style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>{s.label}</p>
                  <p style={{
                    fontSize: 36, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.02em',
                    color: s.danger ? '#B23B3B' : C.text,
                    fontFamily: 'var(--font-arabic-display)',
                  }}>
                    {s.value}{s.unit && <span style={{ fontSize: 14, color: C.muted, marginInlineStart: 6 }}>{s.unit}</span>}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Today's shoots */}
          <section style={{ marginTop: 48 }}>
            <p style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
              تصوير هذا الأسبوع
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {SHOOTS_THIS_WEEK.map((s, i) => (
                <li
                  key={s.code}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '80px 1fr auto',
                    gap: 16,
                    padding: '14px 0',
                    borderTop: i ? `1px solid ${C.line}` : 'none',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <p style={{ fontSize: 11, color: C.dim }}>{s.day}</p>
                    <p style={{ fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{s.time}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 500 }}>{s.titleAr}</p>
                    <p style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{s.client} · {s.city} · فريق {s.crew}</p>
                  </div>
                  <span style={{ fontSize: 11, color: C.dim, fontFamily: 'var(--font-mono)' }}>{s.code}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Projects */}
          <section style={{ marginTop: 48 }}>
            <p style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
              مشاريع نشطة
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {PROJECTS.slice(0, 5).map((p, i) => (
                <li
                  key={p.code}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '70px 1fr auto auto',
                    gap: 16,
                    padding: '14px 0',
                    borderTop: i ? `1px solid ${C.line}` : 'none',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: 11, color: C.dim, fontFamily: 'var(--font-mono)' }}>{p.code}</span>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 500 }}>{p.titleAr}</p>
                    <p style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{p.client} · {p.pm}</p>
                  </div>
                  <span style={{ fontSize: 12, color: C.muted }}>{p.stageAr}</span>
                  <span style={{
                    fontSize: 12, fontFamily: 'var(--font-mono)',
                    color: p.dueDays < 0 ? C.dim : p.dueDays < 7 ? '#B7651C' : C.muted,
                  }}>
                    {p.dueDays < 0 ? 'مُسلَّم' : `${p.dueDays}ي`}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Activity */}
          <section style={{ marginTop: 48 }}>
            <p style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
              آخر النشاط
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {ACTIVITY.map((a, i) => (
                <li key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderTop: i ? `1px solid ${C.line}` : 'none' }}>
                  <p style={{ fontSize: 13, flex: 1 }}>
                    <span style={{ fontWeight: 500 }}>{a.who}</span>{' '}
                    <span style={{ color: C.muted }}>{a.what}</span>
                  </p>
                  <span style={{ fontSize: 11, color: C.dim }}>{a.when}</span>
                </li>
              ))}
            </ul>
          </section>

          <div style={{ marginTop: 80, paddingTop: 24, borderTop: `1px solid ${C.line}`, fontSize: 11, color: C.dim, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Antagna · Volt Production · Jeddah
          </div>
        </main>
      </div>
    </div>
  );
}

function PreviewBar({ slug, name, bg, text }: { slug: string; name: string; bg: string; text: string }) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: bg,
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        padding: '8px 16px',
        fontSize: 11,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        color: text,
      }}
    >
      <Link href="/preview" style={{ color: 'inherit', textDecoration: 'none' }}>
        ← كل المعاينات
      </Link>
      <span style={{ opacity: 0.4 }}>·</span>
      <span style={{ fontWeight: 500 }}>{name}</span>
      <span style={{ marginInlineStart: 'auto', opacity: 0.5 }}>
        {['notion', 'linear', 'stripe', 'frame'].map((s, i) => (
          <span key={s}>
            {i > 0 && ' · '}
            <Link
              href={`/preview/${s}`}
              style={{
                color: 'inherit',
                textDecoration: s === slug ? 'underline' : 'none',
                fontWeight: s === slug ? 600 : 400,
              }}
            >
              {s}
            </Link>
          </span>
        ))}
      </span>
    </div>
  );
}
