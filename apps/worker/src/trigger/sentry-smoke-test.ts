import { task } from '@trigger.dev/sdk/v3';
import { Sentry } from '../sentry';

/**
 * Pillar 1 §1 acceptance criterion #5 (worker side):
 *   Sends a test event to Sentry and waits for delivery.
 *
 * Doesn't actually throw — we just push a captured exception so the dashboard
 * shows it without the Trigger.dev retry chain getting involved.
 */
export const sentrySmokeTest = task({
  id: 'sentry-smoke-test',
  maxDuration: 30,
  run: async (payload: { note?: string }) => {
    const eventId = Sentry.captureException(
      new Error(
        `Antagna worker Sentry smoke test — ${payload.note ?? 'no note'} — ${new Date().toISOString()}`,
      ),
    );

    // Wait for the event to be sent to Sentry before the task returns.
    await Sentry.flush(5000);

    return { eventId, sentryDsnConfigured: Boolean(process.env.SENTRY_WORKER_DSN) };
  },
});
