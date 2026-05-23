import Link from 'next/link';
import {
  ArrowLeft, Search, Bell, Settings, ChevronDown, Sparkles, Filter,
  Grid3x3, List, Star, Plus, Briefcase, Inbox, ListChecks, Calendar,
  Users, Camera, BarChart3, Activity, Circle, MoreHorizontal,
  Film, Play, MessageSquare, GripVertical,
} from 'lucide-react';

export default function WorkbenchDashboard() {
  return (
    <div className="min-h-screen bg-[#0A0A0D] font-sans text-white">
      {/* macOS-style chrome bar */}
      <div className="flex h-9 items-center gap-3 border-b border-white/[0.06] bg-[#0F0F12] px-3">
        {/* Window controls */}
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#1f1f24]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#1f1f24]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#1f1f24]" />
        </div>
        {/* Breadcrumb */}
        <div className="ms-2 flex items-center gap-1.5 font-mono text-[11px]">
          <span className="text-white/40">Antagna</span>
          <span className="text-white/20">/</span>
          <span className="text-white/65">Workspace</span>
          <span className="text-white/20">/</span>
          <span className="text-white">Dashboard</span>
        </div>
        <div className="ms-auto flex items-center gap-3">
          {/* Status indicators */}
          <span className="flex items-center gap-1.5 text-[10px] text-white/45">
            <span className="h-1.5 w-1.5 rounded-full bg-[#FF6B1A]" />
            <span className="font-mono">live</span>
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-white/45">
            <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
            <span className="font-mono">sync OK</span>
          </span>
          {/* CMD+K */}
          <div className="flex items-center gap-1.5 rounded border border-white/[0.08] bg-white/[0.02] px-2 py-0.5">
            <Search size={10} className="text-white/40" />
            <span className="font-mono text-[10px] text-white/45">⌘K</span>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-2.25rem)]">
        {/* LEFT RAIL — workspace nav */}
        <aside className="hidden w-[200px] shrink-0 flex-col border-e border-white/[0.06] bg-[#0F0F12] md:flex">
          <div className="p-3">
            <Link
              href="/preview/lab/v3"
              className="mb-3 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-white/35 hover:text-white"
            >
              <ArrowLeft size={10} className="rtl:rotate-180" />
              العودة
            </Link>

            {/* Workspace switcher */}
            <button className="flex w-full items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.02] px-2 py-1.5 hover:bg-white/[0.04]">
              <span
                className="grid h-5 w-5 place-items-center rounded text-[10px] font-bold text-black"
                style={{ background: '#FF6B1A' }}
              >
                V
              </span>
              <span className="flex-1 text-start text-[12px] font-medium">Volt Production</span>
              <ChevronDown size={11} className="text-white/40" />
            </button>
          </div>

          <NavSection label="Workspace">
            <RailItem icon={Briefcase} label="مشاريع" badge="12" active />
            <RailItem icon={Film} label="لقطات" badge="4" />
            <RailItem icon={Inbox} label="الوارد" badge="8" dot />
            <RailItem icon={ListChecks} label="المهام" />
            <RailItem icon={Calendar} label="التقويم" />
          </NavSection>

          <NavSection label="People & Assets">
            <RailItem icon={Users} label="الفريق" />
            <RailItem icon={Camera} label="المعدات" />
          </NavSection>

          <NavSection label="Insights">
            <RailItem icon={BarChart3} label="KPIs" />
            <RailItem icon={Activity} label="Activity" />
          </NavSection>

          <div className="mt-auto border-t border-white/[0.06] p-3">
            <RailItem icon={Settings} label="الإعدادات" />
            <div className="mt-2 flex items-center gap-2 rounded-md p-1.5">
              <span
                className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold text-black"
                style={{ background: '#FF6B1A' }}
              >
                M
              </span>
              <span className="text-[11px] text-white/85">Mohammed</span>
              <MoreHorizontal size={11} className="ms-auto text-white/35" />
            </div>
          </div>
        </aside>

        {/* MAIN — workbench */}
        <main className="flex-1 overflow-y-auto">
          {/* Top filter bar — Frame.io style */}
          <div className="sticky top-0 z-10 flex h-11 items-center gap-2 border-b border-white/[0.06] bg-[#0F0F12]/95 px-4 backdrop-blur-md">
            <h1 className="font-mono text-[13px] font-semibold text-white">dashboard</h1>
            <span className="text-[10px] text-white/30">·</span>
            <span className="font-mono text-[10px] text-white/45">FRI · 22.05 · 16:42</span>
            <div className="ms-auto flex items-center gap-1">
              <ToolButton icon={Filter} label="فلتر" />
              <ToolButton icon={Star} label="مثبّت" />
              <ToolButton icon={Grid3x3} active />
              <ToolButton icon={List} />
              <span className="mx-1 h-4 w-px bg-white/[0.08]" />
              <button className="inline-flex items-center gap-1.5 rounded-md bg-[#FF6B1A] px-2.5 py-1 text-[11px] font-semibold text-black hover:bg-[#FF8442]">
                <Plus size={11} />
                مشروع
              </button>
            </div>
          </div>

          {/* HUD strip — 4 metrics, very small */}
          <div className="grid grid-cols-4 border-b border-white/[0.06]">
            <Hud label="revenue.mtd" value="410.2" unit="K SAR" delta="+18%" sparkUp />
            <Hud label="projects.active" value="12" delta="+2 this week" />
            <Hud label="email.awaiting_us" value="8" delta="2 over 72h" warning />
            <Hud label="capacity.over" value="1" unit="من ٧" delta="خالد" warning last />
          </div>

          {/* Two-column workbench: shoot browser + AI inspector */}
          <div className="grid grid-cols-[1fr,340px]">
            {/* Center — shoot/project browser */}
            <section className="border-e border-white/[0.06] p-4">
              <header className="mb-3 flex items-baseline justify-between">
                <div>
                  <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/55">
                    // upcoming_shoots
                  </h2>
                  <p className="mt-1 text-[12px] text-white/45">٤ لقطات · أسبوع قادم</p>
                </div>
                <button className="text-[11px] text-white/45 hover:text-[#FF6B1A]">
                  view all →
                </button>
              </header>

              <div className="grid grid-cols-2 gap-3">
                <ShootCard
                  title="جولة الشوروم — MG"
                  client="إم تي إن للسيارات"
                  city="الرياض"
                  when="اليوم · 21:33"
                  duration="04:00:00"
                  pct={45}
                  code="PRJ-0007"
                  status="shooting"
                  isToday
                />
                <ShootCard
                  title="BMW Summer Campaign"
                  client="BMW السعودية"
                  city="جدة"
                  when="غداً · 09:00"
                  duration="08:00:00"
                  pct={78}
                  code="PRJ-0006"
                  status="editing"
                  urgent
                />
                <ShootCard
                  title="Rolls Royce interior"
                  client="رولز رويس"
                  city="الرياض"
                  when="الأحد · 10:00"
                  duration="06:00:00"
                  pct={92}
                  code="PRJ-0005"
                  status="review"
                />
                <ShootCard
                  title="لكزس LX social"
                  client="لكزس"
                  city="جدة"
                  when="الإثنين · 07:30"
                  duration="03:00:00"
                  pct={12}
                  code="PRJ-0004"
                  status="brief"
                />
              </div>

              {/* Capacity heatmap row — like FCP timeline */}
              <header className="mb-3 mt-8 flex items-baseline justify-between">
                <div>
                  <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/55">
                    // team.capacity
                  </h2>
                  <p className="mt-1 text-[12px] text-white/45">١٤ يوم قادم</p>
                </div>
                <button className="text-[11px] text-white/45 hover:text-[#FF6B1A]">
                  open team →
                </button>
              </header>

              <div className="rounded-md border border-white/[0.06] bg-white/[0.015]">
                {/* Timeline ruler */}
                <div className="grid grid-cols-[80px,1fr] border-b border-white/[0.06] px-3 py-1.5">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-white/30">
                    member
                  </span>
                  <div className="grid grid-cols-14 gap-0.5">
                    {Array.from({ length: 14 }, (_, i) => (
                      <span
                        key={i}
                        className={
                          'text-center font-mono text-[9px] ' +
                          (i === 0 ? 'text-[#FF6B1A]' : 'text-white/25')
                        }
                      >
                        {i === 0 ? 'NOW' : i}
                      </span>
                    ))}
                  </div>
                </div>
                {[
                  ['khalid', [4, 4, 3, 2, 2, 0, 0, 1, 3, 3, 2, 1, 0, 0]],
                  ['reem', [3, 3, 2, 2, 1, 0, 0, 2, 3, 4, 3, 2, 1, 0]],
                  ['fadi', [2, 2, 1, 1, 0, 0, 0, 1, 2, 2, 2, 1, 1, 0]],
                  ['hamada', [1, 1, 1, 0, 0, 0, 0, 1, 1, 2, 1, 1, 0, 0]],
                  ['adam', [0, 1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0]],
                ].map(([name, days]) => (
                  <div
                    key={name as string}
                    className="grid grid-cols-[80px,1fr] items-center border-b border-white/[0.04] px-3 py-1.5 last:border-0"
                  >
                    <span className="font-mono text-[11px] text-white/75">{name as string}</span>
                    <div className="grid grid-cols-14 gap-0.5">
                      {(days as number[]).map((v, j) => (
                        <div
                          key={j}
                          className="h-3.5 rounded-sm"
                          style={{
                            background:
                              v === 0
                                ? 'rgba(255,255,255,0.03)'
                                : v < 2
                                  ? 'rgba(255,255,255,0.25)'
                                  : v < 4
                                    ? 'rgba(255,255,255,0.5)'
                                    : '#FF6B1A',
                          }}
                          title={`${v} مشروع`}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Right rail — AI inspector */}
            <aside className="bg-[#0C0C10] p-4">
              {/* Inspector header */}
              <header className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={12} className="text-[#FF6B1A]" />
                  <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/55">
                    ai.brief
                  </span>
                </div>
                <button className="rounded border border-white/[0.08] p-0.5 hover:border-[#FF6B1A]/40 hover:text-[#FF6B1A]">
                  <MoreHorizontal size={11} className="text-white/35" />
                </button>
              </header>

              {/* AI title */}
              <p className="text-[10px] text-white/40">مرحباً Mohammed</p>
              <h3 className="mt-1 text-[15px] font-semibold leading-[1.4] text-white">
                يوم ضغط على التسليم — رولز رويس متأخر، خالد فوق سقف الحمولة.
              </h3>

              {/* Priorities — compact list */}
              <ol className="mt-4 space-y-0">
                {[
                  {
                    num: '01',
                    label: 'PRJ-0005',
                    text: 'رولز رويس: تسليم ٣ أيام، إنجاز ٤٥٪',
                    action: 'راجع الفريق قبل نهاية اليوم',
                    urgent: true,
                  },
                  {
                    num: '02',
                    label: 'BMW thread',
                    text: 'إيميل متأخر ٥٢ ساعة',
                    action: 'الـ draft عند خالد · افتح',
                  },
                  {
                    num: '03',
                    label: 'CAPACITY',
                    text: 'خالد على ٣ مشاريع',
                    action: 'وزّع MG لـ فادي قبل الإثنين',
                  },
                ].map((p) => (
                  <li
                    key={p.num}
                    className="grid grid-cols-[28px,1fr] gap-2 border-b border-white/[0.06] py-2.5 last:border-0"
                  >
                    <span
                      className={
                        'font-mono text-[11px] ' + (p.urgent ? 'text-[#FF6B1A]' : 'text-white/30')
                      }
                    >
                      {p.num}
                    </span>
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-wider text-white/40">
                        {p.label}
                      </p>
                      <p className="mt-0.5 text-[12px] leading-snug text-white/90">{p.text}</p>
                      <p className="mt-1 text-[11px] leading-snug text-white/55">↳ {p.action}</p>
                    </div>
                  </li>
                ))}
              </ol>

              {/* Brief footer actions */}
              <div className="mt-4 flex items-center gap-2">
                <button className="inline-flex items-center gap-1.5 rounded border border-[#FF6B1A]/50 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-[#FF6B1A] hover:bg-[#FF6B1A]/10">
                  <Sparkles size={10} />
                  refresh
                </button>
                <span className="font-mono text-[10px] text-white/35">4m ago</span>
              </div>

              {/* System health — compact */}
              <header className="mb-2 mt-8 flex items-center gap-2">
                <Circle size={9} className="fill-white/85 text-white/85" />
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/55">
                  // health
                </span>
              </header>
              <ul className="font-mono text-[10.5px]">
                {[
                  ['gmail.token', 'ok', '25d'],
                  ['drive.token', 'warn', '52h'],
                  ['whatsapp', 'ok', 'live'],
                  ['trigger', 'ok', '11 tasks'],
                ].map(([k, s, n]) => (
                  <li
                    key={k as string}
                    className="flex items-center justify-between border-b border-white/[0.04] py-1.5"
                  >
                    <span className="text-white/65">{k as string}</span>
                    <span className="flex items-center gap-1.5">
                      <span
                        className={
                          'h-1.5 w-1.5 rounded-full ' +
                          ((s as string) === 'ok' ? 'bg-white/65' : 'bg-[#FF6B1A]')
                        }
                      />
                      <span className="text-white/40">{n as string}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </aside>
          </div>

          {/* Bottom status — activity log */}
          <section className="border-t border-white/[0.06] p-4">
            <header className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity size={12} className="text-white/55" />
                <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/55">
                  // activity.live
                </h2>
                <span className="inline-flex items-center gap-1 rounded-sm bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-white/45">
                  <span
                    className="h-1 w-1 animate-pulse rounded-full bg-[#FF6B1A]"
                  />
                  streaming
                </span>
              </div>
              <button className="text-[11px] text-white/45 hover:text-[#FF6B1A]">filter →</button>
            </header>

            <ul className="grid grid-cols-1 divide-y divide-white/[0.04] font-mono text-[11px] md:grid-cols-2">
              {[
                ['16:38:12', 'PRJ-0006', 'khalid → delivered', 'bmw.summer.cut.v3'],
                ['16:21:04', 'DEL-0012', 'reem → approved', 'reel_07'],
                ['15:58:33', 'EMAIL', 'sent → lexus.sa.contact', 'thread #482'],
                ['15:34:51', 'TASK-0089', 'created by fadi', 'check audio sync'],
                ['14:45:18', 'EQ-0001', 'reserved canon.r5', 'sun 10:00'],
                ['14:22:00', 'GMAIL', 'ai summarized', '7 threads'],
              ].map(([time, ref, what, detail]) => (
                <li
                  key={(time as string) + (ref as string)}
                  className="grid grid-cols-[88px,120px,1fr,auto] gap-3 px-2 py-2 hover:bg-white/[0.02]"
                >
                  <span className="text-white/40">{time as string}</span>
                  <span className="truncate text-[#FF6B1A]">{ref as string}</span>
                  <span className="truncate text-white/80">{what as string}</span>
                  <span className="truncate text-white/40">{detail as string}</span>
                </li>
              ))}
            </ul>
          </section>
        </main>
      </div>

      {/* Bottom status bar */}
      <div className="fixed bottom-0 start-0 end-0 flex h-7 items-center gap-3 border-t border-white/[0.06] bg-[#0F0F12] px-3 font-mono text-[10px] text-white/45">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FF6B1A]" />
          11 worker tasks
        </span>
        <span>·</span>
        <span>gmail synced 2m ago</span>
        <span>·</span>
        <span>2 ai_suggestions pending</span>
        <span className="ms-auto">Antagna v0.42 · hnd1 · 23ms</span>
      </div>
    </div>
  );
}

// === components ===
function NavSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-3 pb-2">
      <p className="mb-1 px-2 font-mono text-[9px] uppercase tracking-wider text-white/30">
        {label}
      </p>
      <ul className="space-y-px">{children}</ul>
    </div>
  );
}

function RailItem({
  icon: Icon,
  label,
  badge,
  active,
  dot,
}: {
  icon: typeof Briefcase;
  label: string;
  badge?: string;
  active?: boolean;
  dot?: boolean;
}) {
  return (
    <li>
      <div
        className={
          'flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] cursor-pointer ' +
          (active
            ? 'bg-white/[0.06] text-white'
            : 'text-white/65 hover:bg-white/[0.03] hover:text-white')
        }
      >
        <Icon
          size={13}
          strokeWidth={1.7}
          className={active ? 'text-[#FF6B1A]' : 'text-white/55'}
        />
        <span className="flex-1">{label}</span>
        {dot && <span className="h-1.5 w-1.5 rounded-full bg-[#FF6B1A]" />}
        {badge && (
          <span className="rounded-sm bg-white/[0.06] px-1.5 py-0.5 font-mono text-[9px] text-white/65">
            {badge}
          </span>
        )}
      </div>
    </li>
  );
}

function ToolButton({
  icon: Icon,
  label,
  active,
}: {
  icon: typeof Filter;
  label?: string;
  active?: boolean;
}) {
  return (
    <button
      className={
        'inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] ' +
        (active
          ? 'bg-white/[0.06] text-white'
          : 'text-white/55 hover:bg-white/[0.03] hover:text-white')
      }
    >
      <Icon size={11} strokeWidth={1.7} />
      {label && <span className="hidden md:inline">{label}</span>}
    </button>
  );
}

function Hud({
  label,
  value,
  unit,
  delta,
  warning,
  sparkUp,
  last,
}: {
  label: string;
  value: string;
  unit?: string;
  delta: string;
  warning?: boolean;
  sparkUp?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={
        'p-4 ' + (last ? '' : 'border-e border-white/[0.06]')
      }
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">{label}</p>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="font-mono text-[26px] font-semibold tracking-tight text-white">
          {value}
        </span>
        {unit && <span className="font-mono text-[10px] text-white/40">{unit}</span>}
        {sparkUp && (
          <svg viewBox="0 0 40 12" className="ms-auto h-3 w-10">
            <path
              d="M 0,10 L 8,8 L 16,9 L 24,6 L 32,4 L 40,2"
              fill="none"
              stroke="white"
              strokeOpacity="0.6"
              strokeWidth="1"
            />
          </svg>
        )}
      </div>
      <p className={'mt-1 font-mono text-[10px] ' + (warning ? 'text-[#FF6B1A]' : 'text-white/45')}>
        {delta}
      </p>
    </div>
  );
}

function ShootCard({
  title,
  client,
  city,
  when,
  duration,
  pct,
  code,
  status,
  isToday,
  urgent,
}: {
  title: string;
  client: string;
  city: string;
  when: string;
  duration: string;
  pct: number;
  code: string;
  status: string;
  isToday?: boolean;
  urgent?: boolean;
}) {
  const STATUS_COLORS: Record<string, string> = {
    shooting: '#FF6B1A',
    editing: 'rgba(255,255,255,0.45)',
    review: 'rgba(255,255,255,0.75)',
    brief: 'rgba(255,255,255,0.25)',
  };
  return (
    <article className="overflow-hidden rounded-md border border-white/[0.08] bg-white/[0.015] hover:border-white/[0.16]">
      {/* Thumbnail placeholder — like Frame.io clip preview */}
      <div className="relative aspect-video border-b border-white/[0.06] bg-[#0F0F12]">
        <div
          aria-hidden
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `
              repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 8px),
              repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 8px)
            `,
          }}
        />
        <div className="absolute inset-0 grid place-items-center">
          <div className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-black/40 backdrop-blur-sm">
            <Play size={13} className="text-white/75" />
          </div>
        </div>
        {/* Status badge top-start */}
        <span
          className="absolute start-2 top-2 inline-flex items-center gap-1 rounded-sm bg-black/60 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white/85 backdrop-blur-sm"
        >
          <span
            className="h-1 w-1 rounded-full"
            style={{ background: STATUS_COLORS[status] }}
          />
          {status}
        </span>
        {/* Time badge end */}
        <span className="absolute end-2 top-2 rounded-sm bg-black/60 px-1.5 py-0.5 font-mono text-[9px] text-white/85 backdrop-blur-sm">
          {duration}
        </span>
        {/* Today flag */}
        {isToday && (
          <span className="absolute start-2 bottom-2 rounded-sm bg-[#FF6B1A] px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-black">
            ON AIR
          </span>
        )}
        {urgent && !isToday && (
          <span className="absolute start-2 bottom-2 rounded-sm border border-[#FF6B1A]/60 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-[#FF6B1A]">
            urgent
          </span>
        )}
      </div>

      {/* Card body */}
      <div className="p-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="truncate text-[13px] font-medium text-white">{title}</h3>
          <span className="shrink-0 font-mono text-[9px] text-white/35">{code}</span>
        </div>
        <p className="mt-0.5 truncate text-[11px] text-white/55">
          {client} · {city}
        </p>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between font-mono text-[9px]">
            <span className="text-white/45">{when}</span>
            <span className="text-white/65">{pct}%</span>
          </div>
          <div className="h-0.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className={'h-full ' + (urgent ? 'bg-[#FF6B1A]' : 'bg-white/70')}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Tool row */}
        <div className="mt-3 flex items-center gap-1">
          <button className="grid h-6 w-6 place-items-center rounded text-white/40 hover:bg-white/[0.04] hover:text-white">
            <MessageSquare size={11} />
          </button>
          <button className="grid h-6 w-6 place-items-center rounded text-white/40 hover:bg-white/[0.04] hover:text-white">
            <Users size={11} />
          </button>
          <button className="grid h-6 w-6 place-items-center rounded text-white/40 hover:bg-white/[0.04] hover:text-white">
            <Camera size={11} />
          </button>
          <span className="ms-auto inline-flex items-center gap-1 text-[9px] text-white/35">
            <GripVertical size={9} />
            drag to reorder
          </span>
        </div>
      </div>
    </article>
  );
}
