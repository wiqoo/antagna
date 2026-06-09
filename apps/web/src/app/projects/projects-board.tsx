import Link from 'next/link';
import { Avatar, StatusPill } from '@antagna/ui';
import { PROJECT_STAGE_ORDER, stageLabel, stageTone } from '@/lib/project-stage';
import { riskLabel } from '@/lib/risk-level';

export type BoardRow = {
  id: string;
  code: string;
  title: string;
  titleAr: string | null;
  stage: string;
  deliveryDueAt: Date | string | null;
  contractedValueSar: string | number | null;
  aiRiskLevel: string | null;
  pmName: string | null;
  clientNameAr: string | null;
  clientCode: string | null;
  isAbuLukaContent?: boolean;
};

const riskDot: Record<string, string> = {
  red: 'bg-[var(--danger)]',
  amber: 'bg-[var(--warning)]',
  green: 'bg-[var(--success)]',
};

/** Read-only kanban: one column per pipeline stage, project cards inside. */
export function ProjectsBoard({ rows, locale }: { rows: BoardRow[]; locale: string }) {
  const byStage = new Map<string, BoardRow[]>();
  for (const s of PROJECT_STAGE_ORDER) byStage.set(s, []);
  for (const r of rows) {
    if (!byStage.has(r.stage)) byStage.set(r.stage, []);
    byStage.get(r.stage)!.push(r);
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-3">
      {PROJECT_STAGE_ORDER.map((stage) => {
        const items = byStage.get(stage) ?? [];
        return (
          <div key={stage} className="flex w-[268px] shrink-0 flex-col gap-2">
            <div className="flex items-center justify-between px-0.5">
              <StatusPill tone={stageTone(stage)} withDot={false}>
                {stageLabel(stage, locale)}
              </StatusPill>
              <span className="font-mono text-[11px] text-[var(--text-dim)]">
                {items.length}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {items.map((r) => (
                <Link
                  key={r.id}
                  href={`/projects/${r.id}`}
                  className="group rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 transition-colors hover:border-[var(--accent)]/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-[13px] font-medium leading-snug text-[var(--text)] group-hover:text-[var(--accent)]">
                      {r.titleAr ?? r.title}
                    </p>
                    {r.aiRiskLevel && (
                      <span
                        title={riskLabel(r.aiRiskLevel, locale)}
                        className={
                          'mt-1 h-2 w-2 shrink-0 rounded-full ' +
                          (riskDot[r.aiRiskLevel] ?? 'bg-[var(--text-dim)]')
                        }
                      />
                    )}
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                    {r.clientNameAr ? (
                      <>
                        {r.clientCode && (
                          <span className="font-mono text-[10px] text-[var(--text-dim)]">
                            {r.clientCode}
                          </span>
                        )}
                        <span className="truncate">{r.clientNameAr}</span>
                      </>
                    ) : r.isAbuLukaContent ? (
                      <span className="rounded bg-[var(--accent)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--accent)]">
                        محتوى أبو لوكا
                      </span>
                    ) : null}
                  </p>
                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    {r.pmName ? (
                      <span className="flex items-center gap-1.5">
                        <Avatar name={r.pmName} size="sm" />
                        <span className="truncate text-[11px] text-[var(--text-muted)]">
                          {r.pmName}
                        </span>
                      </span>
                    ) : (
                      <span className="text-[11px] text-[var(--text-dim)]">
                        دون مدير
                      </span>
                    )}
                    {r.deliveryDueAt && (
                      <span className="shrink-0 font-mono text-[10px] text-[var(--text-dim)]">
                        {new Date(r.deliveryDueAt).toISOString().slice(5, 10)}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
              {items.length === 0 && (
                <div className="rounded-lg border border-dashed border-[var(--line)] py-4 text-center text-[11px] text-[var(--text-dim)]">
                  —
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
