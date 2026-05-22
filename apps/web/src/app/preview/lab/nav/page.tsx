import Link from 'next/link';
import {
  ArrowLeft, CheckCircle2, LayoutDashboard, Briefcase, ListChecks, Inbox,
  Calendar, Users, Camera, Megaphone, UserSquare2, BarChart3, FileText,
  Shield, Settings, Star, ChevronDown, Sparkles,
} from 'lucide-react';

export default function NavLab() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto max-w-[1200px] px-6 py-10 md:px-8 md:py-14">
        <Link
          href="/preview/lab"
          className="mb-6 inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
        >
          <ArrowLeft size={13} className="rtl:rotate-180" />
          العودة
        </Link>
        <header className="mb-10 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
            القسم ٥ — القائمة الجانبية
          </p>
          <h1 className="text-[32px] font-bold tracking-[-0.02em]" style={{ fontFamily: 'var(--font-display)' }}>
            تقسيم ١٣ بند بشكل أذكى
          </h1>
          <p className="max-w-2xl text-[13px] leading-relaxed text-[var(--text-muted)]">
            الـ split الحالي ٥/٨ بيخفي ٨ بنود تحت "المزيد". الـ research من Linear/Notion بيقول:
            مجموعات قابلة للطي + favorites + Cmd+K أحسن من dock مدمج. هنا ٤ مقترحات.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Option 1 — current */}
          <NavMock tag="١ — الحالي (٥ فوق + ٨ تحت)" subtitle="ـ Pillar 12 الأصلي. dock عمودي صغير.">
            <NavGroup>
              <NavItem icon={LayoutDashboard} label="الرئيسية" active />
              <NavItem icon={Briefcase} label="المشاريع" />
              <NavItem icon={ListChecks} label="المهام" />
              <NavItem icon={Inbox} label="الوارد" />
              <NavItem icon={Calendar} label="التقويم" />
            </NavGroup>
            <div className="my-2 border-t border-[var(--line)]" />
            <NavGroup>
              <NavItem icon={Users} label="… المزيد (٨ بنود مخفية)" dim />
            </NavGroup>
          </NavMock>

          {/* Option 2 — collapsible sections */}
          <NavMock
            tag="٢ — مجموعات قابلة للطي (موصى به)"
            recommended
            subtitle="٤ مجموعات بأسماء، كل قسم بيتطوي/بيتفتح. أوضح هيكلياً. Linear/Notion pattern."
          >
            <NavSectionHeader>اليومي</NavSectionHeader>
            <NavGroup>
              <NavItem icon={LayoutDashboard} label="الرئيسية" active />
              <NavItem icon={Inbox} label="الوارد" />
              <NavItem icon={ListChecks} label="مهامي" />
              <NavItem icon={Calendar} label="التقويم" />
            </NavGroup>
            <NavSectionHeader>الإنتاج</NavSectionHeader>
            <NavGroup>
              <NavItem icon={Briefcase} label="المشاريع" />
              <NavItem icon={Camera} label="المعدات" />
              <NavItem icon={UserSquare2} label="الفريق" />
            </NavGroup>
            <NavSectionHeader>الأعمال</NavSectionHeader>
            <NavGroup>
              <NavItem icon={Users} label="العملاء" />
              <NavItem icon={Megaphone} label="السوشيال" />
              <NavItem icon={BarChart3} label="مؤشرات الأداء" />
              <NavItem icon={FileText} label="التقارير" />
            </NavGroup>
            <NavSectionHeader>النظام</NavSectionHeader>
            <NavGroup>
              <NavItem icon={Shield} label="الإدارة" />
              <NavItem icon={Settings} label="الإعدادات" />
            </NavGroup>
          </NavMock>

          {/* Option 3 — pinned + all */}
          <NavMock
            tag="٣ — Pinned + Everything"
            subtitle="Linear pattern: نجوم تثبيت بالأعلى. باقي البنود في قائمة عادية تحت."
          >
            <NavSectionHeader icon={Star}>المثبّت</NavSectionHeader>
            <NavGroup>
              <NavItem icon={LayoutDashboard} label="الرئيسية" active pinned />
              <NavItem icon={Inbox} label="الوارد" pinned />
              <NavItem icon={Briefcase} label="المشاريع" pinned />
            </NavGroup>
            <NavSectionHeader>الكل</NavSectionHeader>
            <NavGroup>
              <NavItem icon={ListChecks} label="المهام" />
              <NavItem icon={Calendar} label="التقويم" />
              <NavItem icon={Users} label="العملاء" />
              <NavItem icon={Camera} label="المعدات" />
              <NavItem icon={UserSquare2} label="الفريق" />
              <NavItem icon={Megaphone} label="السوشيال" />
              <NavItem icon={BarChart3} label="مؤشرات الأداء" />
              <NavItem icon={FileText} label="التقارير" />
              <NavItem icon={Shield} label="الإدارة" />
              <NavItem icon={Settings} label="الإعدادات" />
            </NavGroup>
          </NavMock>

          {/* Option 4 — contextual by role */}
          <NavMock
            tag="٤ — Contextual بالدور"
            subtitle="القائمة تتغير حسب الـ role. مدير المشاريع شايف غير المحاسب. تعقيد أعلى."
          >
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-md bg-[var(--accent-tint)] px-2 py-1 text-[10px] font-semibold text-[var(--accent)]">
              <Sparkles size={10} />
              عرض كمدير إنتاج
            </div>
            <NavSectionHeader>عملي</NavSectionHeader>
            <NavGroup>
              <NavItem icon={LayoutDashboard} label="الرئيسية" active />
              <NavItem icon={ListChecks} label="مهام فريقي" badge="٨" />
              <NavItem icon={Briefcase} label="مشاريع نشطة" badge="٤" />
              <NavItem icon={Calendar} label="جدول التصوير" />
            </NavGroup>
            <NavSectionHeader>المساندة</NavSectionHeader>
            <NavGroup>
              <NavItem icon={Camera} label="حجز معدات" />
              <NavItem icon={UserSquare2} label="حمولة الفريق" />
              <NavItem icon={Inbox} label="الوارد" badge="٢" />
            </NavGroup>
            <NavSectionHeader>الأقل استخداماً</NavSectionHeader>
            <NavGroup>
              <NavItem icon={ChevronDown} label="٥ بنود إضافية" dim />
            </NavGroup>
          </NavMock>
        </div>

        <div className="mt-10 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)] mb-2">
            إضافة لازم في كل الخيارات
          </p>
          <ul className="space-y-1 text-[12px] text-[var(--text-muted)]">
            <li>• <strong>Cmd+K command palette</strong> — أي بند الواحد يلاقيه في ثانية، بغض النظر عن مكانه</li>
            <li>• <strong>Workspace switcher</strong> فوق (مفيد لما تبقى Volt + ضيف لاحقاً)</li>
            <li>• <strong>الإعدادات + المستخدم</strong> دايماً في الأسفل (Linear/Notion convention)</li>
          </ul>
        </div>

        <div className="mt-8 rounded-xl border border-[var(--accent)]/25 bg-[var(--accent-tint)] p-5">
          <p className="text-[12px] text-[var(--text)]">
            قولي رقم الخيار. الـ Cmd+K هضيفه في كل الحالات. لو عايز تجمع بين خيارين قولي.
          </p>
        </div>
      </div>
    </div>
  );
}

