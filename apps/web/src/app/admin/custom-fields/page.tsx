import { redirect } from 'next/navigation';
import { asc, sql } from 'drizzle-orm';
import { db, customFieldDefinitions } from '@antagna/db';
import {
  PageHeader,
  Card,
  CardHeader,
  StatusPill,
  EmptyState,
  AIHints,
  type AIHint,
} from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { getAdminUser } from '@/lib/auth-admin';
import { requirePermission } from '@/lib/authz';
import { SlidersHorizontal, Asterisk } from 'lucide-react';
import {
  ENTITY_LABEL_AR,
  FIELD_TYPE_LABEL_AR,
  TYPES_WITH_OPTIONS,
} from './constants';
import { CustomFieldBuilder } from './CustomFieldBuilder';
import { RowControls } from './RowControls';
import { EditFieldButton } from './EditFieldButton';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function CustomFieldsPage(props: { searchParams: SearchParams }) {
  // Page guard — lacking settings.update → /dashboard, signed out → /login.
  await requirePermission('settings.update');
  const admin = await getAdminUser();
  if (!admin) redirect('/login?next=/admin/custom-fields');

  const params = await props.searchParams;
  const error = typeof params.error === 'string' ? params.error : null;
  const ok = typeof params.ok === 'string' ? params.ok : null;

  // Count of recorded values per definition (to show usage + warn before delete).
  const [defs, valueCounts] = await Promise.all([
    db
      .select()
      .from(customFieldDefinitions)
      .orderBy(asc(customFieldDefinitions.entityType), asc(customFieldDefinitions.position)),
    db.execute<{ definition_id: string; n: number }>(
      sql`SELECT definition_id, count(*)::int AS n FROM custom_field_values GROUP BY definition_id`,
    ) as unknown as Promise<{ definition_id: string; n: number }[]>,
  ]);

  const usage = new Map<string, number>();
  for (const row of valueCounts) usage.set(row.definition_id, Number(row.n));

  // Group definitions by entity_type for a per-entity table.
  const byEntity = new Map<string, typeof defs>();
  for (const d of defs) {
    const arr = byEntity.get(d.entityType) ?? [];
    arr.push(d);
    byEntity.set(d.entityType, arr);
  }

  const total = defs.length;
  const inactive = defs.filter((d) => !d.active).length;

  const hints: AIHint[] = [];
  if (inactive > 0) {
    hints.push({
      index: '01',
      text: `${inactive} حقل معطّل`,
      insight: 'الحقول المعطّلة تختفي من النماذج لكن قيمها محفوظة — فعّلها أو احذفها إن لم تعد لازمة.',
    });
  }
  if (total === 0) {
    hints.push({
      index: String(hints.length + 1).padStart(2, '0'),
      text: 'لا حقول مخصّصة بعد',
      insight: 'أضف حقولاً لالتقاط بيانات خاصة بـ Volt على المشاريع والعملاء والمعدات.',
    });
  }

  return (
    <Shell user={{ email: admin.user.email ?? '' }} activePath="/admin">
      {hints.length > 0 && (
        <AIHints
          context="Antagna AI · الحقول المخصّصة"
          headline={`${total} حقل · عبر ${byEntity.size} كيان`}
          hints={hints}
          compact
        />
      )}
      <PageHeader
        eyebrow="Admin · إعدادات"
        title="الحقول المخصّصة"
        subtitle="عرّف حقول بيانات إضافية لكل كيان (مشاريع، عملاء، معدات…) — تظهر في النماذج وصفحات التفاصيل"
        action={<CustomFieldBuilder />}
      />

      {ok && (
        <p className="rounded-lg border border-[var(--success)]/30 bg-[var(--success)]/10 px-3 py-2 text-[13px] text-[var(--success)]">
          {ok}
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
          {error}
        </p>
      )}

      {total === 0 ? (
        <Card padded={false}>
          <EmptyState
            icon={<SlidersHorizontal size={20} />}
            title="لا حقول مخصّصة بعد"
            description="استخدم زر «حقل جديد» لإضافة أول حقل بيانات خاص بكيان."
          />
        </Card>
      ) : (
        Array.from(byEntity.entries()).map(([entity, rows]) => (
          <Card key={entity} padded={false}>
            <div className="p-6 pb-4">
              <CardHeader
                title={ENTITY_LABEL_AR[entity] ?? entity}
                subtitle={`${rows.length} حقل`}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--line)] bg-[var(--bg-elevated)]/40 text-start text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-dim)]">
                    <th className="px-5 py-3 text-start">الاسم</th>
                    <th className="px-5 py-3 text-start">key</th>
                    <th className="px-5 py-3 text-start">النوع</th>
                    <th className="px-5 py-3 text-start">الخيارات / إلزامي</th>
                    <th className="px-5 py-3 text-start">قيم</th>
                    <th className="px-5 py-3 text-start">الحالة</th>
                    <th className="px-5 py-3 text-end"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {rows.map((d, i) => {
                    const choices =
                      (d.options as { choices?: unknown[] } | null)?.choices ?? [];
                    const n = usage.get(d.id) ?? 0;
                    return (
                      <tr key={d.id} className="hover:bg-[var(--surface-hover)]">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5 text-[var(--text)]">
                            {d.labelAr}
                            {d.required && (
                              <Asterisk size={11} className="text-[var(--accent)]" />
                            )}
                          </div>
                          {d.labelEn && (
                            <span className="text-[11px] text-[var(--text-dim)]">{d.labelEn}</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs text-[var(--text-dim)]">
                          {d.key}
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusPill tone="info">
                            {FIELD_TYPE_LABEL_AR[d.fieldType] ?? d.fieldType}
                          </StatusPill>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-[var(--text-muted)]">
                          {TYPES_WITH_OPTIONS.has(d.fieldType)
                            ? `${(choices as unknown[]).length} خيار`
                            : d.required
                              ? 'إلزامي'
                              : '—'}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs text-[var(--text-dim)]">
                          {n > 0 ? n : '—'}
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusPill tone={d.active ? 'success' : 'neutral'} withDot={false}>
                            {d.active ? 'نشط' : 'معطّل'}
                          </StatusPill>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-1.5">
                            <EditFieldButton
                              id={d.id}
                              fieldType={d.fieldType}
                              labelAr={d.labelAr}
                              labelEn={d.labelEn}
                              required={d.required}
                              options={d.options}
                            />
                            <RowControls
                              id={d.id}
                              active={d.active}
                              isFirst={i === 0}
                              isLast={i === rows.length - 1}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ))
      )}
    </Shell>
  );
}
