import { Card, CardHeader, StatusPill, EmptyState } from '@antagna/ui';
import { KeyRound, ShieldCheck, ShieldOff, Plug } from 'lucide-react';
import { RevokeButton } from './revoke-button';

interface EnvProbe {
  name: string;
  present: boolean;
  tail: string | null;
}

interface TokenRow {
  id: string;
  provider: string;
  subject: string;
  scopes: string[] | null;
  expiresAt: string | null;
  lastRefreshedAt: string | null;
  lastRefreshError: string | null;
  revoked: boolean;
}

type TokenHealth = { tone: 'success' | 'warning' | 'danger' | 'neutral'; label: string };

function tokenHealth(t: TokenRow): TokenHealth {
  if (t.revoked) return { tone: 'neutral', label: 'مُبطَل' };
  if (t.lastRefreshError) return { tone: 'danger', label: 'خطأ تجديد' };
  if (t.expiresAt) {
    const ms = new Date(t.expiresAt).getTime() - Date.now();
    if (ms <= 0) return { tone: 'danger', label: 'منتهي' };
    if (ms <= 7 * 24 * 60 * 60 * 1000) return { tone: 'warning', label: 'ينتهي قريبًا' };
  }
  return { tone: 'success', label: 'سليم' };
}

function fmt(ts: string | null): string {
  if (!ts) return '—';
  return new Date(ts).toISOString().slice(0, 16).replace('T', ' ');
}

export function KeysPanel({
  env,
  tokens,
  canManage,
}: {
  env: EnvProbe[];
  tokens: TokenRow[];
  canManage: boolean;
}) {
  const presentCount = env.filter((e) => e.present).length;

  return (
    <div className="space-y-4">
      {/* Env probe */}
      <Card padded={false}>
        <div className="p-6 pb-4">
          <CardHeader
            title="متغيّرات البيئة (Env)"
            subtitle={`${presentCount}/${env.length} مُعرَّف · القيم لا تُعرض أبدًا — فقط وجودها وآخر 4 أحرف`}
          />
        </div>
        <div className="grid grid-cols-1 gap-px overflow-hidden border-t border-[var(--line)] bg-[var(--line)] sm:grid-cols-2">
          {env.map((e) => (
            <div
              key={e.name}
              className="flex items-center justify-between gap-3 bg-[var(--surface)] px-5 py-3"
            >
              <div className="flex items-center gap-2 min-w-0">
                <KeyRound size={13} className="shrink-0 text-[var(--text-dim)]" />
                <span className="truncate font-mono text-xs text-[var(--text)]">{e.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {e.present && (
                  <span className="font-mono text-[10px] text-[var(--text-dim)]">…{e.tail}</span>
                )}
                <StatusPill tone={e.present ? 'success' : 'danger'}>
                  {e.present ? 'مُعرَّف' : 'غير موجود'}
                </StatusPill>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* OAuth tokens */}
      <Card padded={false}>
        <div className="p-6 pb-4">
          <CardHeader title="توكنات OAuth" subtitle={`${tokens.length} توكن مُسجَّل في oauth_tokens`} />
        </div>
        {tokens.length === 0 ? (
          <EmptyState
            icon={<Plug size={20} />}
            title="لا توكنات بعد"
            description="تُضاف عند ربط Google أو منصّات السوشيال. تابع الصحة وأبطِل التوكنات من هنا."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-[var(--line)] bg-[var(--bg-elevated)]/40 text-start text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-dim)]">
                  <th className="px-5 py-3 text-start">المزوّد</th>
                  <th className="px-5 py-3 text-start">الموضوع</th>
                  <th className="px-5 py-3 text-start">الصلاحيات</th>
                  <th className="px-5 py-3 text-start">ينتهي</th>
                  <th className="px-5 py-3 text-start">آخر تجديد</th>
                  <th className="px-5 py-3 text-start">الصحة</th>
                  <th className="px-5 py-3 text-end"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {tokens.map((t) => {
                  const h = tokenHealth(t);
                  return (
                    <tr key={t.id} className="hover:bg-[var(--surface-hover)]">
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-xs text-[var(--text)]">{t.provider}</span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-[var(--text-muted)]">
                        {t.subject}
                      </td>
                      <td className="px-5 py-3.5">
                        {t.scopes && t.scopes.length > 0 ? (
                          <span className="text-xs text-[var(--text-dim)]">
                            {t.scopes.length} scope{t.scopes.length === 1 ? '' : 's'}
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--text-dim)]">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-[var(--text-dim)]">
                        {fmt(t.expiresAt)}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-[var(--text-dim)]">
                        {fmt(t.lastRefreshedAt)}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusPill tone={h.tone}>{h.label}</StatusPill>
                        {t.lastRefreshError && (
                          <p className="mt-1 max-w-[16rem] truncate text-[10px] text-[var(--danger)]">
                            {t.lastRefreshError}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-end">
                        {!t.revoked && canManage ? (
                          <RevokeButton id={t.id} />
                        ) : t.revoked ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-[var(--text-dim)]">
                            <ShieldOff size={11} /> مُبطَل
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-[var(--text-dim)]">
                            <ShieldCheck size={11} />
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
