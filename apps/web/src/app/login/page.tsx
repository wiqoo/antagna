import Link from 'next/link';
import { loginAction } from './actions';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage(props: { searchParams: SearchParams }) {
  const params = await props.searchParams;
  const error = typeof params.error === 'string' ? params.error : null;
  const next = typeof params.next === 'string' ? params.next : '/dashboard';

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 p-6 text-neutral-100">
      <div className="w-full max-w-sm space-y-6">
        <header>
          <h1 className="text-2xl font-semibold">Sign in to Antagna</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Use your work email and password.
          </p>
        </header>

        <form action={loginAction} className="space-y-4">
          <input type="hidden" name="next" value={next} />

          <div className="space-y-1">
            <label htmlFor="email" className="block text-sm">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-yellow-500"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="block text-sm">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              minLength={8}
              className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-yellow-500"
            />
          </div>

          {error && (
            <p className="rounded-md border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-md bg-yellow-500 px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-yellow-400"
          >
            Sign in
          </button>
        </form>

        <p className="text-center text-sm text-neutral-400">
          No account?{' '}
          <Link href="/register" className="text-yellow-400 hover:underline">
            Register
          </Link>
        </p>
      </div>
    </main>
  );
}
