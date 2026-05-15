import { z } from 'zod';

/**
 * Server-side env schema. Validated at boot in apps/web and apps/worker.
 * NEXT_PUBLIC_* go through the publicEnv schema below.
 */
export const serverEnv = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  DATABASE_URL: z.string().url(),

  // AI
  ANTHROPIC_API_KEY: z.string().startsWith('sk-ant-'),
  OPENAI_API_KEY: z.string().startsWith('sk-'),

  // Trigger.dev (worker only — apps/web doesn't need)
  TRIGGER_API_KEY: z.string().optional(),
  TRIGGER_SECRET_KEY: z.string().optional(),

  // Sentry
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),

  // Google Workspace
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  CRON_SECRET: z.string().min(32).optional(),
});

export type ServerEnv = z.infer<typeof serverEnv>;

export const publicEnv = serverEnv.pick({
  NODE_ENV: true,
  NEXT_PUBLIC_SUPABASE_URL: true,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: true,
  NEXT_PUBLIC_SENTRY_DSN: true,
  NEXT_PUBLIC_APP_URL: true,
});

export type PublicEnv = z.infer<typeof publicEnv>;

export function parseServerEnv(input: Record<string, string | undefined> = process.env): ServerEnv {
  const result = serverEnv.safeParse(input);
  if (!result.success) {
    console.error('Invalid server environment variables:');
    console.error(result.error.flatten().fieldErrors);
    throw new Error('Server env validation failed');
  }
  return result.data;
}
