import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { requireOwner } from '../auth';
import { triageInboxItem, convertInboxToTask, archiveInboxItem } from '../actions';

export const dynamic = 'force-dynamic';

interface Item {
  id: string; content: string; source: string;
  aiSuggestion: { title?: string; type?: string; projectId?: string | null } | null;
  createdAt: string;
}

const SOURCE_ICON: Record<string, string> = { text: '✍️', voice: '🎤', share: '🔗', whatsapp: '💬' };

export default async function InboxPage() {
  const me = await requireOwner();

  const items = (await db.execute(sql`
    SELECT id::text, content, source, ai_suggestion AS "aiSuggestion", created_at AS "createdAt"
    FROM me_inbox WHERE owner_id = ${me.profileId}::uuid AND processed = false
    ORDER BY created_at DESC
  `)) as unknown as Item[];

  const projects = (await db.execute(sql`
    SELECT id::text, title FROM me_projects WHERE owner_id = ${me.profileId}::uuid AND status = 'active' ORDER BY title
  `)) as unknown as Array<{ id: string; title: string }>;
  const projName = new Map(projects.map((p) => [p.id, p.title]));

  return (
    <div>
      <h1 className="mb-1 text-[22px] font-bold">الوارد</h1>
      <p className="mb-4 text-[12px] text-[var(--text-dim)]">{items.length} للترتيب · حوّلها مهام أو أرشفها</p>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] py-14 text-center text-[13px] text-[var(--text-dim)]">
          الوارد فاضي 🎉<br />دماغك صافية.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((it) => {
            const sug = it.aiSuggestion;
            const title = sug?.title || it.content;
            const pid = sug?.projectId || '';
            return (
              <div key={it.id} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5">
                <div className="flex items-start gap-2">
                  <span className="text-[14px]">{SOURCE_ICON[it.source] ?? '✍️'}</span>
                  <p className="flex-1 text-[14px] leading-snug">{it.content}</p>
                </div>

                {sug && (
                  <div className="mt-2 rounded-lg bg-[var(--accent)]/10 px-2.5 py-1.5 text-[12px]">
                    <span className="text-[var(--accent)]">✨ اقتراح:</span> {sug.type === 'note' ? 'ملاحظة' : 'مهمة'} «{sug.title}»
                    {pid && projName.get(pid) && <span className="text-[var(--text-dim)]"> · 📁 {projName.get(pid)}</span>}
                  </div>
                )}

                <div className="mt-2.5 flex flex-wrap gap-2">
                  {!sug && (
                    <form action={triageInboxItem.bind(null, it.id)}>
                      <button className="rounded-lg border border-[var(--line-strong)] px-2.5 py-1.5 text-[12px] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--text)]">✨ اقترح</button>
                    </form>
                  )}
                  <form action={convertInboxToTask.bind(null, it.id)}>
                    <input type="hidden" name="title" value={title} />
                    <input type="hidden" name="project_id" value={pid} />
                    <button className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[12px] font-medium text-[#1a1a1a]">→ مهمة</button>
                  </form>
                  <form action={archiveInboxItem.bind(null, it.id)}>
                    <button className="rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-[12px] text-[var(--text-dim)] hover:text-[var(--text)]">أرشفة</button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
