import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 p-6 text-neutral-100">
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="text-sm text-neutral-400">404 — this page doesn&apos;t exist.</p>
        <Link
          href="/"
          className="inline-block rounded-md bg-yellow-500 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-yellow-400"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
