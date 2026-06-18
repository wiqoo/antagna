import { sql } from 'drizzle-orm';
import { db } from '@antagna/db';
import { requireOwner } from '../auth';
import { getProfile } from '../brain';
import { clearAssistant } from '../actions3';
import { Chat } from './Chat';

export const dynamic = 'force-dynamic';

interface Msg { id: string; role: string; content: string; actions: Array<{ tool: string; summary: string; ok: boolean }> }

const ACTION_ICON: Record<string, string> = {
  create_task: '✓', log_expense: '💸', log_income: '💵', add_event: '📅',
  set_waiting: '⏳', add_note: '📝', set_money: '⚙️', recall: '🧠',
};

export default async function AssistantPage() {
  const me = await requireOwner();
  const [msgs, profile] = await Promise.all([
    db.execute(sql`
      SELECT id::text, role, content, actions FROM me_messages
      WHERE owner_id = ${me.profileId}::uuid ORDER BY created_at DESC LIMIT 40
    `) as unknown as Promise<Msg[]>,
    getProfile(me.profileId),
  ]);
  const thread = (msgs as Msg[]).reverse();

  const suggestions = thread.length === 0
    ? ['اعملي خطة النهارده', 'إيه أهم حاجة عليّ دلوقتي؟', 'سجّل مصروف ٢٠٠ أكل', 'فكّرني أكلّم العميل بكرة']
    : ['اعملي خطة النهارده', 'مين مستني مني حاجة؟', 'إيه وضع فلوسي؟'];

  return (
    <div className="pb-32">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold">مساعدك</h1>
          <p className="text-[11px] text-[var(--text-dim)]">
            {profile.learnedAt ? 'بيتعلمك · فاهم سياقك' : 'الـChief-of-Staff الشخصي'}
          </p>
        </div>
        {thread.length > 0 && (
          <form action={clearAssistant}>
            <button className="rounded-lg border border-[var(--line)] px-2.5 py-1 text-[11px] text-[var(--text-dim)]">مسح</button>
          </form>
        )}
      </div>

      {thread.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 text-center">
          <div className="mb-2 text-[30px]">🧠</div>
          <p className="text-[14px] font-semibold">أنا مساعدك الشخصي</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-muted)]">
            بنفّذ حاجات (مهام، فلوس، مواعيد) وبحلّل وضعك كخبير — مش بس بردّ كلام.
            كل ما نتكلم بفهمك أكتر. ابدأ من تحت 👇
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {thread.map((m) => (
            <div key={m.id} className={m.role === 'user' ? 'self-end max-w-[85%]' : 'self-start max-w-[88%]'}>
              <div
                className="whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed"
                style={m.role === 'user'
                  ? { background: 'var(--accent)', color: '#1a1a1a', borderBottomRightRadius: 4 }
                  : { background: 'var(--surface)', border: '1px solid var(--line)', borderBottomLeftRadius: 4 }}
              >
                {m.content}
              </div>
              {Array.isArray(m.actions) && m.actions.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {m.actions.map((a, i) => (
                    <span key={i} className="rounded-full border px-2 py-0.5 text-[10.5px]"
                      style={{ borderColor: a.ok ? 'var(--accent-ring)' : 'var(--danger)', color: a.ok ? 'var(--accent)' : 'var(--danger)', background: a.ok ? 'var(--accent-tint)' : 'var(--danger-tint)' }}>
                      {ACTION_ICON[a.tool] ?? '•'} {a.summary}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Chat suggestions={suggestions} />
    </div>
  );
}
