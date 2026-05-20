import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { eq, isNull } from 'drizzle-orm';
import {
  db,
  projects,
  clients,
  profiles,
  projectTypeEnum,
} from '@antagna/db';
import { PageHeader, Card, Button } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { ArrowLeft, Save } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { updateProject } from './actions';

export const dynamic = 'force-dynamic';

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/projects/${id}/edit`);

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);

  if (!project) notFound();

  const [clientList, profileList] = await Promise.all([
    db
      .select({ id: clients.id, code: clients.code, nameAr: clients.nameAr })
      .from(clients)
      .where(isNull(clients.archivedAt))
      .orderBy(clients.nameAr),
    db
      .select({ id: profiles.id, displayName: profiles.displayName })
      .from(profiles)
      .where(eq(profiles.status, 'active'))
      .orderBy(profiles.displayName),
  ]);

  const fmtDate = (d: Date | null) =>
    d ? new Date(d).toISOString().slice(0, 10) : '';

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/projects">
      <div className="mx-auto max-w-3xl space-y-8">
        <Link
          href={`/projects/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--accent)]"
        >
          <ArrowLeft size={14} className="rtl:rotate-180" />
          {project.code} · {project.titleAr ?? project.title}
        </Link>

        <PageHeader
          eyebrow="تعديل"
          title="تعديل المشروع"
          subtitle="عدّل أي حقل ثم احفظ. تغيّر المرحلة بيتم من صفحة العرض."
        />

        <Card>
          <form
            action={updateProject.bind(null, id)}
            className="space-y-6"
          >
            <Section title="الأساسيات">
              <Field label="العميل" required>
                <select
                  name="clientId"
                  required
                  defaultValue={project.clientId}
                  className="form-input"
                >
                  {clientList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} · {c.nameAr}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="العنوان (عربي)">
                  <input
                    type="text"
                    name="titleAr"
                    defaultValue={project.titleAr ?? ''}
                    className="form-input"
                  />
                </Field>
                <Field label="Title (English)" required>
                  <input
                    type="text"
                    name="title"
                    required
                    defaultValue={project.title}
                    className="form-input"
                  />
                </Field>
              </div>

              <Field label="الوصف">
                <textarea
                  name="description"
                  rows={3}
                  defaultValue={project.description ?? ''}
                  className="form-input"
                />
              </Field>

              <Field label="النوع">
                <select
                  name="projectType"
                  defaultValue={project.projectType}
                  className="form-input"
                >
                  {projectTypeEnum.enumValues.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
            </Section>

            <Section title="الفريق">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Field label="Account Manager">
                  <select
                    name="amId"
                    defaultValue={project.accountManagerId ?? ''}
                    className="form-input"
                  >
                    <option value="">—</option>
                    {profileList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.displayName}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Project Manager">
                  <select
                    name="pmId"
                    defaultValue={project.projectManagerId ?? ''}
                    className="form-input"
                  >
                    <option value="">—</option>
                    {profileList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.displayName}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Production Manager">
                  <select
                    name="productionManagerId"
                    defaultValue={project.productionManagerId ?? ''}
                    className="form-input"
                  >
                    <option value="">—</option>
                    {profileList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.displayName}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </Section>

            <Section title="الموعد و القيمة">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="القيمة (ر.س)">
                  <input
                    type="number"
                    name="contractedValueSar"
                    step="0.01"
                    defaultValue={project.contractedValueSar ?? ''}
                    className="form-input font-mono"
                  />
                </Field>
                <Field label="موعد التسليم">
                  <input
                    type="date"
                    name="deliveryDueAt"
                    defaultValue={fmtDate(project.deliveryDueAt)}
                    className="form-input font-mono"
                  />
                </Field>
                <Field label="بداية التصوير">
                  <input
                    type="date"
                    name="shootStartsAt"
                    defaultValue={fmtDate(project.shootStartsAt)}
                    className="form-input font-mono"
                  />
                </Field>
                <Field label="نهاية التصوير">
                  <input
                    type="date"
                    name="shootEndsAt"
                    defaultValue={fmtDate(project.shootEndsAt)}
                    className="form-input font-mono"
                  />
                </Field>
              </div>
            </Section>

            <Section title="روابط و ملاحظات">
              <Field label="Drive folder URL">
                <input
                  type="url"
                  name="driveFolderUrl"
                  defaultValue={project.driveFolderUrl ?? ''}
                  placeholder="https://drive.google.com/..."
                  className="form-input font-mono"
                />
              </Field>
              <Field label="ملاحظات">
                <textarea
                  name="notes"
                  rows={4}
                  defaultValue={project.notes ?? ''}
                  className="form-input"
                />
              </Field>
            </Section>

            <div className="flex items-center gap-3 border-t border-[var(--line)] pt-6">
              <Button variant="primary" size="lg" icon={<Save size={16} />}>
                حفظ التغييرات
              </Button>
              <Link
                href={`/projects/${id}`}
                className="inline-flex h-10 items-center rounded-md px-4 text-sm text-[var(--text-muted)] hover:bg-[var(--surface)]/60 hover:text-[var(--text)]"
              >
                إلغاء
              </Link>
            </div>
          </form>
        </Card>
      </div>

      <style>{`
        .form-input {
          width: 100%;
          min-height: 40px;
          padding: 8px 12px;
          border-radius: 12px;
          border: 1px solid var(--line);
          background: var(--bg-elevated);
          color: var(--text);
          font-size: 14px;
        }
        .form-input:focus { outline: none; border-color: var(--accent); }
        textarea.form-input { resize: vertical; min-height: 80px; }
      `}</style>
    </Shell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium text-[var(--text)]">
        {label}
        {required && <span className="text-[var(--accent)]"> *</span>}
      </span>
      {children}
    </label>
  );
}
