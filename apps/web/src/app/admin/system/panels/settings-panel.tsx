import { Card, CardHeader, EmptyState } from '@antagna/ui';
import { SlidersHorizontal } from 'lucide-react';
import { SettingsEditor } from './settings-editor';

interface SettingRow {
  key: string;
  value: unknown;
  updatedAt: string;
}

export function SettingsPanel({
  settings,
  canManage,
}: {
  settings: SettingRow[];
  canManage: boolean;
}) {
  return (
    <Card padded={false}>
      <div className="p-6 pb-4">
        <CardHeader
          title="إعدادات النظام"
          subtitle="جدول system_settings — مفتاح + قيمة JSON. تُحفظ بعد التحقّق من صحة الـ JSON."
        />
      </div>
      {settings.length === 0 && !canManage ? (
        <EmptyState
          icon={<SlidersHorizontal size={20} />}
          title="لا إعدادات بعد"
          description="تُضاف من بقية تبويبات الكونسول أو يدويًا."
        />
      ) : (
        <SettingsEditor
          settings={settings.map((s) => ({
            key: s.key,
            value: JSON.stringify(s.value, null, 2),
            updatedAt: s.updatedAt,
          }))}
          canManage={canManage}
        />
      )}
    </Card>
  );
}
