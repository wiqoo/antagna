/**
 * Quotation follow-up scanner.
 *
 * Every Saturday + Wednesday at 08:00 Asia/Riyadh, asks the web app to find
 * quotations that haven't converted to invoices and have been stalled (no email
 * movement) for 3+ days, and to notify the project's PM + Account Manager over
 * WhatsApp + email with an AI follow-up suggestion (or a cancel recommendation).
 *
 * The web route does all the work (DB + AI + WhatsApp + email). Authenticated
 * via Bearer CRON_SECRET. Idempotent — a 48h per-project cooldown prevents
 * double-sends.
 */
import { schedules } from '@trigger.dev/sdk';

const ENDPOINT = '/api/internal/quotation-followup';

export const quotationFollowupScanner = schedules.task({
  id: 'quotation-followup-scanner',
  cron: '0 5 * * 3,6', // 05:00 UTC = 08:00 Asia/Riyadh, Wed (3) + Sat (6)
  maxDuration: 300,
  run: async (_payload, { ctx }) => {
    const baseUrl = process.env.ANTAGNA_BASE_URL;
    const cronSecret = process.env.CRON_SECRET;
    if (!baseUrl || !cronSecret) {
      console.warn('[quotation-followup] ANTAGNA_BASE_URL / CRON_SECRET missing');
      return { ok: false, skipped: true };
    }

    const res = await fetch(`${baseUrl}${ENDPOINT}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cronSecret}`, 'Content-Type': 'application/json' },
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      scanned?: number;
      notified?: number;
      onCooldown?: number;
    };
    console.log('[quotation-followup]', { runId: ctx.run.id, status: res.status, ...json });
    return { ok: res.ok, ...json };
  },
});
