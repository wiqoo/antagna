import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',

  // Adjust the sample rates when traffic grows. 100% in early dev keeps every
  // error + trace visible; we'll throttle once Pillar 11 alerts are tuned.
  tracesSampleRate: 1.0,

  // Print verbose Sentry logs to console only in dev.
  debug: false,
});
