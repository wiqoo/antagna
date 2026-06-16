/**
 * Piggyback task (no own Trigger.dev schedule — stays under the Pro 10-schedule
 * cap): reminds Volt + partners about external-job final deadlines due within
 * 48h. Invoked once a day from the insights-scanner.
 */
export async function runExternalDeadlines(): Promise<
  { ok: boolean; reminded?: number } | { skipped: string }
> {
  const baseUrl = process.env.ANTAGNA_BASE_URL;
  const cronSecret = process.env.CRON_SECRET;
  if (!baseUrl || !cronSecret) {
    console.warn('[external-deadlines] ANTAGNA_BASE_URL / CRON_SECRET missing');
    return { skipped: 'env_missing' };
  }
  try {
    const res = await fetch(`${baseUrl}/api/internal/external-deadlines`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cronSecret}`, 'Content-Type': 'application/json' },
    });
    const json = (await res.json().catch(() => ({}))) as { reminded?: number };
    console.log('[external-deadlines]', { status: res.status, ...json });
    return { ok: res.ok, reminded: json.reminded };
  } catch (err) {
    console.error('[external-deadlines] failed:', err);
    return { skipped: 'error' };
  }
}
