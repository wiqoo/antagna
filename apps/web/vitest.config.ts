/**
 * Vitest config for the web app (plan gap #4: automated unit tests).
 *
 * Pure-logic tests only — anything that imports `@antagna/db` would pull a live
 * Drizzle client on file-load, so DB-bound modules stay out of unit tests and
 * are covered by the integration paths (E2E) instead.
 */
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    reporters: ['default'],
  },
});
