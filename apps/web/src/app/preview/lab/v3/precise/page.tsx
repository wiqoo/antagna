import Link from 'next/link';
import { ArrowLeft, Sparkles, Search } from 'lucide-react';

export default function PreciseDashboard() {
  return (
    <div className="min-h-screen bg-[#0F0F12] text-white">
      <div className="mx-auto max-w-[1280px] px-6 py-8 md:px-8 md:py-10">
        <Link
          href="/preview/lab/v3"
          className="mb-6 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-white/45 hover:text-white"
        >
          <ArrowLeft size={12} className="rtl:rotate-180" />
          العودة
        </Link>

        {/* Top status bar */}
        <header className="mb-8 flex items-center justify-between border-b border-white/10 pb-3 font-mono text-[11px]">
          <div className="flex items-center gap-3">
            <span className="text-white">Antagna</span>
            <span className="text-white/30">/</span>
            <span className="text-white/65">dashboard</span>
            <span className="ms-3 inline-flex items-center gap-1.5 text-white/40">
              <span className="h-1.5 w-1.5 rounded-full bg-[#FF6B1A]" />
              live
            </span>
          </div>
          <div className="flex items-center gap-4 text-white/45">
            <span>FRI 22.05 · 16:42</span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-white/12 px-1.5 py-0.5 text-white/65">
              <Search size={10} />
              <kbd className="text-[9px]">⌘K</kbd>
            </span>
          </div>
        </header>

        {/* Brief — terse */}
        <section className="mb-8">
          <div className="mb-4 flex items-baseline gap-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#FF6B1A]">
              # ai_brief
            </span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-white/40">
              ٣ نقاط · ١ urgent
            </span>
          </div>
          <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.015em] text-white md:text-[32px]">
            مرحباً Mohammed — يوم ضغط على التسليم.
          </h1>
          <ul className="mt-5 divide-y divide-white/8 rounded-md border border-white/10">
            {[
              ['01', 'PRJ-0005', 'رولز رويس — تسليم ٣ أيام، إنجاز ٤٥٪', 'urgent'],
              ['02', 'BMW-thread', 'إيميل متأخر ٥٢ ساعة، الـ draft جاهز', 'pending'],
              ['03', 'CAPACITY', 'خالد على ٣ مشاريع — وزّع MG لفادي', 'plan'],
            ].map(([num, ref, text, tag]) => (
              <li key={num as string} className="grid grid-cols-[36px_1fr_auto] items-center gap-4 px-4 py-3 hover:bg-white/[0.02]">
                <span className={'font-mono text-[11px] ' + ((tag as string) === 'urgent' ? 'text-[#FF6B1A]' : 'text-white/35')}>
                  {num as string}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] text-white/90">{text as string}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-white/40">{ref as string}</p>
                </div>
                <span className={
                  'rounded-sm border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ' +
                  ((tag as string) === 'urgent'
                    ? 'border-[#FF6B1A]/40 text-[#FF6B1A]'
                    : 'border-white/15 text-white/55')
                }>
                  {tag as string}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center gap-3 text-[11px]">
            <button className="inline-flex items-center gap-1.5 rounded-sm border border-[#FF6B1A] px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-[#FF6B1A] hover:bg-[#FF6B1A]/10">
              <Sparkles size={10} />
              refresh
            </button>
            <span className="font-mono text-white/35">updated 4m ago</span>
          </div>
        </section>

        {/* Metrics row — terminal style */}
        <section className="mb-8 grid grid-cols-2 gap-px border border-white/10 bg-white/8 md:grid-cols-4">
          <TermMetric label="revenue.mtd" v="410,232" unit="SAR" delta="+18%" />
          <TermMetric label="projects.active" v="12" delta="+2" />
          <TermMetric label="email.awaiting_us" v="8" delta="+1" warning />
          <TermMetric label="leads.hot" v="4" delta="—" />
        </section>

        {/* Two columns: data table + sparkline column */}
        <section className="grid grid-cols-1 gap-6 md:grid-cols-[1.4fr_1fr]">
          {/* Shoots table */}
          <div className="overflow-hidden rounded-md border border-white/10">
            <header className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-4 py-2.5 font-mono text-[11px]">
              <span className="text-white/65">// upcoming_shoots</span>
              <span className="text-white/35">4 / 14d</span>
            </header>
            <table className="w-full">
              <thead className="border-b border-white/8 text-[9px] uppercase tracking-[0.16em] text-white/40">
                <tr>
                  <th className="px-4 py-2 text-start">when</th>
                  <th className="px-4 py-2 text-start">project</th>
                  <th className="px-4 py-2 text-start">city</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8 text-[12px]">
                {[
                  ['اليوم 21:33', 'جولة الشوروم — MG', 'الرياض', true],
                  ['غداً 09:00', 'BMW Summer', 'جدة', false],
                  ['الأحد 10:00', 'Rolls Royce interior', 'الرياض', false],
                  ['الإثنين 07:30', 'لكزس LX social', 'جدة', false],
                ].map(([when, title, city, isToday]) => (
                  <tr key={(when as string) + (title as string)} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5">
                      <span className={'font-mono ' + ((isToday as boolean) ? 'text-[#FF6B1A]' : 'text-white/75')}>
                        {when as string}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-white/90">{title as string}</td>
                    <td className="px-4 py-2.5 text-white/55">{city as string}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Capacity + status panel */}
          <div className="space-y-4">
            <div className="overflow-hidden rounded-md border border-white/10">
              <header className="border-b border-white/10 bg-white/[0.03] px-4 py-2.5 font-mono text-[11px] text-white/65">
                // team.load (14d)
              </header>
              <div className="p-4 space-y-2 text-[11px]">
                {[
                  ['khalid', 4, true],
                  ['reem', 3, false],
                  ['fadi', 2, false],
                  ['hamada', 1, false],
                  ['adam', 0, false],
                ].map(([name, load, over]) => (
                  <div key={name as string} className="flex items-center gap-3">
                    <span className="w-16 font-mono text-white/55">{name as string}</span>
                    <div className="flex-1">
                      <Bar value={load as number} max={5} accent={over as boolean} />
                    </div>
                    <span className="font-mono text-white/45">{load as number}/5</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-md border border-white/10">
              <header className="border-b border-white/10 bg-white/[0.03] px-4 py-2.5 font-mono text-[11px] text-white/65">
                // system.health
              </header>
              <ul className="divide-y divide-white/8 text-[11px]">
                {[
                  ['gmail.token', 'ok', '25d left'],
                  ['drive.token', 'warn', '52h left'],
                  ['whatsapp', 'ok', 'connected'],
                  ['trigger', 'ok', '11 tasks'],
                ].map(([k, status, note]) => (
                  <li key={k as string} className="flex items-center justify-between px-4 py-2 font-mono">
                    <span className="text-white/65">{k as string}</span>
                    <span className="flex items-center gap-2">
                      <span className={'h-1.5 w-1.5 rounded-full ' + ((status as string) === 'ok' ? 'bg-white/85' : 'bg-[#FF6B1A]')} />
                      <span className="text-white/45">{note as string}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Activity log */}
        <section className="mt-8 overflow-hidden rounded-md border border-white/10">
          <header className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-4 py-2.5 font-mono text-[11px]">
            <span className="text-white/65">// activity.live</span>
            <span className="inline-flex items-center gap-1.5 text-white/45">
              <span className="h-1 w-1 animate-pulse rounded-full bg-[#FF6B1A]" />
              streaming
            </span>
          </header>
          <ul className="divide-y divide-white/8 font-mono text-[11px]">
            {[
              ['16:38:12', 'PRJ-0006', 'khalid → delivered: bmw.summer.cut.v3'],
              ['16:21:04', 'DEL-0012', 'reem → approved: reel_07'],
              ['15:58:33', 'EMAIL', 'sent → lexus.sa.contact'],
              ['15:34:51', 'TASK-0089', 'created by fadi'],
              ['14:45:18', 'EQ-0001', 'reserved canon.r5 for sun'],
              ['14:22:00', 'GMAIL', 'ai summarized 7 threads'],
            ].map(([time, ref, what]) => (
              <li key={(time as string) + (ref as string)} className="grid grid-cols-[88px_120px_1fr] gap-4 px-4 py-2 hover:bg-white/[0.02]">
                <span className="text-white/40">{time as string}</span>
                <span className="text-[#FF6B1A]">{ref as string}</span>
                <span className="text-white/80">{what as string}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function TermMetric({
  label,
  v,
  unit,
  delta,
  warning,
}: {
  label: string;
  v: string;
  unit?: string;
  delta: string;
  warning?: boolean;
}) {
  return (
    <div className="bg-[#0F0F12] p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-mono text-[24px] font-semibold tracking-tight text-white">{v}</span>
        {unit && <span className="font-mono text-[10px] text-white/45">{unit}</span>}
      </div>
      <p className={'mt-1 font-mono text-[10px] ' + (warning ? 'text-[#FF6B1A]' : 'text-white/45')}>
        {delta}
      </p>
    </div>
  );
}

function Bar({ value, max, accent }: { value: number; max: number; accent?: boolean }) {
  return (
    <div className="h-1 overflow-hidden rounded-sm bg-white/8">
      <div
        className={'h-full ' + (accent ? 'bg-[#FF6B1A]' : 'bg-white/70')}
        style={{ width: `${(value / max) * 100}%` }}
      />
    </div>
  );
}
