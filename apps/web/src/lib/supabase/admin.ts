import { createClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client. Use ONLY in server actions / route handlers
 * for actions the authenticated user can't do via RLS (e.g. creating signed
 * upload URLs against a private bucket, admin queries).
 */
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set',
    );
  }
  return createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