function NavMock({
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
    <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
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
        <p className="mt-1 text-[11px] text-[var(--text-muted)]">{subtitle}</p>
      </header>
      <div className="rounded-lg border border-[var(--line-strong)] bg-[var(--bg-elevated)] p-2">
        {children}
      </div>
    </section>
  );
}

function NavSectionHeader({ children, icon: Icon }: { children: React.ReactNode; icon?: typeof Star }) {
  return (
    <p className="mb-1 mt-2 flex items-center gap-1.5 px-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
      {Icon && <Icon size={9} />}
      {children}
    </p>
  );
}

function NavGroup({ children }: { children: React.ReactNode }) {
  return <ul className="space-y-px">{children}</ul>;
}

function NavItem({
  icon: Icon,
  label,
  active,
  dim,
  pinned,
  badge,
}: {
  icon: typeof Star;
  label: string;
  active?: boolean;
  dim?: boolean;
  pinned?: boolean;
  badge?: string;
}) {
  return (
    <li>
      <div
        className={
          'flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] ' +
          (active
            ? 'bg-[var(--accent-tint)] text-[var(--text)]'
            : dim
              ? 'text-[var(--text-dim)]'
              : 'text-[var(--text-muted)] hover:bg-white/5')
        }
      >
        <Icon size={13} strokeWidth={1.7} className={active ? 'text-[var(--accent)]' : ''} />
        <span className="flex-1">{label}</span>
        {pinned && <Star size={9} className="text-[var(--accent)]" />}
        {badge && (
          <span className="rounded-full bg-[var(--accent)] px-1.5 py-0.5 font-mono text-[9px] font-bold text-white">
            {badge}
          </span>
        )}
      </div>
    </li>
  );
}
