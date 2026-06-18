/**
 * Piggyback task: daily personal reminders (overdue tasks / aged waiting-on) for
 * the personal system. Invoked from the insights-scanner.
 */
export async function runMeReminders(): Promise<{ ok: boolean; sent?: number } | { skipped: string }> {
  const baseUrl = process.env.ANTAGNA_BASE_URL;
  const cronSecret = process.env.CRON_SECRET;
  if (!baseUrl || !cronSecret) {
    console.warn('[me-reminders] ANTAGNA_BASE_URL / CRON_SECRET missing');
    return { skipped: 'env_missing' };
  }
  try {
    const res = await fetch(`${baseUrl}/api/internal/me-reminders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cronSecret}`, 'Content-Type': 'application/json' },
    });
    const json = (await res.json().catch(() => ({}))) as { sent?: number };
    console.log('[me-reminders]', { status: res.status, ...json });
    return { ok: res.ok, sent: json.sent };
  } catch (err) {
    console.error('[me-reminders] failed:', err);
    return { skipped: 'error' };
  }
}
