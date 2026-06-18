/**
 * Piggyback task: the daily learning loop for the personal system — re-distills
 * each active owner's profile and regenerates insights. Invoked from the
 * insights-scanner. AI-gated server-side (no credits → graceful no-op).
 */
export async function runMeLearn(): Promise<{ ok: boolean; learned?: number } | { skipped: string }> {
  const baseUrl = process.env.ANTAGNA_BASE_URL;
  const cronSecret = process.env.CRON_SECRET;
  if (!baseUrl || !cronSecret) {
    console.warn('[me-learn] ANTAGNA_BASE_URL / CRON_SECRET missing');
    return { skipped: 'env_missing' };
  }
  try {
    const res = await fetch(`${baseUrl}/api/internal/me-learn`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cronSecret}`, 'Content-Type': 'application/json' },
    });
    const json = (await res.json().catch(() => ({}))) as { learned?: number };
    console.log('[me-learn]', { status: res.status, ...json });
    return { ok: res.ok, learned: json.learned };
  } catch (err) {
    console.error('[me-learn] failed:', err);
    return { skipped: 'error' };
  }
}
