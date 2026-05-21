/**
 * Pillar 8/13 — Gmail scanner.
 *
 * Every 5 minutes:
 *   1) POST /api/integrations/gmail/sync     → pulls new threads/messages
 *   2) POST /api/integrations/gmail/summarize → Haiku summary + tags
 *
 * Authenticated via Bearer CRON_SECRET (no user session in the worker).
 * Both endpoints are idempotent — re-running is safe.
 */
import { schedules } from '@trigger.dev/sdk';

const SYNC_ENDPOINT = '/api/integrations/gmail/sync?sinceDays=7&maxThreads=50';
const SUMMARIZE_ENDPOINT = '/api/integrations/gmail/summarize?maxThreads=30';

export const gmailScanner = schedules.task({
  id: 'gmail-scanner',
  cron: '*/5 * * * *',
  maxDuration: 300,
  run: async (_payload, { ctx }) => {
    const baseUrl = process.env.ANTAGNA_BASE_URL;
    const cronSecret = process.env.CRON_SECRET;
    if (!baseUrl) throw new Error('ANTAGNA_BASE_URL is not set');
    if (!cronSecret) throw new Error('CRON_SECRET is not set');

    const headers = {
      Authorization: `Bearer ${cronSecret}`,
      'Content-Type': 'application/json',
    };

    const startedAt = Date.now();

    // 1) Ingest
    const syncRes = await fetch(`${baseUrl}${SYNC_ENDPOINT}`, {
      method: 'POST',
      headers,
    });
    const syncJson = (await syncRes.json()) as {
      ok: boolean;
      report?: {
        threadsFetched: number;
        threadsProcessed: number;
        messagesInserted: number;
        messagesSkipped: number;
        errors: unknown[];
      };
      error?: string;
    };
    if (!syncRes.ok || !syncJson.ok) {
      throw new Error(`sync failed: ${syncJson.error ?? syncRes.statusText}`);
    }

    // 2) Summarize — only worth running if we ingested anything new, or if
    //    there are still stale summaries from a previous failure.
    const summarizeRes = await fetch(`${baseUrl}${SUMMARIZE_ENDPOINT}`, {
      method: 'POST',
      headers,
    });
    const summarizeJson = (await summarizeRes.json()) as {
      ok: boolean;
      report?: {
        eligibleThreads: number;
        summarizedThreads: number;
        totalInputTokens: number;
        totalOutputTokens: number;
        estimatedCostUsd: number;
      };
      error?: string;
    };
    if (!summarizeRes.ok || !summarizeJson.ok) {
      // Don't fail the whole run if summarize fails — ingest already succeeded.
      console.error(
        `[gmail-scanner] summarize failed: ${summarizeJson.error ?? summarizeRes.statusText}`,
      );
    }

    return {
      runId: ctx.run.id,
      durationMs: Date.now() - startedAt,
      sync: syncJson.report,
      summarize: summarizeJson.report,
    };
  },
});
