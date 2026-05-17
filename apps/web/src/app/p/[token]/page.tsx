import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

type PortalProject = {
  id: string;
  code: string;
  title: string;
  title_ar: string | null;
  description: string | null;
  stage: string;
  project_type: string;
  shoot_starts_at: string | null;
  shoot_ends_at: string | null;
  delivery_due_at: string | null;
  delivered_at: string | null;
};

type PortalDeliverable = {
  id: string;
  group_id: string;
  item_number: string | null;
  title: string | null;
  status: string;
  current_version_url: string | null;
  current_version_number: number;
  latest_client_note: string | null;
  latest_client_note_at: string | null;
  updated_at: string | null;
};

type PortalGroup = {
  id: string;
  name_ar: string;
  name_en: string | null;
  kind: string | null;
  position: number;
};

type PortalPayload = {
  error?: string;
  project?: PortalProject;
  audience_label?: string | null;
  show_sections?: string[];
  expires_at?: string | null;
  deliverables?: PortalDeliverable[];
  deliverable_groups?: PortalGroup[];
};

async function loadShared(token: string): Promise<PortalPayload | null> {
  // Use the anon client; fn_get_shared_project is SECURITY DEFINER + granted to anon.
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await client.rpc('fn_get_shared_project', { p_token: token });
  if (error) {
    console.error('portal RPC error', error);
    return null;
  }
  return data as PortalPayload | null;
}

export default async function PortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const payload = await loadShared(token);

  if (!payload || payload.error) {
    notFound();
  }

  const { project, deliverables, deliverable_groups, audience_label, expires_at } = payload;
  if (!project) notFound();

  const groupsById = new Map(
    (deliverable_groups ?? []).map((g) => [g.id, g] as const),
  );

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 px-6 py-5">
        <p className="text-xs uppercase tracking-wide text-neutral-500">
          Antagna · Shared project view
          {audience_label ? ` · ${audience_label}` : ''}
        </p>
        <h1 className="mt-1 text-2xl font-semibold">{project.title_ar ?? project.title}</h1>
        <p className="mt-1 font-mono text-sm text-neutral-400">{project.code}</p>
        {project.description && (
          <p className="mt-4 max-w-3xl text-sm text-neutral-300">{project.description}</p>
        )}
      </header>

      <section className="mx-auto max-w-4xl space-y-6 p-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Stage" value={project.stage} />
          <Stat label="Type" value={project.project_type} />
          <Stat label="Shoot" value={fmtDate(project.shoot_starts_at)} />
          <Stat label="Delivery due" value={fmtDate(project.delivery_due_at)} />
        </div>

        {deliverable_groups && deliverable_groups.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">Deliverables</h2>
            {deliverable_groups.map((g) => {
              const items = (deliverables ?? []).filter((d) => d.group_id === g.id);
              return (
                <div key={g.id} className="rounded-md border border-neutral-800 bg-neutral-900">
                  <div className="border-b border-neutral-800 px-4 py-3">
                    <span className="text-sm font-medium">{g.name_ar}</span>
                    {g.name_en && (
                      <span className="ml-2 text-xs text-neutral-500">{g.name_en}</span>
                    )}
                  </div>
                  {items.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-neutral-500">No items yet.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-neutral-800 text-left text-xs uppercase text-neutral-500">
                          <th className="px-4 py-2 font-medium">#</th>
                          <th className="px-4 py-2 font-medium">Title</th>
                          <th className="px-4 py-2 font-medium">Status</th>
                          <th className="px-4 py-2 font-medium">Version</th>
                          <th className="px-4 py-2 font-medium">Latest note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((d) => (
                          <tr key={d.id} className="border-b border-neutral-800 last:border-0">
                            <td className="px-4 py-2 font-mono text-xs">{d.item_number ?? '—'}</td>
                            <td className="px-4 py-2">
                              {d.current_version_url ? (
                                <a
                                  href={d.current_version_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-yellow-400 hover:underline"
                                >
                                  {d.title ?? `Item ${d.item_number ?? d.id.slice(0, 8)}`}
                                </a>
                              ) : (
                                d.title ?? '—'
                              )}
                            </td>
                            <td className="px-4 py-2 text-xs uppercase">{d.status}</td>
                            <td className="px-4 py-2 font-mono text-xs">
                              v{d.current_version_number}
                            </td>
                            <td className="px-4 py-2 text-xs text-neutral-400">
                              {d.latest_client_note ?? '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <footer className="pt-8 text-xs text-neutral-600">
          {expires_at ? <>Link expires {fmtDate(expires_at)} · </> : null}
          Internal notes, costs, and team assignments are not shown.
        </footer>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-900 p-3">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 font-mono text-sm">{value}</div>
    </div>
  );
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-CA');
}
