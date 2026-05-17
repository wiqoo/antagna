import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login?next=/dashboard');

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold">Antagna</h1>
          <p className="text-xs text-neutral-500">
            Internal operating system — Pillar 1 placeholder
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-neutral-400">{user.email}</span>
          <form action="/auth/logout" method="POST">
            <button
              type="submit"
              className="rounded-md border border-neutral-800 px-3 py-1.5 text-sm hover:border-yellow-500"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <section className="mx-auto max-w-3xl space-y-4 p-6">
        <div className="rounded-md border border-neutral-800 bg-neutral-900 p-4">
          <h2 className="text-sm font-medium text-neutral-300">Welcome</h2>
          <p className="mt-1 text-sm text-neutral-400">
            You're signed in. This is the empty placeholder per Pillar 1 §1 success
            criterion #1. Feature surfaces arrive in Pillars 2–15.
          </p>
        </div>
        <div className="rounded-md border border-neutral-800 bg-neutral-900 p-4">
          <h2 className="text-sm font-medium text-neutral-300">Your auth context</h2>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <dt className="text-neutral-500">user_id</dt>
            <dd className="col-span-2 font-mono text-neutral-300">{user.id}</dd>
            <dt className="text-neutral-500">email</dt>
            <dd className="col-span-2 font-mono text-neutral-300">{user.email}</dd>
            <dt className="text-neutral-500">last sign-in</dt>
            <dd className="col-span-2 font-mono text-neutral-300">
              {user.last_sign_in_at ?? 'just now'}
            </dd>
          </dl>
        </div>
      </section>
    </main>
  );
}
