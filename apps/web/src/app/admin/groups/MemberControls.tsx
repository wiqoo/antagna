'use client';

import { Star, UserMinus } from 'lucide-react';
import { toggleMemberCore, removeSquadMember } from './actions';

export function MemberControls({
  squadId,
  profileId,
  isCore,
}: {
  squadId: string;
  profileId: string;
  isCore: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      <button
        type="button"
        title={isCore ? 'عضو أساسي — اضغط لجعله مساعداً' : 'مساعد — اضغط لجعله أساسياً'}
        onClick={() => toggleMemberCore(squadId, profileId)}
        className={
          isCore
            ? 'grid h-7 w-7 place-items-center rounded-md border border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)]'
            : 'grid h-7 w-7 place-items-center rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--text-dim)] hover:text-[var(--accent)]'
        }
      >
        <Star size={12} fill={isCore ? 'currentColor' : 'none'} />
      </button>
      <button
        type="button"
        title="إزالة من المجموعة"
        onClick={() => {
          if (confirm('إزالة هذا العضو من المجموعة؟')) {
            void removeSquadMember(squadId, profileId);
          }
        }}
        className="grid h-7 w-7 place-items-center rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--text-dim)] hover:border-red-500/50 hover:text-red-400"
      >
        <UserMinus size={12} />
      </button>
    </div>
  );
}
