import { defineConfig } from '@trigger.dev/sdk/v3';

export default defineConfig({
  // Project ref is set during `trigger.dev init` — replaced before first deploy.
  project: process.env.TRIGGER_PROJECT_REF ?? 'proj_TBD',
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
});
