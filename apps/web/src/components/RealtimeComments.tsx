'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Avatar } from '@antagna/ui';
import { Send, Loader2 } from 'lucide-react';

export type Comment = {
  id: string;
  body: string;
  createdAt: string;
  authorName: string | null;
  authorId: string | null;
};

export function RealtimeComments({
  projectId,
  initialComments,
  currentProfileId,
  postAction,
}: {
  projectId: string;
  initialComments: Comment[];
  currentProfileId: string | null;
  postAction: (formData: FormData) => Promise<void> | void;
}) {
  const [comments, setComments] = useState(initialComments);
  const [text, setText] = useState('');
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  // Realtime subscription
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) return;
    const supabase = createBrowserClient(url, anon);

    const channel = supabase
      .channel(`project-${projectId}-comments`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'project_comments',
          filter: `project_id=eq.${projectId}`,
        },
        async (payload) => {
          const row = payload.new as {
            id: string;
            body: string;
            created_at: string;
            author_id: string | null;
          };
          // Fetch author display name (lightweight)
          let authorName: string | null = null;
          if (row.author_id) {
            const { data } = await supabase
              .from('profiles')
              .select('display_name')
              .eq('id', row.author_id)
              .single();
            authorName = (data?.display_name as string | undefined) ?? null;
          }
          setComments((prev) => {
            if (prev.find((c) => c.id === row.id)) return prev;
            return [
              {
                id: row.id,
                body: row.body,
                createdAt: row.created_at,
                authorName,
                authorId: row.author_id,
              },
              ...prev,
            ];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!text.trim()) return;
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await postAction(fd);
      setText('');
      formRef.current?.reset();
    });
  }

  return (
    <>
      <div className="px-6 pb-4">
        <form ref={formRef} onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            name="body"
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
            placeholder="اكتب تعليق…"
            disabled={isPending}
            className="h-10 flex-1 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3 text-sm focus:border-[var(--accent)] focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isPending || !text.trim()}
            className="magnet inline-flex h-10 items-center gap-1.5 rounded-md bg-[var(--accent)] px-4 text-[13px] font-semibold text-black hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Send size={13} />
            )}
            إرسال
          </button>
        </form>
      </div>

      {comments.length === 0 ? (
        <p className="px-6 pb-6 text-center text-[12px] text-[var(--text-dim)]">
          ابدأ المحادثة — التعليقات الجديدة من زملائك هتظهر هنا تلقائياً.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
          {comments.slice(0, 30).map((c) => {
            const isMine = c.authorId && c.authorId === currentProfileId;
            return (
              <li
                key={c.id}
                className={
                  'flex items-start gap-3 px-6 py-3 ' +
                  (isMine ? 'bg-[var(--accent)]/[0.03]' : '')
                }
              >
                <Avatar name={c.authorName ?? '?'} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium text-[var(--text)]">
                      {c.authorName ?? '?'}
                    </span>
                    <span className="font-mono text-[10px] text-[var(--text-dim)]">
                      {formatRelative(c.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--text)]">{c.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  const mins = Math.floor((Date.now() - t) / 60_000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `${mins}د`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}س`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}ي`;
  return new Date(iso).toISOString().slice(0, 10);
}
