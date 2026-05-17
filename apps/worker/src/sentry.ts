/**
 * Worker-side Sentry initialization. Imported at the top of each Trigger.dev
 * task entry point and via trigger.config.ts `init` hook.
 */
import * as Sentry from '@sentry/node';

let initialized = false;

export function initSentry() {
  if (initialized) return Sentry;
  const dsn = process.env.SENTRY_WORKER_DSN;
  if (!dsn) {
    console.warn('SENTRY_WORKER_DSN not set — Sentry disabled for this worker run');
    initialized = true;
    return Sentry;
  }
  Sentry.init({
    dsn,
    environment:
      process.env.TRIGGER_ENVIRONMENT_TYPE ??
      process.env.NODE_ENV ??
      'development',
    tracesSampleRate: 1.0,
  });
  initialized = true;
  return Sentry;
}

export { Sentry };
