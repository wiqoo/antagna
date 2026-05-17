import { NextResponse } from 'next/server';

/**
 * GET /api/sentry-test
 *
 * Throws an intentional error so Sentry's server SDK captures it. Used to verify
 * Pillar 1 §1 acceptance criterion #5 ("Sentry receives a test error").
 * Safe to leave around — the route is unauthenticated but only ever errors.
 */
export function GET() {
  throw new Error(
    `Antagna Sentry smoke test — server route, ${new Date().toISOString()}`,
  );
  // unreachable, but satisfies the TS return type
  return NextResponse.json({ ok: true });
}
