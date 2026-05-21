'use client';

import { useState, useTransition } from 'react';
import { Eye, EyeOff, ChevronDown, Loader2 } from 'lucide-react';
import { setViewAs, clearViewAs } from '@/lib/view-as-actions';

interface Profile {
  id: string;
  displayName: string;
  displayNameEn: string | null;
  role: string;
}

const ROLE_LABEL: Record<string, string> = {
  system_admin: 'Admin',
  general_manager: 'General Manager',
  project_manager: 'Project Manager',
  account_manager: 'Account Manager',
  hr: 'HR',
  finance: 'Finance',
  user: 'User',
};

export function ViewAsBar({
  profiles,
  realProfileId,
  currentProfileId,
  isImpersonating,
  currentDisplayName,
}: {
  profiles: Profile[];
  realProfileId: string;
  currentProfileId: string;
  isImpersonating: boolean;
  currentDisplayName: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function pick(profileId: string) {
    setOpen(false);
    startTransition(async () => {
      if (profileId === realProfileId) await clearViewAs();
      else await setViewAs(profileId);
    });
  }

  function exit() {
    setOpen(false);
    startTransition(async () => {
      await clearViewAs();
    });
  }

  return (
    <div
      className={
        'fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 px-3 py-1 text-[11px] backdrop-blur-md ' +
        (isImpersonating
          ? 'bg-[var(--accent)] text-black'
          : 'bg-[var(--surface)] text-[var(--text-muted)] border-b border-[var(--line)]')
      }
      style={{ height: 26 }}
    >
      {isImpersonating ? (
        <>
          <Eye size={11} />
          <span className="font-semibold">
            تشاهد كـ {currentDisplayName}
          </span>
          <button
            onClick={exit}
            disabled={pending}
            className="ms-2 inline-flex items-center gap-1 rounded-md bg-black/15 px-2 py-0.5 text-[10px] font-semibold text-black hover:bg-black/25 disabled:opacity-50"
          >
            {pending ? <Loader2 size={9} className="animate-spin" /> : <EyeOff size={9} />}
            رجوع لـ Mohammed
          </button>
        </>
      ) : (
        <span className="opacity-60">Admin · </span>
      )}

      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          disabled={pending}
          className={
            'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold disabled:opacity-50 ' +
            (isImpersonating
              ? 'bg-black/15 text-black hover:bg-black/25'
              : 'bg-[var(--surface-2)] text-[var(--text)] hover:bg-white/10')
          }
        >
          {pending ? <Loader2 size={9} className="animate-spin" /> : <Eye size={9} />}
          View as…
          <ChevronDown size={9} />
        </button>
        {open && (
          <div
            className="absolute end-0 mt-1 max-h-[360px] w-[260px] overflow-y-auto rounded-md border border-[var(--line-strong)] bg-[var(--surface)] p-1 text-[var(--text)] shadow-2xl"
            style={{ boxShadow: '0 20px 50px -10px rgba(0,0,0,0.6)' }}
          >
            {profiles.map((p) => {
              const active = p.id === currentProfileId;
              const isReal = p.id === realProfileId;
              return (
                <button
                  key={p.id}
                  onClick={() => pick(p.id)}
                  className={
                    'flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-start text-[11px] ' +
                    (active
                      ? 'bg-[var(--accent-tint)] text-[var(--text)]'
                      : 'hover:bg-white/5 text-[var(--text-muted)]')
                  }
                >
                  <span className="flex flex-col">
                    <span className="text-[12px] text-[var(--text)]">
                      {p.displayName}
                      {isReal && (
                        <span className="ms-1 text-[9px] text-[var(--text-dim)]">
                          (you)
                        </span>
                      )}
                    </span>
                    {p.displayNameEn && (
                      <span className="text-[9px] text-[var(--text-dim)]">
                        {p.displayNameEn}
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-[9px] uppercase text-[var(--text-dim)]">
                    {ROLE_LABEL[p.role] ?? p.role}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
