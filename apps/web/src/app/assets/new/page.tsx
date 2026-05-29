import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader, Card } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { ChevronRight, Link2 } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/authz';
import { addExternalAssetAndRedirect } from '../actions';
import { ASSET_CATEGORIES } from '../constants';

export const dynamic = 'force-dynamic';

const CATEGORY_LABEL_AR: Record<string, string> = {
  contract: 'عقود',
  license: 'تراخيص',
  insurance: 'تأمين',
  registration: 'سجلات',
  brand: 'هوية بصرية',
  finance: 'مالية',
  hr: 'موارد بشرية',
  other: 'أخرى',
};

export default async function NewAssetPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/assets/new');

  // Gate the page itself (redirects to /assets on missing permission via the
  // helper's redirect). Company assets require access.manage.
  await requirePermission('access.manage');

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/assets">
      <nav className="flex items-center gap-1 text-[11px] text-[var(--text-dim)]">
        <Link href="/assets" className="hover:text-[var(--accent)]">
          أصول الشركة
        </Link>
        <ChevronRight size={12} className="rotate-180" />
        <span className="text-[var(--text-muted)]">ربط مستند خارجي</span>
      </nav>

      <PageHeader
        eyebrow="New asset"
        title="ربط مستند خارجي"
        subtitle="سجّل مستنداً موجوداً على Google Drive أو SharePoint برابطه — أو ارجع لرفع ملف مباشرةً من صفحة الأصول"
      />

      <Card>
        <form
          action={addExternalAssetAndRedirect}
          className="grid gap-4 sm:grid-cols-2"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] text-[var(--text-dim)]">اسم المستند *</span>
            <input
              name="filename"
              required
              className="h-10 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 text-[13px] text-[var(--text)]"
              placeholder="السجل التجاري 2026"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] text-[var(--text-dim)]">التصنيف</span>
            <select
              name="category"
              defaultValue="registration"
              className="h-10 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 text-[13px] text-[var(--text)]"
            >
              {ASSET_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL_AR[c] ?? c}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-[12px] text-[var(--text-dim)]">الرابط *</span>
            <input
              name="externalUrl"
              type="url"
              required
              dir="ltr"
              className="h-10 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 text-[13px] text-[var(--text)]"
              placeholder="https://drive.google.com/file/…"
            />
          </label>

          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-[12px] text-[var(--text-dim)]">ملاحظة (اختياري)</span>
            <input
              name="note"
              className="h-10 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 text-[13px] text-[var(--text)]"
              placeholder="ساري حتى 2027"
            />
          </label>

          <div className="flex items-center gap-3 sm:col-span-2">
            <button
              type="submit"
              className="magnet inline-flex h-10 items-center gap-2 rounded-md bg-[var(--accent)] px-5 text-[13px] font-semibold text-white hover:bg-[var(--accent-hover)]"
            >
              <Link2 size={15} />
              حفظ المستند
            </button>
            <Link
              href="/assets"
              className="inline-flex h-10 items-center rounded-md border border-[var(--line)] bg-[var(--surface)] px-5 text-[13px] text-[var(--text)] hover:border-[var(--accent)]"
            >
              إلغاء
            </Link>
          </div>
        </form>
      </Card>
    </Shell>
  );
}
