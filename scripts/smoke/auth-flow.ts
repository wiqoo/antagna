/**
 * Smoke test for Pillar 1 §1 acceptance criterion #1 + D-027 + migration 00006.
 *
 * 1. Sign up a throw-away test user via Supabase Auth (email + password).
 * 2. Verify the auth.users row exists.
 * 3. Verify the fn_on_auth_user_created trigger materialized a public.profiles row.
 * 4. Sign in with the same creds → expect access_token back.
 * 5. Clean up: delete the test user (and the cascade-via-cascade profile).
 *
 * Run from repo root with .env.local sourced:
 *   set -a && source .env.local && set +a && tsx scripts/smoke/auth-flow.ts
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  console.log('── Pillar 1 §1 #1 + D-027 + migration 00006 ──');

  const email = `smoke-${Date.now()}@antagna.test`;
  const password = 'Antagna2026!Test';
  const fullName = 'Smoke Test User';
  console.log(`test user: ${email}`);

  // 1) Sign up via the anon client (the path apps/web actually uses)
  const anonClient = createClient(SUPABASE_URL, ANON);
  const signUp = await anonClient.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (signUp.error) {
    console.error('signUp failed:', signUp.error.message);
    process.exit(1);
  }
  const userId = signUp.data.user?.id;
  if (!userId) {
    console.error('signUp returned no user id');
    process.exit(1);
  }
  console.log(`signed up: auth.users.id=${userId}`);

  // 2) Verify the profile row was created by the trigger.
  const admin = createClient(SUPABASE_URL, SERVICE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const profileQuery = await admin
    .from('profiles')
    .select('id, auth_user_id, email, full_name, role, active, created_at')
    .eq('auth_user_id', userId)
    .single();
  if (profileQuery.error || !profileQuery.data) {
    console.error('profiles row was NOT auto-created — trigger failed?');
    console.error(profileQuery.error?.message);
    await admin.auth.admin.deleteUser(userId);
    process.exit(1);
  }
  console.log('profile row auto-created via trigger:', profileQuery.data);

  // 3) Sign in
  const signIn = await anonClient.auth.signInWithPassword({ email, password });
  if (signIn.error || !signIn.data.session) {
    console.error('signIn failed:', signIn.error?.message);
    await admin.auth.admin.deleteUser(userId);
    process.exit(1);
  }
  console.log(
    `signed in: access_token=${signIn.data.session.access_token.slice(0, 24)}… expires_in=${signIn.data.session.expires_in}s`,
  );

  // 4) Cleanup — delete the auth user (cascade removes profile via FK ON DELETE).
  // Actually our profiles.auth_user_id is NOT ON DELETE CASCADE — it has no
  // reference (the auth.users table lives in another schema). So we delete
  // profiles manually too.
  await admin.from('profiles').delete().eq('auth_user_id', userId);
  const del = await admin.auth.admin.deleteUser(userId);
  if (del.error) {
    console.warn('cleanup deleteUser warning:', del.error.message);
  }
  console.log('cleaned up test user + profile');

  console.log('\n✓ PASS — criterion #1 + D-027 + auth-trigger verified');
  process.exit(0);
}

main().catch((err) => {
  console.error('FAIL:', err);
  process.exit(1);
});
