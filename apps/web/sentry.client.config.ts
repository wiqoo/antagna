import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',

  // Session replays are off until Pillar 9/12 — they're noisy + privacy-touchy.
  replaysOnErrorSampleRate: 0,
  replaysSessionSampleRate: 0,

  tracesSampleRate: 1.0,
  debug: false,
});
