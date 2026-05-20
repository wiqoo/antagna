import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, profiles } from '@antagna/db';
import { PageHeader, Card, CardHeader, Button } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { Save } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { updateSettings } from './actions';

export const dynamic = 'force-dynamic';

type NotifPrefs = {
  email_digest?: boolean;
  on_assignment?: boolean;
  on_comment?: boolean;
  on_deadline?: boolean;
};

export default async function SettingsPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/settings');

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.authUserId, user.id))
    .limit(1);

  const prefs = ((profile?.notificationPrefs as NotifPrefs | null) ?? {
    email_digest: true,
    on_assignment: true,
    on_comment: true,
    on_deadline: true,
  });

  return (
    <Shell
      user={{ email: user.email ?? '', displayName: profile?.displayName }}
      activePath="/settings"
    >
      <div className="mx-auto max-w-3xl space-y-8">
        <PageHeader
          eyebrow="Settings"
          title="الإعدادات"
          subtitle="ملفك الشخصي، اللغة، والإشعارات"
        />

        <form action={updateSettings} className="space-y-6">
          <Card>
            <CardHeader title="الملف الشخصي" subtitle="اسمك وطرق التواصل" />
            <div className="space-y-4">
              <Field label="الاسم المعروض">
                <input
                  type="text"
                  name="displayName"
                  defaultValue={profile?.displayName ?? ''}
                  className="form-input"
                />
              </Field>

              <Field label="البريد الإلكتروني">
                <input
                  type="email"
                  disabled
                  value={profile?.email ?? user.email ?? ''}
                  className="form-input bg-[var(--surface)] !text-[var(--text-muted)]"
                />
                <span className="text-xs text-[var(--text-dim)]">
                  يُغيَّر من Supabase Auth فقط.
                </span>
              </Field>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="الهاتف (E.164)">
                  <input
                    type="tel"
                    name="phoneE164"
                    defaultValue={profile?.phoneE164 ?? ''}
                    placeholder="+9665xxxxxxxx"
                    className="form-input font-mono"
                  />
                </Field>
                <Field label="WhatsApp (E.164)">
                  <input
                    type="tel"
                    name="whatsappE164"
                    defaultValue={profile?.whatsappE164 ?? ''}
                    placeholder="+9665xxxxxxxx"
                    className="form-input font-mono"
                  />
                </Field>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="اللغة و المنطقة" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="لغة الواجهة">
                <select
                  name="uiLanguage"
                  defaultValue={profile?.uiLanguage ?? 'ar'}
                  className="form-input"
                >
                  <option value="ar">العربية</option>
                  <option value="en">English</option>
                </select>
              </Field>
              <Field label="المنطقة الزمنية">
                <select
                  name="timezone"
                  defaultValue={profile?.timezone ?? 'Asia/Riyadh'}
                  className="form-input"
                >
                  <option value="Asia/Riyadh">Asia/Riyadh (UTC+3)</option>
                  <option value="UTC">UTC</option>
                  <option value="Africa/Cairo">Africa/Cairo</option>
                  <option value="Asia/Dubai">Asia/Dubai</option>
                </select>
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="الإشعارات"
              subtitle="اختارما الذي تتلقى عنه إشعار"
            />
            <div className="space-y-3">
              <Toggle
                name="notifyEmailDigest"
                defaultChecked={prefs.email_digest ?? true}
                label="ملخص يومي بالبريد"
                hint="نشاط آخر 24 ساعة كل صباح"
              />
              <Toggle
                name="notifyOnAssignment"
                defaultChecked={prefs.on_assignment ?? true}
                label="عند التعيين على مشروع/مهمة"
              />
              <Toggle
                name="notifyOnComment"
                defaultChecked={prefs.on_comment ?? true}
                label="عند تعليق على مشروعك"
              />
              <Toggle
                name="notifyOnDeadline"
                defaultChecked={prefs.on_deadline ?? true}
                label="قرب موعد التسليم"
                hint="قبل 48 ساعة من الـ deadline"
              />
            </div>
          </Card>

          <div className="flex items-center gap-3">
            <Button variant="primary" size="lg" icon={<Save size={16} />}>
              حفظ الإعدادات
            </Button>
          </div>
        </form>
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
        .form-input:focus { outline: none; border-color: var(--accent); }
        .form-input:disabled { opacity: 0.7; cursor: not-allowed; }
      `}</style>
    </Shell>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium text-[var(--text)]">{label}</span>
      {children}
    </label>
  );
}

function Toggle({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] p-3 hover:bg-[var(--surface-hover)]">
      <div>
        <p className="text-sm font-medium text-[var(--text)]">{label}</p>
        {hint && <p className="text-xs text-[var(--text-muted)]">{hint}</p>}
      </div>
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-1 h-4 w-4 accent-[var(--accent)]"
      />
    </label>
  );
}
