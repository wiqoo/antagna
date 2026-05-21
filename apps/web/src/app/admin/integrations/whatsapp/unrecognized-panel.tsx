'use client';

import { useState, useTransition } from 'react';
import { Card, StatusPill } from '@antagna/ui';
import { Phone, Loader2, Link2, CheckCircle2, AlertCircle } from 'lucide-react';
import { linkSenderToProfile } from './actions';

interface Unrecognized {
  fromE164: string;
  pushname: string | null;
  formattedName: string | null;
  lastMessage: string | null;
  lastAt: string;
  count: number;
}

interface ProfileOpt {
  id: string;
  displayName: string;
  role: string;
}

export function UnrecognizedPanel({
  senders,
  profiles,
}: {
  senders: Unrecognized[];
  profiles: ProfileOpt[];
}) {
  if (senders.length === 0) {
    return null;
  }
  return (
    <Card>
      <div className="flex items-start gap-2 mb-3">
        <AlertCircle size={16} className="mt-0.5 text-[var(--warning)]" />
        <div>
          <p className="text-[12px] font-semibold text-[var(--text)]">
            رسائل من مرسلين غير مُسَجَّلين
          </p>
          <p className="text-[11px] text-[var(--text-muted)]">
            الـ bot ميـردش على الـ senders دول لحد ما تربطهم بـ profiles. اختار
            اللي يخص كل واحد ↓
          </p>
        </div>
      </div>

      <ul className="space-y-2">
        {senders.map((s) => (
          <Row key={s.fromE164} sender={s} profiles={profiles} />
        ))}
      </ul>
    </Card>
  );
}

function Row({
  sender,
  profiles,
}: {
  sender: Unrecognized;
  profiles: ProfileOpt[];
}) {
  const [picked, setPicked] = useState('');
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function link() {
    if (!picked) return;
    startTransition(async () => {
      try {
        await linkSenderToProfile(sender.fromE164, picked);
        setDone(true);
      } catch (err) {
        console.error(err);
      }
    });
  }

  if (done) {
    return (
      <li className="rounded-md border border-[var(--success)]/30 bg-[var(--success)]/[0.05] p-2.5 text-[12px]">
        <CheckCircle2 size={13} className="inline text-[var(--success)] me-1" />
        اتربط ✓
      </li>
    );
  }

  return (
    <li className="rounded-md border border-[var(--line)] bg-[var(--surface)]/40 p-2.5">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[12px]">
            <Phone size={11} className="text-[var(--text-dim)]" />
            <span className="font-mono text-[var(--text)]">{sender.fromE164}</span>
            <StatusPill tone="warning">{sender.count}× رسالة</StatusPill>
          </div>
          {(sender.pushname || sender.formattedName) && (
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
              ↳ {sender.formattedName ?? sender.pushname}
            </p>
          )}
          {sender.lastMessage && (
            <p className="mt-1 line-clamp-1 text-[11px] text-[var(--text-muted)]">
              آخر رسالة: {sender.lastMessage}
            </p>
          )}
          <p className="text-[10px] text-[var(--text-dim)]">{sender.lastAt}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <select
          value={picked}
          onChange={(e) => setPicked(e.target.value)}
          className="h-8 flex-1 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-[12px] text-[var(--text)]"
        >
          <option value="">اربط بـ profile…</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.displayName} ({p.role})
            </option>
          ))}
        </select>
        <button
          onClick={link}
          disabled={!picked || pending}
          className="inline-flex h-8 items-center gap-1 rounded-md px-3 text-[11px] font-semibold text-white disabled:opacity-50"
          style={{ background: 'var(--accent-gradient)' }}
        >
          {pending ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <Link2 size={11} />
          )}
          اربط
        </button>
      </div>
    </li>
  );
}
