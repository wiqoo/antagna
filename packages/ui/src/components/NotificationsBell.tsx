import { Bell } from 'lucide-react';

export type NotificationItem = {
  id: string | number;
  title: string;
  body: string | null;
  linkUrl: string | null;
  read: boolean;
  createdAt: Date | string;
  entityType: string | null;
};

function timeAgo(d: Date | string) {
  const t = new Date(d).getTime();
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `${mins}د`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}س`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}ي`;
  return new Date(d).toISOString().slice(0, 10);
}

export function NotificationsBell({
  items,
  markAllReadAction,
  markOneReadAction,
}: {
  items: NotificationItem[];
  markAllReadAction: () => Promise<void> | void;
  markOneReadAction: (id: string) => Promise<void> | void;
}) {
  const unreadCount = items.filter((i) => !i.read).length;

  return (
    <details className="relative">
      <summary className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-xl border border-[--line] bg-[--surface] text-[--text-muted] hover:border-[--line-strong] hover:text-[--text] [&::-webkit-details-marker]:hidden">
        <Bell size={14} />
        {unreadCount > 0 && (
          <span className="absolute -end-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[--accent] px-1 text-[10px] font-bold text-black">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </summary>
      <div className="absolute end-0 top-12 z-50 w-[360px] overflow-hidden rounded-2xl border border-[--line] bg-[--bg-elevated]/95 backdrop-blur-2xl shadow-[0_24px_48px_-16px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between border-b border-[--line] px-4 py-3">
          <p className="text-sm font-semibold text-[--text]">الإشعارات</p>
          {unreadCount > 0 && (
            <form action={markAllReadAction}>
              <button
                type="submit"
                className="text-xs text-[--accent] hover:underline"
              >
                علّم الكل مقروء
              </button>
            </form>
          )}
        </div>
        {items.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-[--text-muted]">
            لا توجد إشعارات.
          </div>
        ) : (
          <ul className="max-h-[420px] overflow-y-auto divide-y divide-[--line]">
            {items.map((n) => (
              <li
                key={n.id}
                className={
                  'group relative px-4 py-3 ' +
                  (n.read ? 'opacity-70' : 'bg-[--surface]/40')
                }
              >
                <div className="flex items-start gap-3">
                  {!n.read && (
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[--accent]" />
                  )}
                  <div className="min-w-0 flex-1">
                    {n.linkUrl ? (
                      <a
                        href={n.linkUrl}
                        className="block hover:text-[--accent]"
                      >
                        <p className="text-sm font-medium text-[--text]">
                          {n.title}
                        </p>
                      </a>
                    ) : (
                      <p className="text-sm font-medium text-[--text]">
                        {n.title}
                      </p>
                    )}
                    {n.body && (
                      <p className="mt-0.5 text-xs text-[--text-muted]">
                        {n.body}
                      </p>
                    )}
                    <p className="mt-1 text-[10px] text-[--text-dim]">
                      {timeAgo(n.createdAt)}
                    </p>
                  </div>
                  {!n.read && (
                    <form action={markOneReadAction.bind(null, String(n.id))}>
                      <button
                        type="submit"
                        title="علّم مقروء"
                        className="grid h-6 w-6 place-items-center rounded-md text-[--text-dim] opacity-0 hover:bg-[--surface-hover] hover:text-[--text] group-hover:opacity-100"
                      >
                        ✓
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
