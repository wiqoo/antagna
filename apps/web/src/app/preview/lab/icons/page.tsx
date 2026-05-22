import Link from 'next/link';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import {
  Briefcase as L_Briefcase, ListChecks as L_ListChecks, Inbox as L_Inbox,
  Users as L_Users, Camera as L_Camera, BarChart3 as L_BarChart3,
  Calendar as L_Calendar, Settings as L_Settings, FileText as L_FileText,
  Mail as L_Mail, Brain as L_Brain, Bell as L_Bell, Search as L_Search,
} from 'lucide-react';

const ICONS_LABELS = [
  ['Projects', 'مشاريع'],
  ['Tasks', 'مهام'],
  ['Inbox', 'وارد'],
  ['Team', 'فريق'],
  ['Camera', 'معدات'],
  ['KPIs', 'مؤشرات'],
  ['Calendar', 'تقويم'],
  ['Settings', 'إعدادات'],
  ['Reports', 'تقارير'],
  ['Mail', 'إيميل'],
  ['AI', 'AI'],
  ['Bell', 'إشعارات'],
  ['Search', 'بحث'],
] as const;

const LUCIDE_ICONS = [
  L_Briefcase, L_ListChecks, L_Inbox, L_Users, L_Camera, L_BarChart3,
  L_Calendar, L_Settings, L_FileText, L_Mail, L_Brain, L_Bell, L_Search,
];

export default function IconsLab() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto max-w-[1100px] px-6 py-10 md:px-8 md:py-14">
        <Link
          href="/preview/lab"
          className="mb-6 inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
        >
          <ArrowLeft size={13} className="rtl:rotate-180" />
          العودة
        </Link>
        <header className="mb-10 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
            القسم ٣ — الأيقونات
          </p>
          <h1 className="text-[32px] font-bold tracking-[-0.02em]" style={{ fontFamily: 'var(--font-display)' }}>
            مكتبة الأيقونات
          </h1>
          <p className="max-w-2xl text-[13px] leading-relaxed text-[var(--text-muted)]">
            الـ research بيقول Lucide بيكسب على 16px. Phosphor Regular رفيع جداً عند الـ 16px (مشكلة معروفة).
            Tabler بيغرق بـ ٥٩٠٠ أيقونة لكن busy stylistically. Heroicons عنده "mini" مخصص للأحجام الصغيرة.
          </p>
        </header>

        <Variant
          tag="الخيار ١ — Lucide (الحالي + موصى به)"
          recommended
          subtitle="~١٤٠٠ أيقونة، stroke 1.5-2px ثابت، neutral geometry، مفيش رموز ثقافية مشكلة."
          stroke={1.6}
          color="var(--text-muted)"
        />

        <Variant
          tag="الخيار ٢ — Lucide thick stroke"
          subtitle="نفس المكتبة، stroke أعرض (2.2px). أوضح على الشاشات الكبيرة، أثقل بصرياً."
          stroke={2.2}
          color="var(--text-muted)"
        />

        <Variant
          tag="الخيار ٣ — Lucide accent-tinted"
          subtitle="نفس Lucide لكن بلون الـ accent مباشرة لكل الأيقونات النشطة. أكثر برّاحة."
          stroke={1.6}
          color="var(--accent)"
        />

        <Variant
          tag="الخيار ٤ — حجم أكبر (20px)"
          subtitle="نفس Lucide، 20px بدل 16. أوضح، لكن بياخد مساحة في الـ dock الصغيرة."
          stroke={1.6}
          color="var(--text-muted)"
          size={20}
        />

        {/* Phosphor reference */}
        <section className="mb-10 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-yellow-400 mb-2">
            ملاحظة — Phosphor / Tabler / Heroicons
          </p>
          <p className="text-[12px] leading-relaxed text-[var(--text-muted)]">
            ما حمّلتش Phosphor/Tabler/Heroicons علشان مفيش حاجة في الـ bundle حالياً. لو عايز
            تجربها، قولي وأنا أعمل installs وأرجع بصفحة مقارنة فيها الأربعة جنب بعض. لكن الـ
            research واضح: <strong>Lucide بيكسب لـ ops UI عربي/دارك</strong>.
          </p>
        </section>

        <Footer />
      </div>
    </div>
  );
}

function Variant({
  tag,
  subtitle,
  recommended,
  stroke,
  color,
  size = 16,
}: {
  tag: string;
  subtitle: string;
  recommended?: boolean;
  stroke: number;
  color: string;
  size?: number;
}) {
  return (
    <section className="mb-8 rounded-xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3">
        <div>
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
        </div>
      </header>
      <div className="grid grid-cols-7 gap-3 p-5 md:grid-cols-13">
        {LUCIDE_ICONS.map((Icon, i) => {
          const [labelEn, labelAr] = ICONS_LABELS[i] ?? ['', ''];
          return (
            <div
              key={i}
              className="flex flex-col items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)]/40 py-2.5"
            >
              <Icon size={size} strokeWidth={stroke} style={{ color }} />
              <span className="text-[9px] text-[var(--text-dim)]">{labelAr || labelEn}</span>
            </div>
          );
        })}
      </div>

      {/* In context */}
      <div className="border-t border-[var(--line)] bg-[var(--bg)]/40 p-4">
        <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-[var(--text-dim)]">في سياق فعلي</p>
        <ul className="space-y-1">
          {LUCIDE_ICONS.slice(0, 4).map((Icon, i) => {
            const [, labelAr] = ICONS_LABELS[i] ?? ['', ''];
            return (
              <li key={i} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[12px] hover:bg-[var(--surface-hover)]">
                <Icon size={size} strokeWidth={stroke} style={{ color }} />
                <span className="text-[var(--text)]">{labelAr}</span>
                <span className="ms-auto text-[10px] text-[var(--text-dim)]">٤</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <div className="mt-12 rounded-xl border border-[var(--accent)]/25 bg-[var(--accent-tint)] p-5">
      <p className="text-[12px] text-[var(--text)]">
        قولي رقم الخيار. لو عايز أجرّب Phosphor/Tabler/Heroicons قولي.
      </p>
    </div>
  );
}
