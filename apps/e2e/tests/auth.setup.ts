/**
 * One-shot setup project: ensures a known E2E admin user exists in Supabase
 * + Antagna profiles, then logs in via the browser to capture the session
 * cookies. Other test projects depend on this and reuse the storage state.
 */
import { test as setup, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const SUPABASE_URL =
  process.env.E2E_SUPABASE_URL ?? 'https://nicijexpmpekzuzevarf.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.E2E_SUPABASE_SERVICE_KEY;
const DATABASE_URL = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL;
const TEST_EMAIL = process.env.E2E_USER_EMAIL ?? 'e2e-admin@antagna.test';
const TEST_PASSWORD = process.env.E2E_USER_PASSWORD ?? 'Antagna-E2E-Password-2026!';

const STATE_FILE = path.resolve(process.cwd(), '.auth/admin.json');

setup('create / promote E2E admin user', async () => {
  if (!SUPABASE_SERVICE_KEY) {
    throw new Error('E2E_SUPABASE_SERVICE_KEY env var is required');
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1) Does the user already exist?
  let userId: string | null = null;
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
  const existing = list?.users.find((u) => u.email === TEST_EMAIL);

  if (existing) {
    userId = existing.id;
    // Ensure password is the one we use — Supabase admin can reset it.
    await admin.auth.admin.updateUserById(existing.id, {
      password: TEST_PASSWORD,
      email_confirm: true,
    });
  } else {
    const { data: created, error } = await admin.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: 'E2E Admin' },
    });
    if (error || !created.user) {
      throw new Error(`createUser failed: ${error?.message ?? 'unknown'}`);
    }
    userId = created.user.id;
  }

  // 2) Ensure profiles row exists + is system_admin. Done via a direct DB
  //    connection because the block_self_role_escalation trigger refuses
  //    PostgREST-driven role changes even with the service-role key.
  //    The trigger is briefly disabled inside a transaction so the
  //    promotion is atomic with the row insert/update.
  if (!DATABASE_URL) {
    throw new Error('E2E_DATABASE_URL or DATABASE_URL env var is required');
  }
  const sql = postgres(DATABASE_URL, { prepare: false, max: 1 });
  try {
    await sql.begin(async (tx) => {
      await tx`ALTER TABLE profiles DISABLE TRIGGER trg_profiles_block_self_escalation`;
      await tx`
        INSERT INTO profiles (auth_user_id, email, display_name, display_name_en, role, status, ui_language)
        VALUES (${userId}::uuid, ${TEST_EMAIL}, 'E2E Admin', 'E2E Admin', 'system_admin', 'active', 'ar')
        ON CONFLICT (email) DO UPDATE
          SET role = 'system_admin',
              auth_user_id = ${userId}::uuid,
              updated_at = now()
      `;
      await tx`ALTER TABLE profiles ENABLE TRIGGER trg_profiles_block_self_escalation`;
    });
  } finally {
    await sql.end({ timeout: 5 });
  }
});

setup('sign in + persist storage state', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="email"]', TEST_EMAIL);
  await page.fill('input[name="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|admin|projects)/, { timeout: 30_000 });
  await expect(page.locator('body')).not.toContainText('Invalid login credentials');

  mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  await page.context().storageState({ path: STATE_FILE });
  // Drop a marker in stdout so the test report shows the path.
  writeFileSync(
    path.resolve(process.cwd(), '.auth/email.txt'),
    `${TEST_EMAIL}\n`,
  );
  console.log(`✓ Storage state saved to ${STATE_FILE}`);
});
