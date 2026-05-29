'use client';

import { useTransition } from 'react';
import { CheckSquare, Square } from 'lucide-react';
import { toggleMeetingActionItem } from '../actions';

export interface ActionItem {
  text: string;
  done?: boolean;
}

export function ActionItems({
  meetingId,
  items,
  canEdit,
}: {
  meetingId: string;
  items: ActionItem[];
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();

  if (items.length === 0) {
    return (
      <p className="text-[12px] text-[var(--text-dim)]">لا مهام متفق عليها في هذا المحضر.</p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={i}>
          <button
            type="button"
            disabled={!canEdit || pending}
            onClick={() =>
              startTransition(() => {
                void toggleMeetingActionItem(meetingId, i);
              })
            }
            className={
              'flex w-full items-start gap-2.5 rounded-md border p-2.5 text-start text-[13px] leading-relaxed transition-colors ' +
              (it.done
                ? 'border-[var(--line)] bg-[var(--surface)]/40 text-[var(--text-dim)] line-through'
                : 'border-[var(--accent)]/15 bg-[var(--accent)]/[0.04] text-[var(--text)]') +
              (canEdit ? ' hover:border-[var(--accent)]/40' : ' cursor-default')
            }
          >
            <span className="mt-0.5 shrink-0">
              {it.done ? (
                <CheckSquare size={15} className="text-[var(--success)]" />
              ) : (
                <Square size={15} className="text-[var(--text-dim)]" />
              )}
            </span>
            <span>{it.text}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
