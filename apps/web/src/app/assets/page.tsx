import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { db, attachments, profiles } from '@antagna/db';
import {
  PageHeader,
  Card,
  StatBox,
  EmptyState,
  AIHints,
  type AIHint,
} from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { FolderOpen, FileText, Link2, ShieldCheck, HardDrive } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { can } from '@/lib/authz';
import { AssetsBrowser, type AssetRow } from './AssetsBrowser';
import { COMPANY_ASSET_ENTITY } from './constants';

export const dynamic = 'force-dynamic';

/** Pull the [category] tag out of the description, returning {category, note}. */
function parseDescription(desc: string | null): { category: string; note: string | null } {
  if (!desc) return { category: '', note: null };
  const m = desc.match(/^\[([a-z_]+)\]\s*(.*)$/i);
  if (!m) return { category: '', note: desc.trim() || null };
  return { category: m[1]!.toLowerCase(), note: m[2]?.trim() || null };
}

export default async function AssetsPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/assets');

  // access.manage gates company-asset uploads/edits; project.update is the
  // softer key that also lets project leads contribute. Either grants manage.
  const [canAccess, canProject, raw] = await Promise.all([
    can('access.manage'),
    can('project.update'),
    db
      .select({
        id: attachments.id,
        filename: attachments.filename,
        mimeType: attachments.mimeType,
        sizeBytes: attachments.sizeBytes,
        storageProvider: attachments.storageProvider,
        externalUrl: attachments.externalUrl,
        entityType: attachments.entityType,
        description: attachments.description,
        createdAt: attachments.createdAt,
        uploadedByName: profiles.displayName,
      })
      .from(attachments)
      .leftJoin(profiles, eq(profiles.id, attachments.uploadedById))
      .orderBy(desc(attachments.createdAt))
      .limit(500),
  ]);

  const canManage = canAccess || canProject;

  const rows: AssetRow[] = raw.map((r) => {
    const { category, note } = parseDescription(r.description);
    return {
      id: r.id,
      filename: r.filename,
      mimeType: r.mimeType,
      sizeBytes: Number(r.sizeBytes ?? 0),
      storageProvider: r.storageProvider,
      externalUrl: r.externalUrl,
      entityType: r.entityType,
      category,
      note,
      uploadedByName: r.uploadedByName,
      createdAt: new Date(r.createdAt).toISOString(),
      isCompany: r.entityType === COMPANY_ASSET_ENTITY,
    };
  });

  const total = rows.length;
  const companyCount = rows.filter((r) => r.isCompany).length;
  const externalCount = rows.filter((r) => r.storageProvider === 'external_url').length;
  const totalBytes = rows.reduce((s, r) => s + r.sizeBytes, 0);
  const uncategorized = rows.filter((r) => r.isCompany && !r.category).length;
  const totalMb = totalBytes / 1024 / 1024;

  const hints: AIHint[] = [];
  if (uncategorized > 0) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: `${uncategorized} أصل بدون تصنيف`,
      insight: 'صنّف العقود والتراخيص لتسهيل البحث والتدقيق لاحقاً.',
    });
  }
  // Surface key compliance docs the company should always have on file.
  const hasContract = rows.some((r) => r.isCompany && r.category === 'license');
  if (companyCount > 0 && !hasContract) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: 'لا يوجد ترخيص/سجل مرفوع بعد',
      insight: 'أرفِق السجل التجاري والتراخيص الرسمية في خزنة الأصول.',
    });
  }

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/assets">
      {hints.length > 0 && (
        <AIHints
          context="Antagna AI · أصول الشركة"
          headline={`${total} ملف · ${companyCount} أصل شركة`}
          hints={hints}
          compact
        />
      )}
      <PageHeader
        eyebrow="Assets"
        title="أصول الشركة"
        subtitle="سجل موحّد لمستندات الشركة: عقود، تراخيص، تأمين، هوية بصرية — وكل المرفقات عبر النظام"
      />

      <section className="grid grid-cols-2 gap-4 stagger-in md:grid-cols-4">
        <StatBox
          label="إجمالي الملفات"
          value={total}
          sub="عبر كل النظام"
          icon={<FolderOpen size={16} />}
        />
        <StatBox
          label="أصول الشركة"
          value={companyCount}
          tone="success"
          sub="مستندات عامة"
          icon={<ShieldCheck size={16} />}
        />
        <StatBox
          label="روابط خارجية"
          value={externalCount}
          sub="Drive / SharePoint"
          icon={<Link2 size={16} />}
        />
        <StatBox
          label="المساحة"
          value={0}
          format={
            totalMb >= 1
              ? `${totalMb.toFixed(0)} MB`
              : `${(totalBytes / 1024).toFixed(0)} KB`
          }
          sub="ملفات مرفوعة"
          icon={<HardDrive size={16} />}
        />
      </section>

      {total === 0 && !canManage ? (
        <Card>
          <EmptyState
            icon={<FileText size={18} />}
            title="لا أصول بعد"
            description="لم تُرفع أي مستندات للشركة حتى الآن."
          />
        </Card>
      ) : (
        <AssetsBrowser rows={rows} canManage={canManage} />
      )}

      <div className="flex items-center justify-between border-t border-[var(--line)] pt-6 text-[10px] uppercase tracking-[0.22em] text-[var(--text-dim)]">
        <span>— Antagna Assets</span>
        <span>Volt Production · Jeddah</span>
      </div>
    </Shell>
  );
}
