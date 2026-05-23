import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { CARD_CATALOG } from '../cards';

const GROUPS = ['AI Heavy', 'AI Medium', 'AI Light', 'No AI'] as const;

export default function V5Library() {
  return (
    <div className="min-h-screen bg-[#0F0F12] text-white">
      <div className="mx-auto max-w-[1400px] px-6 py-10 md:px-8 md:py-14">
        <Link
          href="/preview/lab/v5"
          className="mb-8 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-white/45 hover:text-white"
        >
          <ArrowLeft size={12} className="rtl:rotate-180" />
          العودة
        </Link>

        <header className="mb-10 max-w-3xl">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.32em] text-[#FF6B1A]">
            — Library · 28 cards
          </p>
          <h1
            className="text-[40px] font-bold leading-[1.05] tracking-[-0.02em]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            مكتبة الكروت الكاملة
          </h1>
          <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-white/65">
            كل كرت معاه AI level مختلف، ومعروض في حجمه الافتراضي. الكرت اللي عليه شريط برتقالي فوق
            = AI داخله. كثافة الشريط = كثافة الـ AI.
          </p>

          {/* Legend */}
          <div className="mt-5 flex flex-wrap items-center gap-4 text-[11px] text-white/65">
            <Legend color="#FF6B1A" label="AI Heavy — الكرت كله AI" />
            <Legend color="rgba(255,107,26,0.6)" label="AI Medium — AI يثري البيانات" />
            <Legend color="rgba(255,107,26,0.3)" label="AI Light — AI يلوّن metric" />
            <Legend color="transparent" label="No AI — بيانات مباشرة" />
          </div>
        </header>

        {GROUPS.map((group) => {
          const cards = CARD_CATALOG.filter((c) => c.group === group);
          if (cards.length === 0) return null;
          return (
            <section key={group} className="mb-14">
              <header className="mb-4 flex items-baseline justify-between border-b border-white/[0.06] pb-3">
                <h2
                  className="text-[20px] font-bold tracking-[-0.015em]"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {group}
                </h2>
                <span className="font-mono text-[11px] text-white/45">
                  {cards.length} كرت
                </span>
              </header>

              <div className="grid grid-cols-12 gap-3">
                {cards.map((c) => {
                  const Component = c.component as React.ComponentType<{
                    size?: typeof c.defaultSize;
                  }>;
                  return (
                    <div key={c.id} className="col-span-12 md:col-span-6 lg:col-span-4 space-y-2">
                      <div className="px-1 text-[11px] text-white/55">
                        <span className="font-mono text-[10px] text-white/35">#{c.id}</span>
                        <span className="ms-2">{c.desc}</span>
                      </div>
                      <div className="grid grid-cols-12 gap-0">
                        <Component size="full" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        <div className="mt-10 rounded-xl border border-[#FF6B1A]/30 bg-[#FF6B1A]/[0.05] p-5">
          <p className="text-[12px] text-white/85">
            <Sparkles size={11} className="me-1.5 inline text-[#FF6B1A]" />
            قولي الكروت اللي عاجبتك (بالأرقام أو الأسماء). أضيفها للداش بورد الإنتاج + الـ customize
            drawer.
          </p>
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-0.5 w-6 rounded-full"
        style={{ background: color, border: color === 'transparent' ? '1px dashed rgba(255,255,255,0.15)' : 'none' }}
      />
      <span>{label}</span>
    </span>
  );
}
