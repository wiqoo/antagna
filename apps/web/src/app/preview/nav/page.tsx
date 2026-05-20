import Link from 'next/link';

export const dynamic = 'force-static';

const OPTIONS = [
  {
    slug: 'icon',
    name: 'Icon Bar — 64px',
    nameAr: 'شريط أيقونات صغير',
    desc: 'Frame.io الكلاسيك: شريط رفيع 64px بأيقونات فقط على جنب الشاشة. أكتر مساحة للمحتوى.',
    pros: ['أوفر مساحة', 'أنيق و مكثّف', 'مناسب video work'],
    cons: ['أيقونات بس بدون تسميات', 'يحتاج هوفر لمعرفة اسم القسم'],
  },
  {
    slug: 'expanded',
    name: 'Expanded Sidebar — 240px',
    nameAr: 'قائمة جانبية كاملة',
    desc: 'قائمة عريضة بأيقونة + تسمية + grouping. الأكثر وضوحاً، مناسبة للفرق الجديدة.',
    pros: ['كل شيء ظاهر', 'تنظيم واضح بـ sections', 'أسرع تعلّماً'],
    cons: ['ياخد مساحة من المحتوى', 'بيبان "ثقيل" مع كل الـ items'],
  },
  {
    slug: 'hover',
    name: 'Hover-expand — Linear style',
    nameAr: 'يتوسّع بالـ hover',
    desc: 'يبدأ 64px أيقونات، ينفتح لـ 240px عند الـ hover. أفضل الـ trade-offs.',
    pros: ['مساحة عند الحاجة فقط', 'تفاصيل عند الـ hover', 'Linear/Vercel pattern'],
    cons: ['يحتاج JS', 'مش واضح للمستخدمين الجدد'],
  },
  {
    slug: 'top',
    name: 'Top Horizontal Nav',
    nameAr: 'قائمة علوية أفقية',
    desc: 'بدون sidebar — كل التنقّل في شريط علوي. مساحة عرض كاملة للمحتوى.',
    pros: ['أوسع content area', 'مألوف من websites', 'مناسب للوحات تحليلية'],
    cons: ['أقل items يمكن عرضها', 'يحتاج dropdown للـ sub-nav'],
  },
  {
    slug: 'dock',
    name: 'Bottom Dock — Mobile-first',
    nameAr: 'شريط سفلي (موبايل)',
    desc: 'شريط في أسفل الشاشة بـ 5 أيقونات أساسية. أفضل للموبايل، ممكن يفضل ظاهر على الديسكتوب.',
    pros: ['ممتاز للموبايل', 'يد واحدة', 'سريع و مألوف'],
    cons: ['5 خيارات بس مرئية', 'الباقي خلف "More"'],
  },
];

export default function NavIndex() {
  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100vh',
        background: '#0F0F12',
        color: '#fff',
        fontFamily: 'var(--font-arabic), system-ui',
        padding: '4rem 1.5rem',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <Link href="/preview" style={{ color: '#FF6B1A', fontSize: 12, textDecoration: 'none' }}>
          ← كل المعاينات
        </Link>
        <p style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#888', marginTop: 24, marginBottom: 12 }}>
          Frame.io · Navigation Patterns
        </p>
        <h1 style={{
          fontSize: 48, fontWeight: 700, lineHeight: 1.1,
          letterSpacing: '-0.02em', marginBottom: 12,
          background: 'linear-gradient(135deg, #FF6B1A, #FF8442)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          fontFamily: 'var(--font-arabic-display)',
        }}>
          أسلوب القائمة
        </h1>
        <p style={{ fontSize: 16, color: '#aaa', maxWidth: 640, lineHeight: 1.6 }}>
          ٥ معماريات مختلفة للتنقل — جميعها بنفس الـ Frame.io content (orange الآن).
          افتح كل واحدة وقُل أي pattern يناسب طريقتك في الشغل.
        </p>

        <div style={{
          marginTop: 48,
          display: 'grid',
          gap: 14,
          gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
        }}>
          {OPTIONS.map((o) => (
            <Link
              key={o.slug}
              href={`/preview/nav/${o.slug}`}
              style={{
                display: 'block',
                background: '#17171C',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12,
                padding: 24,
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <p style={{ fontSize: 11, color: '#888', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
                {o.name}
              </p>
              <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 10 }}>
                {o.nameAr}
              </h2>
              <p style={{ fontSize: 13, color: '#aaa', lineHeight: 1.6, marginBottom: 14 }}>
                {o.desc}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 11 }}>
                <div>
                  <p style={{ color: '#34D399', marginBottom: 4, fontWeight: 600 }}>✓ ميزات</p>
                  {o.pros.map((p) => (
                    <p key={p} style={{ color: '#bbb', marginBottom: 2 }}>· {p}</p>
                  ))}
                </div>
                <div>
                  <p style={{ color: '#FB923C', marginBottom: 4, fontWeight: 600 }}>⚠ ملاحظات</p>
                  {o.cons.map((c) => (
                    <p key={c} style={{ color: '#bbb', marginBottom: 2 }}>· {c}</p>
                  ))}
                </div>
              </div>
              <p style={{ marginTop: 16, fontSize: 13, color: '#FF6B1A', fontWeight: 500 }}>
                افتح المعاينة ←
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
