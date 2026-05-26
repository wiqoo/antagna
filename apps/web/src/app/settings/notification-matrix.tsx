'use client';

import { useState, useTransition } from 'react';
import { Save, Check } from 'lucide-react';
import {
  NOTIFICATION_EVENTS,
  CHANNELS,
  type Channel,
  type ChannelPrefs,
} from './notif-prefs';
import { updateNotificationPrefs } from './actions';

/**
 * Per-event notification preferences as toggle chips per channel
 * (in-app / email / WhatsApp). Saves the whole matrix in one action.
 */
export function NotificationMatrix({
  initial,
}: {
  initial: Record<string, ChannelPrefs>;
}) {
  const [prefs, setPrefs] = useState(initial);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [pending, start] = useTransition();

  const toggle = (event: string, ch: Channel) =>
    setPrefs((p) => {
      const cur = p[event] ?? { inApp: false, email: false, whatsapp: false };
      const next: ChannelPrefs = { ...cur, [ch]: !cur[ch] };
      return { ...p, [event]: next };
    });

  const save = () =>
    start(async () => {
      await updateNotificationPrefs(prefs);
      setSavedAt(Date.now());
    });

  return (
    <div className="space-y-3">
      {NOTIFICATION_EVENTS.map((ev) => (
        <div
          key={ev.key}
          className="rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] p-3"
        >
          <p className="text-sm font-medium text-[var(--text)]">{ev.ar}</p>
          {ev.hintAr && (
            <p className="text-xs text-[var(--text-muted)]">{ev.hintAr}</p>
          )}
          <div className="mt-2.5 flex flex-wrap gap-2">
            {CHANNELS.map((c) => {
              const on = !!prefs[ev.key]?.[c.key];
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => toggle(ev.key, c.key)}
                  aria-pressed={on}
                  className={
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] transition-colors ' +
                    (on
                      ? 'border-[var(--accent)]/50 bg-[var(--accent)]/10 text-[var(--accent)]'
                      : 'border-[var(--line)] text-[var(--text-dim)] hover:text-[var(--text)]')
                  }
                >
                  {on ? (
                    <Check size={12} />
                  ) : (
                    <span className="h-3 w-3 rounded-full border border-current opacity-40" />
                  )}
                  {c.ar}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="flex items-center justify-end gap-3">
        {savedAt && (
          <span className="inline-flex items-center gap-1 text-[12px] text-emerald-400">
            <Check size={13} /> حُفظ
          </span>
        )}
        <button
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-2 text-[13px] font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Save size={14} /> {pending ? 'يحفظ…' : 'حفظ تفضيلات الإشعارات'}
        </button>
      </div>
    </div>
  );
}
