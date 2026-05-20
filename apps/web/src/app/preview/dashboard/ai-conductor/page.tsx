import Link from 'next/link';
import { FRAME_COLORS as C } from '../../frame-shared';

export const dynamic = 'force-static';

export default function AIConductorDashboard() {
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
        <span style={{ fontWeight: 500 }}>AI Conductor · Claude-led</span>
      </div>

      <main style={{ maxWidth: 920, margin: '0 auto', padding: '48px 24px' }}>
        {/* Greeting */}
        <p style={{ fontSize: 11, color: C.muted, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
          Antagna AI · الأربعاء، ٢١ مايو
        </p>
        <h1 style={{
          fontSize: 44, fontWeight: 700, lineHeight: 1.15,
          letterSpacing: '-0.02em', marginBottom: 16,
          fontFamily: 'var(--font-arabic-display)',
        }}>
          صباح الخير محمد — <span style={{
            background: C.gradient,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>وقتك ثمين</span>
        </h1>
        <p style={{ fontSize: 17, color: C.muted, lineHeight: 1.6, marginBottom: 36 }}>
          راجعت كل أنشطة Volt منذ آخر مرة فتحت Antagna (منذ ١٤ ساعة).
          الكلام في أربعة أشياء بس تستحق وقتك النهارده.
        </p>

        {/* AI Conversation thread */}
        <div style={{ marginBottom: 32 }}>
          {/* Claude */}
          <Message author="Claude" accent>
            <p style={{ fontSize: 16, fontWeight: 500, marginBottom: 12 }}>
              لاحظت ٣ مشاكل و فرصة واحدة. هل أرتبهم بالأولوية؟
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[
                'نعم رتّبهم',
                'وريني المشاكل فقط',
                'الفرصة الأول',
                'كل التفاصيل',
              ].map((q) => (
                <button key={q} style={{
                  padding: '6px 12px', borderRadius: 6,
                  background: 'transparent',
                  border: `1px solid ${C.accent}40`,
                  color: C.accent, fontSize: 12,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>{q}</button>
              ))}
            </div>
          </Message>

          {/* User */}
          <Message author="You" mine>
            رتّبهم بالأولوية
          </Message>

          {/* Claude — bulleted answer with inline actions */}
          <Message author="Claude" accent>
            <ol style={{ paddingInlineStart: 20, margin: 0 }}>
              <li style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 15, fontWeight: 500 }}>
                  <strong style={{ color: C.accent }}>PR-0007 متوقف ٥ أيام في brief</strong> — العميل (MTN) ما ردش على إيميل البرِيف. الـ shoot date بعد ٥ أيام.
                </p>
                <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
                  أنا اقترح: ابعت reminder الآن، و لو ما رديش خلال ٢٤ ساعة أحوّله لـ on-hold.
                </p>
                <ActionRow>
                  <Action primary>ابعت reminder الآن</Action>
                  <Action>افتح المشروع</Action>
                  <Action>أجّل القرار</Action>
                </ActionRow>
              </li>
              <li style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 15, fontWeight: 500 }}>
                  <strong style={{ color: C.accent }}>PR-0010 تسليم خلال ٣ أيام، ٦٠٪ فقط</strong> — Khaled على ١٤٠٪ load. مش هيلحق.
                </p>
                <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
                  ممكن أحوّل ٢ من مهامه (الـ color + sound) لـ Mohsen اللي عنده ٥٠٪ load.
                </p>
                <ActionRow>
                  <Action primary>نفّذ التحويل</Action>
                  <Action>وريني المهام أولاً</Action>
                  <Action>لا، خلّيها على Khaled</Action>
                </ActionRow>
              </li>
              <li style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 15, fontWeight: 500 }}>
                  <strong style={{ color: C.accent }}>Sony FX3 محجوزة لـ مشروعين</strong> يوم الأربعاء — PR-0009 و PR-0007.
                </p>
                <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
                  بما أن PR-0007 في brief بعد، اقترح: الـ FX3 للـ shoot الـ ٠٩، و الـ FX6 (متاحة) لـ PR-0007.
                </p>
                <ActionRow>
                  <Action primary>حلّ التعارض</Action>
                  <Action>افتح Calendar</Action>
                </ActionRow>
              </li>
              <li>
                <p style={{ fontSize: 15, fontWeight: 500 }}>
                  <strong style={{ color: '#34D399' }}>فرصة:</strong> WPP أرسل lead بـ ٨٠K تقديري. درجة الحرارة ٧٨/١٠٠.
                </p>
                <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
                  بناءً على history WPP (٣ مشاريع سابقة، متوسط ٧٥K)، Lead القوة عالية. اقترح: proposal اليوم.
                </p>
                <ActionRow>
                  <Action primary>أنشئ proposal</Action>
                  <Action>افتح الـ lead</Action>
                </ActionRow>
              </li>
            </ol>
          </Message>

          {/* Input */}
          <div style={{
            marginTop: 24,
            padding: 16,
            background: C.surface,
            border: `1px solid ${C.lineStrong}`,
            borderRadius: 12,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <textarea
              placeholder="اسأل Claude أي حاجة عن Volt… (مثال: ما الـ KPI الأسوأ هذا الشهر؟)"
              rows={1}
              style={{
                flex: 1, background: 'transparent', border: 'none',
                color: C.text, fontSize: 14, fontFamily: 'inherit',
                resize: 'none', outline: 'none',
              }}
            />
            <button style={{
              padding: '8px 14px', borderRadius: 8,
              background: C.gradient, color: '#fff', border: 'none',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>↗ اسأل</button>
          </div>
        </div>

        {/* Tiny context — small KPIs at the bottom */}
        <div style={{
          padding: '20px 24px',
          background: C.surface,
          borderRadius: 12,
          marginTop: 36,
        }}>
          <p style={{ fontSize: 10, color: C.dim, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 12 }}>
            في الخلفية الآن
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {[
              ['نشطة', 12], ['تسليم اليوم', 3],
              ['MTD', '145K'], ['الفريق', '6/11 شغّال'],
            ].map(([l, v]) => (
              <div key={l as string}>
                <p style={{ fontSize: 10, color: C.dim }}>{l as string}</p>
                <p style={{ fontSize: 18, fontWeight: 600, marginTop: 2, fontFamily: 'var(--font-arabic-display)' }}>{v as string | number}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function Message({ author, accent, mine, children }: { author: string; accent?: boolean; mine?: boolean; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', gap: 12,
      marginBottom: 16,
      flexDirection: mine ? 'row-reverse' : 'row',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: mine ? '#34D399' : accent ? C.gradient : C.surface2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, color: '#fff',
        flexShrink: 0,
      }}>{mine ? 'M' : 'C'}</div>
      <div style={{
        flex: 1, maxWidth: mine ? '60%' : '100%',
        background: mine ? C.surface2 : 'transparent',
        padding: mine ? '10px 14px' : 0,
        borderRadius: mine ? 12 : 0,
        fontSize: mine ? 13 : 'inherit',
      }}>
        {children}
      </div>
    </div>
  );
}

function ActionRow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>{children}</div>
  );
}

function Action({ primary, children }: { primary?: boolean; children: React.ReactNode }) {
  return (
    <button style={{
      padding: '5px 12px', borderRadius: 6,
      background: primary ? C.accent : 'transparent',
      border: `1px solid ${primary ? C.accent : C.line}`,
      color: primary ? '#fff' : C.muted,
      fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
      fontWeight: primary ? 600 : 400,
    }}>{children}</button>
  );
}
