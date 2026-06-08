/**
 * Overdue-reply escalation — every day at 08:00 Asia/Riyadh.
 *
 * Asks the web app to find high-importance email threads we owe a reply on that
 * have gone quiet (overdue 24h+), and notify Abu Luka + Khalid + the client's
 * account manager over in-app + email + WhatsApp. Idempotent (one send per day).
 */
import { schedules } from '@trigger.dev/sdk';

const ENDPOINT = '/api/internal/overdue-reply-followup';

export const overdueReplyNotifier = schedules.task({
  id: 'overdue-reply-notifier',
  cron: '0 5 * * *', // 05:00 UTC = 08:00 Asia/Riyadh, daily
  maxDuration: 300,
  run: async (_payload, { ctx }) => {
    const baseUrl = process.env.ANTAGNA_BASE_URL;
    const cronSecret = process.env.CRON_SECRET;
    if (!baseUrl || !cronSecret) {
      console.warn('[overdue-reply] ANTAGNA_BASE_URL / CRON_SECRET missing');
      return { ok: false, skipped: true };
    }
    const res = await fetch(`${baseUrl}${ENDPOINT}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cronSecret}`, 'Content-Type': 'application/json' },
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; atRisk?: number; notified?: number };
    console.log('[overdue-reply]', { runId: ctx.run.id, status: res.status, ...json });
    return { ok: res.ok, ...json };
  },
});
