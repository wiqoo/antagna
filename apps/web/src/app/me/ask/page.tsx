import { requireOwner } from '../auth';
import { askMyBrain } from '../ai';

export const dynamic = 'force-dynamic';

const examples = ['إيه أهم ٣ حاجات عليّ النهارده؟', 'إيه اللي معطّل تسليماتي؟', 'مين مستني مني حاجة؟'];

export default async function AskPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const me = await requireOwner();
  const { q } = await searchParams;
  const question = (q ?? '').trim();
  const answer = question ? await askMyBrain(me.profileId, question) : null;

  return (
    <div>
      <h1 className="mb-1 text-[22px] font-bold">🧠 اسأل مخّك</h1>
      <p className="mb-4 text-[12px] text-[var(--text-dim)]">إجابات من مشاريعك ومهامك وملاحظاتك</p>

      <form method="get" className="mb-4 flex gap-2">
        <input name="q" defaultValue={question} required placeholder="اسأل أي حاجة…" className="flex-1 rounded-xl border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--accent)]" />
        <button className="rounded-xl bg-[var(--accent)] px-4 text-[14px] font-medium text-[#1a1a1a]">اسأل</button>
      </form>

      {answer ? (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <p className="mb-1 text-[12px] text-[var(--accent)]">{question}</p>
          <p className="whitespace-pre-wrap text-[14px] leading-relaxed">{answer}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-[12px] text-[var(--text-dim)]">جرّب:</p>
          {examples.map((e) => (
            <a key={e} href={`/me/ask?q=${encodeURIComponent(e)}`} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-[13px] text-[var(--text-muted)]">{e}</a>
          ))}
        </div>
      )}
    </div>
  );
}
