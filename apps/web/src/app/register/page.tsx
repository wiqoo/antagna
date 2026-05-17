import Link from 'next/link';
import { registerAction } from './actions';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function RegisterPage(props: { searchParams: SearchParams }) {
  const params = await props.searchParams;
  const error = typeof params.error === 'string' ? params.error : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 p-6 text-neutral-100">
      <div className="w-full max-w-sm space-y-6">
        <header>
          <h1 className="text-2xl font-semibold">Create your Antagna account</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Any email works — admin will assign your role after sign-up.
          </p>
        </header>

        <form action={registerAction} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="full_name" className="block text-sm">Full name</label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              required
              autoComplete="name"
              autoFocus
              className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-yellow-500"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="email" className="block text-sm">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
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
              autoComplete="new-password"
              minLength={8}
              className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-yellow-500"
            />
            <p className="text-xs text-neutral-500">At least 8 characters.</p>
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
            Create account
          </button>
        </form>

        <p className="text-center text-sm text-neutral-400">
          Already have an account?{' '}
          <Link href="/login" className="text-yellow-400 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
