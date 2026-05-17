import { defineConfig } from '@trigger.dev/sdk/v3';
import { initSentry, Sentry } from './src/sentry';

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
  init: async () => {
    initSentry();
  },
  onFailure: async (payload, error, { ctx }) => {
    Sentry.captureException(error, {
      tags: {
        task: ctx.task.id,
        runId: ctx.run.id,
      },
      extra: { payload },
    });
  },
});
