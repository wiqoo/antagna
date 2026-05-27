import { redirect } from 'next/navigation';
import Link from 'next/link';
import { asc } from 'drizzle-orm';
import { db, inboundEmailRoutes, profiles } from '@antagna/db';
import { PageHeader, Card, StatusPill, EmptyState } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { getAdminUser } from '@/lib/auth-admin';
import { Mail, Plus, Filter } from 'lucide-react';
import { RouteForm } from './route-form';
import { RouteActions } from './route-actions';

export const dynamic = 'force-dynamic';

export default async function EmailRoutesPage() {
  const admin = await getAdminUser();
  if (!admin) redirect('/login?next=/admin/integrations/email-routes');

  const [rules, profilesList] = await Promise.all([
    db.select().from(inboundEmailRoutes).orderBy(asc(inboundEmailRoutes.position)),
    db
      .select({
        id: profiles.id,
        displayName: profiles.displayName,
        role: profiles.role,
      })
      .from(profiles),
  ]);

  return (
    <Shell user={{ email: admin.user.email ?? '' }} activePath="/admin">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
      >
        ← الإدارة
      </Link>

      <PageHeader
        eyebrow="Integrations · Email routing"
        title="قواعد توجيه البريد"
        subtitle="القواعد دي بتتنفّذ على كل thread وارد بعد الـ AI summary — بالترتيب من 0 لأعلى. أول match يربح."
      />

      <RouteForm profiles={profilesList} />

      {rules.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Filter size={20} />}
            title="لا قواعد بعد"
            description="ابدأ بإضافة قاعدة من الأعلى. مثال شائع: إذا كان الـ from يحتوي 'noreply' → اجعل status=closed."
          />
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-[12px]">
            <thead className="border-b border-[var(--line)] bg-[var(--surface-2)]/40 text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
              <tr>
                <th className="px-3 py-2 text-start">ترتيب</th>
                <th className="px-3 py-2 text-start">المطابقة</th>
                <th className="px-3 py-2 text-start">الإجراء</th>
                <th className="px-3 py-2 text-start">الحالة</th>
                <th className="px-3 py-2 text-end"></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr
                  key={rule.id}
                  className={
                    'border-b border-[var(--line)] last:border-b-0 ' +
                    (rule.active ? '' : 'opacity-50')
                  }
                >
                  <td className="px-3 py-2 font-mono text-[var(--text-muted)]">
                    {String(rule.position).padStart(2, '0')}
                  </td>
                  <td className="px-3 py-2">
                    <div className="space-y-0.5">
                      {rule.matchFromContains && (
                        <Chip label="from contains" value={rule.matchFromContains} />
                      )}
                      {rule.matchDomain && (
                        <Chip label="domain" value={rule.matchDomain} />
                      )}
                      {rule.matchSubjectRegex && (
                        <Chip label="subject regex" value={rule.matchSubjectRegex} />
                      )}
                      {rule.matchToContains && (
                        <Chip label="to contains" value={rule.matchToContains} />
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="space-y-0.5">
                      {rule.assignToProfileId && (
                        <Chip
                          label="assign"
                          value={
                            profilesList.find((p) => p.id === rule.assignToProfileId)
                              ?.displayName ?? rule.assignToProfileId
                          }
                        />
                      )}
                      {rule.setStatus && (
                        <Chip label="status" value={rule.setStatus} />
                      )}
                      {rule.setLabelKey && (
                        <Chip label="label" value={rule.setLabelKey} />
                      )}
                      {rule.createLeadIfNew && (
                        <Chip label="lead" value="if new" />
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <StatusPill tone={rule.active ? 'success' : 'neutral'}>
                      {rule.active ? 'مُفعّل' : 'معطّل'}
                    </StatusPill>
                  </td>
                  <td className="px-3 py-2 text-end">
                    <RouteActions ruleId={rule.id} active={rule.active} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Card>
        <div className="flex items-start gap-2 text-[12px] text-[var(--text-muted)]">
          <Mail size={14} className="mt-0.5 text-[var(--accent)]" />
          <div>
            <p className="font-semibold text-[var(--text)]">كيف تعمل القواعد؟</p>
            <ul className="mt-1 list-disc list-inside space-y-1">
              <li>كل thread جديد يمرّ على القواعد بالترتيب (الـ position)</li>
              <li>أول قاعدة تتطابق كل شروطها — تُطبَّق ويتوقّف الفحص</li>
              <li>الإجراءات تتراكب: assign + status + label معاً</li>
              <li>الـ AI summary يعمل قبل القواعد — `category:marketing` يُغلَق تلقائياً أصلاً</li>
            </ul>
          </div>
        </div>
      </Card>
    </Shell>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded border border-[var(--line)] bg-[var(--surface)]/60 px-1.5 py-0.5 text-[10px]">
      <span className="font-mono text-[var(--text-dim)]">{label}:</span>
      <span className="text-[var(--text)]">{value}</span>
    </div>
  );
}
