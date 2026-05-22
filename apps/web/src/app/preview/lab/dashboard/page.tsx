import Link from 'next/link';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function DashboardLab() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto max-w-[1300px] px-6 py-10 md:px-8 md:py-14">
        <Link
          href="/preview/lab"
          className="mb-6 inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
        >
          <ArrowLeft size={13} className="rtl:rotate-180" />
          العودة
        </Link>
        <header className="mb-10 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
            القسم ٦ — تخطيط الداش بورد
          </p>
          <h1 className="text-[32px] font-bold tracking-[-0.02em]" style={{ fontFamily: 'var(--font-display)' }}>
            ٤ تصميمات بديلة
          </h1>
          <p className="max-w-2xl text-[13px] leading-relaxed text-[var(--text-muted)]">
            الحالي 12-col masonry. الـ research بيقول zone-based (Today/Pipeline/Insights) أو
            magazine layout أحسن لـ ops UI كثيف. كل خيار هنا mock-up للهيكل العام.
          </p>
        </header>

        {/* Option 1 — current */}
        <Variant tag="١ — Masonry 12-col (الحالي)" subtitle="grid 12 عمود مع spans متغيّرة. مرن بس مش regimented.">
          <MockLayout>
            <div className="col-span-12 h-20 rounded-md border border-[var(--accent)]/30 bg-[var(--accent-tint)]" />
            <div className="col-span-4 h-24 rounded-md bg-[var(--surface)]" />
            <div className="col-span-4 h-24 rounded-md bg-[var(--surface)]" />
            <div className="col-span-4 h-24 rounded-md bg-[var(--surface)]" />
            <div className="col-span-6 h-28 rounded-md bg-[var(--surface)]" />
            <div className="col-span-6 h-28 rounded-md bg-[var(--surface)]" />
            <div className="col-span-3 h-16 rounded-md bg-[var(--surface)]" />
            <div className="col-span-3 h-16 rounded-md bg-[var(--surface)]" />
            <div className="col-span-3 h-16 rounded-md bg-[var(--surface)]" />
            <div className="col-span-3 h-16 rounded-md bg-[var(--surface)]" />
          </MockLayout>
        </Variant>

        {/* Option 2 — zones */}
        <Variant
          tag="٢ — Zones (موصى به)"
          recommended
          subtitle="٤ مناطق بأسماء واضحة: اليوم / الـ Pipeline / Insights / الصحة. كل منطقة grid مستقل."
        >
          <div className="space-y-3">
            <Zone label="١. الـ Hero — AI Brief">
              <div className="h-16 rounded-md border border-[var(--accent)]/30 bg-[var(--accent-tint)]" />
            </Zone>
            <Zone label="٢. اليوم — Today (shoots, meetings, due tasks)">
              <div className="grid grid-cols-4 gap-2">
                <div className="h-14 rounded-md bg-[var(--surface)]" />
                <div className="h-14 rounded-md bg-[var(--surface)]" />
                <div className="h-14 rounded-md bg-[var(--surface)]" />
                <div className="h-14 rounded-md bg-[var(--surface)]" />
              </div>
            </Zone>
            <Zone label="٣. الـ Pipeline — مشاريع، موافقات، تسليمات قريبة">
              <div className="grid grid-cols-3 gap-2">
                <div className="h-24 rounded-md bg-[var(--surface)]" />
                <div className="h-24 rounded-md bg-[var(--surface)]" />
                <div className="h-24 rounded-md bg-[var(--surface)]" />
              </div>
            </Zone>
            <Zone label="٤. Insights — إيراد، AI cost، email health">
              <div className="grid grid-cols-3 gap-2">
                <div className="h-20 rounded-md bg-[var(--surface)]" />
                <div className="h-20 rounded-md bg-[var(--surface)]" />
                <div className="h-20 rounded-md bg-[var(--surface)]" />
              </div>
            </Zone>
            <Zone label="٥. Health — معدات، OAuth tokens، system alerts">
              <div className="grid grid-cols-4 gap-2">
                <div className="h-14 rounded-md bg-[var(--surface)]" />
                <div className="h-14 rounded-md bg-[var(--surface)]" />
                <div className="h-14 rounded-md bg-[var(--surface)]" />
                <div className="h-14 rounded-md bg-[var(--surface)]" />
              </div>
            </Zone>
          </div>
        </Variant>

        {/* Option 3 — hero + rail */}
        <Variant
          tag="٣ — Hero + Rail (sidebar)"
          subtitle="Hero ضخم على اليمين (٧٠٪ من العرض) + rail جانبي ٣٠٪ لـ stats سريعة. Linear pattern."
        >
          <MockLayout className="!grid-cols-3">
            <div className="col-span-2 h-40 rounded-md border border-[var(--accent)]/30 bg-[var(--accent-tint)]" />
            <div className="col-span-1 grid gap-2">
              <div className="h-12 rounded-md bg-[var(--surface)]" />
              <div className="h-12 rounded-md bg-[var(--surface)]" />
              <div className="h-12 rounded-md bg-[var(--surface)]" />
            </div>
            <div className="col-span-2 grid grid-cols-2 gap-2">
              <div className="h-24 rounded-md bg-[var(--surface)]" />
              <div className="h-24 rounded-md bg-[var(--surface)]" />
              <div className="h-24 rounded-md bg-[var(--surface)]" />
              <div className="h-24 rounded-md bg-[var(--surface)]" />
            </div>
            <div className="col-span-1 grid gap-2">
              <div className="h-24 rounded-md bg-[var(--surface)]" />
              <div className="h-24 rounded-md bg-[var(--surface)]" />
            </div>
          </MockLayout>
        </Variant>

        {/* Option 4 — command center */}
        <Variant
          tag="٤ — Command Center"
          subtitle="strip ضخم فوق فيه ٤-٦ KPI كبيرة، تحت 2-col محتوى تفصيلي. Notion dashboards pattern."
        >
          <div className="space-y-3">
            <div className="grid grid-cols-5 gap-2">
              <div className="h-16 rounded-md border border-[var(--accent)]/30 bg-[var(--accent-tint)]" />
              <div className="h-16 rounded-md bg-[var(--surface)]" />
              <div className="h-16 rounded-md bg-[var(--surface)]" />
              <div className="h-16 rounded-md bg-[var(--surface)]" />
              <div className="h-16 rounded-md bg-[var(--surface)]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <div className="h-28 rounded-md bg-[var(--surface)]" />
                <div className="h-28 rounded-md bg-[var(--surface)]" />
                <div className="h-28 rounded-md bg-[var(--surface)]" />
              </div>
              <div className="grid gap-2">
                <div className="h-44 rounded-md bg-[var(--surface)]" />
                <div className="h-44 rounded-md bg-[var(--surface)]" />
              </div>
            </div>
          </div>
        </Variant>

        <div className="mt-10 rounded-xl border border-[var(--accent)]/25 bg-[var(--accent-tint)] p-5">
          <p className="text-[12px] text-[var(--text)]">
            قولي رقم الخيار. الـ "Zones" هي الموصى بها لأنها بتمزج بين الكثافة والقدرة على
            التنظيم — وكل zone قابلة للتخصيص لوحدها.
          </p>
        </div>
      </div>
    </div>
  );
}

function Variant({
  tag,
  subtitle,
  recommended,
  children,
}: {
  tag: string;
  subtitle: string;
  recommended?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <header className="mb-3">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
            {tag}
          </p>
          {recommended && (
            <span className="inline-flex items-center gap-1 rounded-md bg-[var(--accent-tint)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
              <CheckCircle2 size={10} /> موصى به
            </span>
          )}
        </div>
        <p className="mt-1 text-[12px] text-[var(--text-muted)]">{subtitle}</p>
      </header>
      <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-elevated)]/40 p-4">
        {children}
      </div>
    </section>
  );
}

function MockLayout({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={'grid grid-cols-12 gap-2 ' + className}>{children}</div>;
}

function Zone({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
        {label}
      </p>
      {children}
    </div>
  );
}
