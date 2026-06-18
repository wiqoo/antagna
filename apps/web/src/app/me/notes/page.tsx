import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { requireOwner } from '../auth';
import { addNote, deleteNote } from '../actions2';
import { dateAr } from '../data';

export const dynamic = 'force-dynamic';

const field = 'w-full rounded-lg border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)]';

interface Note { id: string; title: string | null; body: string; createdAt: string }

export default async function NotesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const me = await requireOwner();
  const { q } = await searchParams;
  const term = (q ?? '').trim();

  const notes = (await db.execute(sql`
    SELECT id::text, title, body, created_at AS "createdAt"
    FROM me_notes WHERE owner_id = ${me.profileId}::uuid
    ${term ? sql`AND (coalesce(title,'') ILIKE ${'%' + term + '%'} OR body ILIKE ${'%' + term + '%'})` : sql``}
    ORDER BY updated_at DESC LIMIT 100
  `)) as unknown as Note[];

  return (
    <div>
      <h1 className="mb-3 text-[22px] font-bold">الملاحظات</h1>

      <form method="get" className="mb-3">
        <input name="q" defaultValue={term} placeholder="🔍 ابحث…" className={field} />
      </form>

      <details className="mb-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5" open={!term && notes.length === 0}>
        <summary className="cursor-pointer text-[13px] font-medium text-[var(--accent)]">+ ملاحظة</summary>
        <form action={addNote} className="mt-3 flex flex-col gap-2.5">
          <input name="title" placeholder="عنوان (اختياري)" className={field} />
          <textarea name="body" required rows={4} placeholder="اكتب فكرتك / مرجعك…" className={field} />
          <button className="rounded-lg bg-[var(--accent)] py-2 text-[14px] font-medium text-[#1a1a1a]">حفظ</button>
        </form>
      </details>

      {notes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] py-12 text-center text-[13px] text-[var(--text-dim)]">{term ? 'لا نتائج.' : 'لا ملاحظات بعد.'}</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {notes.map((n) => (
            <div key={n.id} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {n.title && <p className="text-[14px] font-medium">{n.title}</p>}
                  <p className="whitespace-pre-wrap text-[13px] text-[var(--text-muted)]">{n.body}</p>
                  <p className="mt-1.5 text-[10px] text-[var(--text-dim)]">{dateAr(n.createdAt)}</p>
                </div>
                <form action={deleteNote.bind(null, n.id)}><button className="text-[var(--text-dim)] hover:text-[var(--danger)]">×</button></form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
