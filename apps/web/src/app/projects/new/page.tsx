import Link from 'next/link';
import { redirect } from 'next/navigation';
import { eq, isNull, asc } from 'drizzle-orm';
import {
  db,
  clients,
  profiles,
  projectTemplates,
  projectTypeEnum,
} from '@antagna/db';
import { PageHeader, Card, Button } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { createProject } from './actions';

export const dynamic = 'force-dynamic';

export default async function NewProjectPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/projects/new');

  const [clientList, profileList, templateList] = await Promise.all([
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
    db
      .select({
        id: projectTemplates.id,
        code: projectTemplates.code,
        nameAr: projectTemplates.nameAr,
        nameEn: projectTemplates.nameEn,
        useCount: projectTemplates.useCount,
      })
      .from(projectTemplates)
      .where(eq(projectTemplates.active, true))
      .orderBy(asc(projectTemplates.nameAr)),
  ]);

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/projects">
      <div className="mx-auto max-w-3xl space-y-8">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-sm text-[--text-muted] hover:text-[--accent]"
        >
          <ArrowLeft size={14} className="rtl:rotate-180" />
          كل المشاريع
        </Link>

        <PageHeader
          eyebrow="مشروع جديد"
          title="ابدأ مشروع"
          subtitle="اختر template أو ابدأ من الصفر. التيمبليت بيولّد deliverable groups + tasks تلقائياً."
        />

        <Card>
          <form action={createProject} className="space-y-6">
            <Section title="القالب">
              <Field
                label="Template"
                hint="اختياري — مثال: فيديو إعلاني، session تصوير"
              >
                <select
                  name="templateId"
                  defaultValue=""
                  className="form-input"
                >
                  <option value="">— بدون template —</option>
                  {templateList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nameAr}
                      {t.nameEn ? ` (${t.nameEn})` : ''}
                      {t.useCount > 0 ? `  · استُخدم ${t.useCount} مرة` : ''}
                    </option>
                  ))}
                </select>
              </Field>
            </Section>

            <Section title="الأساسيات">
              <Field label="العميل" required>
                <select
                  name="clientId"
                  required
                  defaultValue=""
                  className="form-input"
                >
                  <option value="" disabled>
                    — اختر —
                  </option>
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
                    placeholder="فيديو إعلاني — حملة الصيف"
                    className="form-input"
                  />
                </Field>
                <Field label="Title (English)" required>
                  <input
                    type="text"
                    name="title"
                    required
                    placeholder="Summer Campaign Video"
                    className="form-input"
                  />
                </Field>
              </div>

              <Field label="النوع">
                <select
                  name="projectType"
                  defaultValue="shoot"
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
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Project Manager">
                  <select
                    name="pmId"
                    defaultValue=""
                    className="form-input"
                  >
                    <option value="">— غير محدد —</option>
                    {profileList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.displayName}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Account Manager">
                  <select
                    name="amId"
                    defaultValue=""
                    className="form-input"
                  >
                    <option value="">— غير محدد —</option>
                    {profileList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.displayName}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </Section>

            <div className="flex items-center gap-3 border-t border-[--line] pt-6">
              <Button variant="primary" size="lg" icon={<Sparkles size={16} />}>
                إنشاء المشروع
              </Button>
              <Link
                href="/projects"
                className="inline-flex h-11 items-center rounded-xl px-4 text-sm text-[--text-muted] hover:bg-[--surface]/60 hover:text-[--text]"
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
          height: 40px;
          padding: 0 12px;
          border-radius: 12px;
          border: 1px solid var(--line);
          background: var(--bg-elevated);
          color: var(--text);
          font-size: 14px;
        }
        .form-input:focus {
          outline: none;
          border-color: var(--accent);
        }
      `}</style>
    </Shell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[--text-dim]">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium text-[--text]">
        {label}
        {required && <span className="text-[--accent]"> *</span>}
      </span>
      {children}
      {hint && <span className="block text-xs text-[--text-dim]">{hint}</span>}
    </label>
  );
}
