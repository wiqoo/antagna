'use client';

import { NODE_W, NODE_H, DEPTS, type OrgNode } from './org-data';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '؟';
  if (parts.length === 1) return parts[0]!.slice(0, 2);
  return (parts[0]![0] ?? '') + (parts[1]![0] ?? '');
}

interface Props {
  node: OrgNode;
  x: number; // centre-x
  y: number; // top-y
  selected: boolean;
  dragging: boolean;
  dropTarget: boolean;
  onPointerDown: (e: React.PointerEvent, node: OrgNode) => void;
}

export function OrgNodeCard({ node, x, y, selected, dragging, dropTarget, onPointerDown }: Props) {
  const color = DEPTS[node.dept].color;
  const border = node.vacant
    ? `1.5px dashed ${color}`
    : `1px solid var(--line-strong)`;

  return (
    <div
      data-node-id={node.id}
      onPointerDown={(e) => onPointerDown(e, node)}
      className="absolute select-none rounded-2xl"
      style={{
        left: x - NODE_W / 2,
        top: y,
        width: NODE_W,
        height: NODE_H,
        touchAction: 'none',
        cursor: dragging ? 'grabbing' : 'grab',
        opacity: dragging ? 0.35 : 1,
        background: node.vacant ? 'rgba(255,255,255,0.02)' : 'var(--surface)',
        border,
        boxShadow: selected
          ? `0 0 0 2px var(--accent), 0 8px 24px rgba(0,0,0,0.45)`
          : dropTarget
            ? `0 0 0 2px ${color}, 0 0 0 6px ${color}33`
            : '0 4px 14px rgba(0,0,0,0.35)',
        transition: 'box-shadow .12s, opacity .12s, transform .12s',
        transform: dropTarget ? 'scale(1.03)' : 'scale(1)',
      }}
    >
      {/* dept accent rail */}
      <span
        className="absolute top-3 bottom-3 rounded-full"
        style={{ insetInlineStart: 0, width: 3, background: color, opacity: 0.9 }}
      />
      <div className="flex h-full items-center gap-3 px-3.5">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold"
          style={{
            background: node.vacant ? 'transparent' : `${color}22`,
            border: node.vacant ? `1.5px dashed ${color}` : `1px solid ${color}55`,
            color,
          }}
        >
          {node.vacant ? '+' : initials(node.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p
              className="truncate text-[14px] font-semibold leading-tight"
              style={{ color: node.vacant ? 'var(--text-muted)' : 'var(--text)' }}
            >
              {node.name}
            </p>
            {node.vacant && (
              <span
                className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
                style={{ background: `${color}1f`, color }}
              >
                شاغر
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[12px] leading-tight text-[var(--text-muted)]">
            {node.role}
          </p>
          <p className="mt-1 text-[10px] font-medium" style={{ color }}>
            {DEPTS[node.dept].label}
          </p>
        </div>
      </div>
    </div>
  );
}
