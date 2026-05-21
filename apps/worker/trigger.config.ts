import { defineConfig } from '@trigger.dev/sdk';
import { syncEnvVars } from '@trigger.dev/build/extensions/core';
import { initSentry, Sentry } from './src/sentry';

// Env vars the worker reads at runtime. Pushed to Trigger.dev's cloud env
// during `trigger.dev deploy` so the deployed worker has the same secrets
// the local code expects.
const RUNTIME_ENV_VARS = [
  'DATABASE_URL',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'SENTRY_WORKER_DSN',
  'CRON_SECRET',
  'ANTAGNA_BASE_URL',
] as const;

export default defineConfig({
  project: 'proj_zadghdsrpvayniyyptlp',
  runtime: 'node',
  logLevel: 'log',
  maxDuration: 300,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1_000,
      maxTimeoutInMs: 10_000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ['./src/trigger'],
  build: {
    extensions: [
      syncEnvVars(() =>
        RUNTIME_ENV_VARS.flatMap((name) => {
          const value = process.env[name];
          return value ? [{ name, value }] : [];
        }),
      ),
    ],
  },
  init: async () => {
    initSentry();
  },
  onFailure: async ({ payload, error, ctx }) => {
    Sentry.captureException(error, {
      tags: {
        task: ctx.task.id,
        runId: ctx.run.id,
      },
      extra: { payload },
    });
  },
});
