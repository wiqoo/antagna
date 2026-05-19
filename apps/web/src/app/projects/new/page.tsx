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
import { AppShell } from '@antagna/ui';
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
    <AppShell user={{ email: user.email ?? '' }} activePath="/projects">
      <div className="mx-auto max-w-2xl space-y-5">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-yellow-500"
        >
          ← المشاريع
        </Link>

        <header className="space-y-1">
          <h1 className="text-xl font-semibold">مشروع جديد</h1>
          <p className="text-sm text-neutral-500">
            اختار template (اختياري) — أو ابدأ من الصفر.
          </p>
        </header>

        <form action={createProject} className="space-y-4">
          <Field label="Template" hint="اختياري — يولّد deliverable groups + tasks تلقائياً">
            <select
              name="templateId"
              defaultValue=""
              className="w-full rounded-sm border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm"
            >
              <option value="">— بدون template —</option>
              {templateList.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nameAr}
                  {t.nameEn ? ` (${t.nameEn})` : ''}
                  {t.useCount > 0 ? `  · ${t.useCount}×` : ''}
                </option>
              ))}
            </select>
          </Field>

          <Field label="العميل *">
            <select
              name="clientId"
              required
              defaultValue=""
              className="w-full rounded-sm border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm"
            >
              <option value="" disabled>
                — اختار —
              </option>
              {clientList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.nameAr}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="العنوان (عربي)">
              <input
                type="text"
                name="titleAr"
                placeholder="فيديو إعلاني — حمله الصيف"
                className="w-full rounded-sm border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm"
              />
            </Field>

            <Field label="Title (English) *">
              <input
                type="text"
                name="title"
                required
                placeholder="Summer Campaign Video"
                className="w-full rounded-sm border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm"
              />
            </Field>
          </div>

          <Field label="النوع">
            <select
              name="projectType"
              defaultValue="shoot"
              className="w-full rounded-sm border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm"
            >
              {projectTypeEnum.enumValues.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Project Manager">
              <select
                name="pmId"
                defaultValue=""
                className="w-full rounded-sm border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm"
              >
                <option value="">—</option>
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
                className="w-full rounded-sm border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm"
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

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="rounded-sm bg-yellow-500 px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-yellow-400"
            >
              إنشاء
            </button>
            <Link
              href="/projects"
              className="rounded-sm border border-neutral-800 px-4 py-2 text-sm text-neutral-400 hover:text-yellow-500"
            >
              إلغاء
            </Link>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-xs uppercase tracking-wide text-neutral-400">{label}</span>
      {children}
      {hint && <span className="block text-xs text-neutral-500">{hint}</span>}
    </label>
  );
}
