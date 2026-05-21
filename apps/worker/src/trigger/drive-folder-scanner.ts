/**
 * Pillar 13 — Drive folder auto-create.
 *
 * Every 2 minutes, asks the web app to scan projects without a Drive folder
 * and create the standard folder tree for them. Web-side does the actual
 * Drive API calls (it owns the Google client) — we just trigger it.
 */
import { schedules } from '@trigger.dev/sdk';

export const driveFolderScanner = schedules.task({
  id: 'drive-folder-scanner',
  cron: '*/2 * * * *',
  maxDuration: 300,
  run: async (_payload, { ctx }) => {
    const baseUrl = process.env.ANTAGNA_BASE_URL;
    const cronSecret = process.env.CRON_SECRET;
    if (!baseUrl) throw new Error('ANTAGNA_BASE_URL is not set');
    if (!cronSecret) throw new Error('CRON_SECRET is not set');

    const startedAt = Date.now();
    const res = await fetch(
      `${baseUrl}/api/integrations/drive/scan?max=10`,
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
      report?: {
        scanned: number;
        created: number;
        errors: { id: string; error: string }[];
      };
      error?: string;
    };

    if (!res.ok || !json.ok) {
      throw new Error(`drive scan failed: ${json.error ?? res.statusText}`);
    }

    return {
      runId: ctx.run.id,
      durationMs: Date.now() - startedAt,
      report: json.report,
    };
  },
});
