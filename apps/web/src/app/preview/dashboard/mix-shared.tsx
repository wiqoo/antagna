import Link from 'next/link';
import { FRAME_COLORS as C } from '../frame-shared';

export const MIX = C;

export const TODAY_ITEMS = [
  { time: '09:00', what: 'تصوير HRMNY', who: 'جدة · ٧ طاقم', kind: 'shoot', urgent: false, code: 'PR-0009' },
  { time: '14:00', what: 'وافق على V3', who: 'PR-0009', kind: 'approve', urgent: true, code: 'PR-0009' },
  { time: '16:00', what: 'مكالمة مع MTN', who: 'PR-0007 متوقف', kind: 'call', urgent: true, code: 'PR-0007' },
  { time: '17:30', what: 'follow-up leads باردة', who: '٣ عملاء', kind: 'send', urgent: false },
];

export const KIND_ICONS: Record<string, { icon: string; color: string }> = {
  shoot:   { icon: '◰', color: '#FBBF24' },
  approve: { icon: '✓', color: '#34D399' },
  call:    { icon: '☎', color: '#60A5FA' },
  send:    { icon: '✉', color: '#A78BFA' },
  deliver: { icon: '◇', color: C.accent },
};

export const AI_PRIORITIES = [
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
    insight: 'Khaled على ١٤٠٪ load. حوّل color + sound لـ Mohsen.',
    primary: 'نفّذ التحويل',
    secondary: 'وريني المهام',
    urgent: true,
  },
  {
    p: '03',
    text: 'فرصة WPP بـ ٨٠K — حرارة ٧٨/١٠٠',
    insight: 'تاريخ WPP قوي (٣ مشاريع، متوسط ٧٥K).',
    primary: 'أنشئ proposal',
    secondary: 'افتح الـ lead',
    urgent: false,
  },
];

export function MixTopBar({ name }: { name: string }) {
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
        <span style={{ fontWeight: 600 }}>{name}</span>
        <span style={{ marginInlineStart: 'auto', opacity: 0.6 }}>
          {[
            ['mix', 'Layered'],
            ['mix-sidebar', 'Sidebar AI'],
            ['mix-today', 'Today-first'],
            ['mix-dense', 'Dense'],
          ].map(([s, n], i) => (
            <span key={s}>
              {i > 0 && ' · '}
              <Link
                href={`/preview/dashboard/${s}`}
                style={{
                  color: 'inherit',
                  textDecoration: 'none',
                  fontWeight: name.includes(n as string) ? 600 : 400,
                }}
              >{n}</Link>
            </span>
          ))}
        </span>
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

export function SideDock() {
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

export function BottomDock() {
  return (
    <div className="md:hidden" style={{
      position: 'fixed', bottom: 16, left: '50%',
      transform: 'translateX(-50%)', zIndex: 50,
      background: C.surface, borderRadius: 16, padding: 6,
      border: `1px solid ${C.lineStrong}`,
      boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5)',
      display: 'flex', gap: 4,
    }}>
      {[
        { icon: '◇', label: 'الرئيسية', active: true },
        { icon: '▢', label: 'المشاريع' },
        { icon: '✉', label: 'الوارد' },
        { icon: '▦', label: 'التقويم' },
        { icon: '☰', label: 'المزيد' },
      ].map((i) => (
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

/** Smart card with optional drag handle, badge, eyebrow. */
export function Card({
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
      borderRadius: 12, padding: 14,
    }}>
      {(title || eyebrow || badge) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          {eyebrow && (
            <span style={{
              fontSize: 9, padding: '2px 6px', borderRadius: 3,
              background: C.accent + '20', color: C.accent,
              fontWeight: 600, letterSpacing: '0.04em',
            }}>{eyebrow}</span>
          )}
          {title && <h3 style={{ fontSize: 12, fontWeight: 600 }}>{title}</h3>}
          {badge && (
            <span style={{
              marginInlineStart: 'auto',
              fontSize: 10, padding: '2px 7px', borderRadius: 4,
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
