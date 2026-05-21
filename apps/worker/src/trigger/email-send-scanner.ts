/**
 * Pillar 8 — Resend send loop.
 *
 * Every minute, asks the web app to drain approved drafts. The web side
 * owns the Resend client + DB writes; we just trigger.
 */
import { schedules } from '@trigger.dev/sdk';

export const emailSendScanner = schedules.task({
  id: 'email-send-scanner',
  cron: '* * * * *',
  maxDuration: 90,
  run: async (_payload, { ctx }) => {
    const baseUrl = process.env.ANTAGNA_BASE_URL;
    const cronSecret = process.env.CRON_SECRET;
    if (!baseUrl) throw new Error('ANTAGNA_BASE_URL is not set');
    if (!cronSecret) throw new Error('CRON_SECRET is not set');

    const startedAt = Date.now();
    const res = await fetch(
      `${baseUrl}/api/integrations/email/send-drafts?max=20`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cronSecret}`,
          'Content-Type': 'application/json',
        },
      },
    );
    const json = (await res.json()) as {
      ok: boolean;
      report?: { scanned: number; sent: number; failed: number };
      error?: string;
    };
    if (!res.ok || !json.ok) {
      throw new Error(`send-drafts failed: ${json.error ?? res.statusText}`);
    }

    return {
      runId: ctx.run.id,
      durationMs: Date.now() - startedAt,
      report: json.report,
    };
  },
});
