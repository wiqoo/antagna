import { redirect } from 'next/navigation';
import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { db, profiles } from '@antagna/db';
import { PageHeader, Card, StatusPill } from '@antagna/ui';
import { Shell } from '@/components/Shell';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { MessageCircle, Smartphone } from 'lucide-react';
import { WhatsappLinkPanel } from './link-panel';

export const dynamic = 'force-dynamic';

export default async function MyWhatsappPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/settings/whatsapp');

  const [me] = await db
    .select({
      id: profiles.id,
      displayName: profiles.displayName,
      whatsappE164: profiles.whatsappE164,
      verificationCode: profiles.whatsappVerificationCode,
      verificationExpiresAt: profiles.whatsappVerificationExpiresAt,
    })
    .from(profiles)
    .where(eq(profiles.authUserId, user.id))
    .limit(1);

  if (!me) redirect('/login');

  const voltLine = process.env.WHATSAPP_OUR_E164 ?? '+966590989518';
  const codeIsActive =
    !!me.verificationCode &&
    me.verificationExpiresAt != null &&
    new Date(me.verificationExpiresAt) > new Date();

  return (
    <Shell user={{ email: user.email ?? '' }} activePath="/settings">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)]"
      >
        ← الإعدادات
      </Link>

      <PageHeader
        eyebrow="Settings · WhatsApp"
        title="اربط واتسابك"
        subtitle="عشان Volt Bot يعرفك ويرد عليك بمعلومات Antagna على WhatsApp."
      />

      <Card>
        <div className="flex items-center gap-3">
          <Smartphone size={18} className="text-[var(--accent)]" />
          <div className="flex-1">
            <p className="text-[12px] text-[var(--text-muted)]">حسابك:</p>
            <p className="text-[14px] font-semibold text-[var(--text)]">
              {me.displayName}
            </p>
          </div>
          {me.whatsappE164 ? (
            <StatusPill tone="success">مربوط</StatusPill>
          ) : codeIsActive ? (
            <StatusPill tone="warning">في انتظار الكود</StatusPill>
          ) : (
            <StatusPill tone="neutral">غير مربوط</StatusPill>
          )}
        </div>
      </Card>

      <WhatsappLinkPanel
        voltLine={voltLine}
        currentE164={me.whatsappE164 ?? null}
        activeCode={
          codeIsActive
            ? {
                code: me.verificationCode!,
                expiresAtIso: new Date(me.verificationExpiresAt!).toISOString(),
              }
            : null
        }
      />

      <Card>
        <div className="flex items-start gap-2 text-[12px] text-[var(--text-muted)]">
          <MessageCircle size={14} className="mt-0.5 text-[var(--accent)]" />
          <div>
            <p className="font-semibold text-[var(--text)]">إزاي بيشتغل؟</p>
            <ol className="mt-1 list-inside list-decimal space-y-1">
              <li>اضغط <strong>"وَلِّد كود"</strong> فوق</li>
              <li>هتشوف رقم من خانتين (مثال: 47)</li>
              <li>افتح واتسابك وابعت الرقم ده فقط على{' '}
                <span dir="ltr" className="font-mono">{voltLine}</span></li>
              <li>الـ bot يرد عليك بـ <strong>"تم الربط ✓"</strong> خلال ثوان</li>
              <li>بعد كده تقدر تسأله أي حاجة عن Antagna من نفس الرقم</li>
            </ol>
            <p className="mt-2 text-[var(--text-dim)]">
              الكود صالح لـ 10 دقايق. لو خلصت المدة، ولّد كود جديد.
            </p>
          </div>
        </div>
      </Card>
    </Shell>
  );
}
