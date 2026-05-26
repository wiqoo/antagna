import Link from 'next/link';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, profiles } from '@antagna/db';
import { PageHeader, Card, CardHeader, Button } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import {
  Save,
  MessageCircle,
  ChevronLeft,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { updateSettings } from './actions';
import { resolveNotifPrefs } from './notif-prefs';
import { NotificationMatrix } from './notification-matrix';
import { SecurityPanel } from './security-panel';

export const dynamic = 'force-dynamic';

const ADMIN_ROLES = ['system_admin', 'general_manager'];

export default async function SettingsPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/settings');

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.authUserId, user.id))
    .limit(1);

  const notifPrefs = resolveNotifPrefs(profile?.notificationPrefs);
  const isAdmin = ADMIN_ROLES.includes(profile?.role ?? '');
  const whatsappLinked = !!profile?.whatsappE164;

  return (
    <Shell
      user={{ email: user.email ?? '', displayName: profile?.displayName }}
      activePath="/settings"
    >
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          eyebrow="Account"
          title="حسابي"
          subtitle="ملفك الشخصي، اللغة، الإشعارات، وأمان الحساب — أنت تدير تجربتك بالكامل."
        />

        {/* Profile + language/region */}
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
                    dir="ltr"
                    className="form-input font-mono"
                  />
                </Field>
                <Field label="WhatsApp (E.164)">
                  <input
                    type="tel"
                    name="whatsappE164"
                    defaultValue={profile?.whatsappE164 ?? ''}
                    placeholder="+9665xxxxxxxx"
                    dir="ltr"
                    className="form-input font-mono"
                  />
                </Field>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="اللغة والمنطقة"
              subtitle="تبدّل لغة النظام بالكامل لك — العربية أو الإنجليزية"
            />
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

          <div className="flex items-center gap-3">
            <Button variant="primary" size="lg" icon={<Save size={16} />}>
              حفظ الملف واللغة
            </Button>
          </div>
        </form>

        {/* WhatsApp link */}
        <Card>
          <CardHeader
            title="ربط واتساب"
            subtitle="اربط رقمك لاستقبال الإشعارات والتفاعل مع المساعد"
          />
          <Link
            href="/settings/whatsapp"
            className="group flex items-center gap-3 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] p-3 transition-colors hover:border-[var(--accent)]/50"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--surface-hover)] text-[var(--text-muted)] group-hover:text-[var(--accent)]">
              <MessageCircle size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--text)]">
                {whatsappLinked ? 'واتساب مرتبط' : 'اربط واتساب'}
              </p>
              <p className="truncate text-xs text-[var(--text-muted)]">
                {whatsappLinked
                  ? profile?.whatsappE164
                  : 'لم يُربط بعد — اضغط للربط عبر رمز تحقق'}
              </p>
            </div>
            {whatsappLinked && (
              <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
            )}
            <ChevronLeft
              size={16}
              className="shrink-0 text-[var(--text-dim)] transition-transform group-hover:-translate-x-0.5 group-hover:text-[var(--accent)]"
            />
          </Link>
        </Card>

        {/* Notification channel matrix */}
        <Card>
          <CardHeader
            title="الإشعارات"
            subtitle="اختر قناة كل نوع إشعار — تصلك بنفس لغتك المختارة"
          />
          <NotificationMatrix initial={notifPrefs} />
        </Card>

        {/* Security */}
        <Card>
          <CardHeader title="الأمان" subtitle="غيّر كلمة المرور" />
          <SecurityPanel />
        </Card>

        {/* Admin-only */}
        {isAdmin && (
          <Card>
            <CardHeader
              title="أدوات المدير"
              subtitle="إدارة الأدوار والصلاحيات والمراقبة"
            />
            <Link
              href="/admin"
              className="group flex items-center gap-3 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] p-3 transition-colors hover:border-[var(--accent)]/50"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--surface-hover)] text-[var(--text-muted)] group-hover:text-[var(--accent)]">
                <ShieldCheck size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--text)]">
                  لوحة الإدارة
                </p>
                <p className="truncate text-xs text-[var(--text-muted)]">
                  المستخدمون، الصلاحيات، قواعد التنبيهات، والعرض كمستخدم آخر
                </p>
              </div>
              <ChevronLeft
                size={16}
                className="shrink-0 text-[var(--text-dim)] transition-transform group-hover:-translate-x-0.5 group-hover:text-[var(--accent)]"
              />
            </Link>
          </Card>
        )}
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
