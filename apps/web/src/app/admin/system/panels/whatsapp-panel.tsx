import { Card, CardHeader, StatBox, StatusPill } from '@antagna/ui';
import { MessageCircle, Users, Wifi } from 'lucide-react';
import { WhatsappControls } from './whatsapp-controls';
import type { WhatsappSettings } from '@/lib/whatsapp-settings';

export function WhatsappPanel({
  settings,
  positions,
  registered,
  connection,
  canManage,
}: {
  settings: WhatsappSettings;
  positions: { key: string; nameAr: string }[];
  registered: { name: string; e164: string }[];
  connection: 'open' | 'connecting' | 'close' | 'unknown';
  canManage: boolean;
}) {
  const connLabel =
    connection === 'open' ? 'متصل' : connection === 'connecting' ? 'يتصل…' : connection === 'close' ? 'مقطوع' : 'غير معروف';
  const connTone = connection === 'open' ? 'success' : connection === 'connecting' ? 'warning' : 'danger';

  return (
    <div className="space-y-4">
      {/* Status */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatBox
          label="اتصال البريدج"
          value={connection === 'open' ? 1 : 0}
          format={connLabel}
          icon={<Wifi size={16} />}
          tone={connection === 'open' ? 'success' : connection === 'connecting' ? 'warning' : 'danger'}
        />
        <StatBox
          label="حالة البوت"
          value={settings.enabled ? 1 : 0}
          format={!settings.enabled ? 'موقوف' : settings.replyMode === 'auto' ? 'يرد تلقائياً' : settings.replyMode === 'draft' ? 'مسودات' : 'بدون رد'}
          icon={<MessageCircle size={16} />}
          tone={settings.enabled && settings.replyMode === 'auto' ? 'success' : 'default'}
        />
        <StatBox
          label="أرقام مسجّلة"
          value={registered.length}
          icon={<Users size={16} />}
          sub="فريق متّصل بالبوت"
        />
      </section>

      {connection !== 'open' && (
        <Card>
          <StatusPill tone={connTone as 'success' | 'warning' | 'danger'}>
            البريدج {connLabel} — لو مقطوع: شغّل التَنَل (whatsapp.antagna.me → localhost:21465) وتأكد إن WHATSAPP_API_URL مظبوط.
          </StatusPill>
        </Card>
      )}

      {registered.length > 0 && (
        <Card>
          <CardHeader title="الأرقام المسجّلة" subtitle="الفريق اللي البوت بيرد عليه" />
          <ul className="mt-3 flex flex-wrap gap-2">
            {registered.map((r) => (
              <li key={r.e164} className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-[12px]">
                <span className="text-[var(--text)]">{r.name}</span>
                <span className="font-mono text-[10px] text-[var(--text-dim)]" dir="ltr">{r.e164}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader title="تحكّم البوت" subtitle="تشغيل/إيقاف · أسلوب الرد · الشخصية · القدرات · الصلاحيات · النموذج — كله من هنا." />
        <div className="mt-4">
          <WhatsappControls
            initial={settings}
            positions={positions}
            registered={registered}
            canManage={canManage}
          />
        </div>
      </Card>
    </div>
  );
}
