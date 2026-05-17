import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { AppShell, StatusPill, Kbd } from '@antagna/ui';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login?next=/dashboard');

  return (
    <AppShell user={{ email: user.email ?? '' }} activePath="/dashboard">
      <div className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold">Antagna</h1>
          <p className="text-sm text-neutral-500">
            Internal operating system — Pillar 12 shell live.
          </p>
        </header>

        <section className="rounded-md border border-neutral-800 bg-neutral-900 p-4">
          <h2 className="mb-3 text-sm font-medium">Welcome</h2>
          <p className="text-sm text-neutral-400">
            You're signed in. Feature surfaces (Projects, CRM, Equipment, KPIs)
            are scaffolded on the sidebar and arrive as their pillars get UI work.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
            <span>Try the command palette:</span>
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
            <span className="ml-2 text-neutral-600">(scaffolded in Pillar 12; UI TBD)</span>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-md border border-neutral-800 bg-neutral-900 p-4">
            <h3 className="mb-2 text-xs uppercase tracking-wide text-neutral-500">Auth context</h3>
            <dl className="grid grid-cols-3 gap-2 text-xs">
              <dt className="text-neutral-500">user_id</dt>
              <dd className="col-span-2 break-all font-mono text-neutral-300">{user.id}</dd>
              <dt className="text-neutral-500">email</dt>
              <dd className="col-span-2 break-all font-mono text-neutral-300">{user.email}</dd>
              <dt className="text-neutral-500">last sign-in</dt>
              <dd className="col-span-2 font-mono text-neutral-300">
                {user.last_sign_in_at ?? 'just now'}
              </dd>
            </dl>
          </div>

          <div className="rounded-md border border-neutral-800 bg-neutral-900 p-4">
            <h3 className="mb-2 text-xs uppercase tracking-wide text-neutral-500">Pillars done</h3>
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-center justify-between">
                <span>1 · Foundations</span>
                <StatusPill tone="success">PASS</StatusPill>
              </li>
              <li className="flex items-center justify-between">
                <span>2 · Data Model</span>
                <StatusPill tone="success">PASS</StatusPill>
              </li>
              <li className="flex items-center justify-between">
                <span>3 · Identity</span>
                <StatusPill tone="success">PASS</StatusPill>
              </li>
              <li className="flex items-center justify-between">
                <span>4 · CRM (schema)</span>
                <StatusPill tone="info">SCHEMA</StatusPill>
              </li>
              <li className="flex items-center justify-between">
                <span>5 · Lifecycle</span>
                <StatusPill tone="success">PASS</StatusPill>
              </li>
              <li className="flex items-center justify-between">
                <span>6 · Equipment</span>
                <StatusPill tone="success">PASS</StatusPill>
              </li>
              <li className="flex items-center justify-between">
                <span>7 · Social</span>
                <StatusPill tone="info">SCHEMA</StatusPill>
              </li>
              <li className="flex items-center justify-between">
                <span>8 · Comms</span>
                <StatusPill tone="info">SCHEMA</StatusPill>
              </li>
              <li className="flex items-center justify-between">
                <span>9 · Attendance/KPI</span>
                <StatusPill tone="info">SCHEMA</StatusPill>
              </li>
              <li className="flex items-center justify-between">
                <span>10 · AI/Memory</span>
                <StatusPill tone="info">SCHEMA</StatusPill>
              </li>
              <li className="flex items-center justify-between">
                <span>11 · Automation</span>
                <StatusPill tone="info">SCHEMA</StatusPill>
              </li>
              <li className="flex items-center justify-between">
                <span>12 · UI shell</span>
                <StatusPill tone="warning">FOUNDATIONS</StatusPill>
              </li>
            </ul>
          </div>

          <div className="rounded-md border border-neutral-800 bg-neutral-900 p-4">
            <h3 className="mb-2 text-xs uppercase tracking-wide text-neutral-500">Live integrations</h3>
            <ul className="space-y-1.5 text-xs">
              <li className="flex items-center justify-between">
                <span>Supabase auth</span>
                <StatusPill tone="success">UP</StatusPill>
              </li>
              <li className="flex items-center justify-between">
                <span>pg_cron heartbeat</span>
                <StatusPill tone="success">TICKING</StatusPill>
              </li>
              <li className="flex items-center justify-between">
                <span>Sentry web</span>
                <StatusPill tone="success">RECEIVING</StatusPill>
              </li>
              <li className="flex items-center justify-between">
                <span>Trigger.dev worker</span>
                <StatusPill tone="warning">DEV KEY</StatusPill>
              </li>
            </ul>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
