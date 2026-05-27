'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  NODES,
  LINKS,
  CAT_COLOR,
  CAT_LABEL,
  type NodeCat,
  type GNode,
} from './graph-data';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
const idOf = (e: unknown): string =>
  typeof e === 'object' && e !== null ? (e as { id: string }).id : (e as string);

export function SystemMap() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<unknown>(null);
  const [dim, setDim] = useState({ w: 800, h: 600 });
  const [hover, setHover] = useState<string | null>(null);

  // Clone so the force sim can mutate freely.
  const data = useMemo(
    () => ({
      nodes: NODES.map((n) => ({ ...n })),
      links: LINKS.map((l) => ({ ...l })),
    }),
    [],
  );

  // Neighbours of the hovered node (by original string ids).
  const { hlNodes, hlLinks } = useMemo(() => {
    const nodes = new Set<string>();
    const links = new Set<string>();
    if (hover) {
      nodes.add(hover);
      for (const l of LINKS) {
        if (l.source === hover || l.target === hover) {
          nodes.add(l.source);
          nodes.add(l.target);
          links.add(`${l.source}>${l.target}`);
        }
      }
    }
    return { hlNodes: nodes, hlLinks: links };
  }, [hover]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setDim({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const active = hlNodes.size > 0;

  return (
    <div
      ref={wrapRef}
      className="relative h-[72vh] w-full overflow-hidden rounded-xl border border-white/[0.08] bg-[#0B0B0E]"
    >
      <ForceGraph2D
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        ref={fgRef as any}
        width={dim.w}
        height={dim.h}
        graphData={data}
        backgroundColor="#0B0B0E"
        nodeRelSize={1}
        cooldownTicks={120}
        onEngineStop={() => {
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          (fgRef.current as any)?.zoomToFit?.(400, 60);
        }}
        onNodeHover={(n: unknown) => setHover(n ? (n as GNode).id : null)}
        onNodeClick={(n: unknown) => {
          const node = n as GNode & { x?: number; y?: number };
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          const fg = fgRef.current as any;
          if (node.x != null && node.y != null) {
            fg?.centerAt?.(node.x, node.y, 600);
            fg?.zoom?.(2.4, 600);
          }
        }}
        linkColor={(l: unknown) => {
          const link = l as { source: unknown; target: unknown; kind: string };
          const key = `${idOf(link.source)}>${idOf(link.target)}`;
          if (active) {
            return hlLinks.has(key)
              ? link.kind === 'ai'
                ? hexA('#FF6B1A', 0.9)
                : link.kind === 'automation'
                  ? hexA('#34d399', 0.85)
                  : hexA('#ffffff', 0.6)
              : 'rgba(255,255,255,0.03)';
          }
          return link.kind === 'ai'
            ? hexA('#FF6B1A', 0.28)
            : link.kind === 'automation'
              ? hexA('#34d399', 0.22)
              : 'rgba(255,255,255,0.10)';
        }}
        linkWidth={(l: unknown) => {
          const link = l as { source: unknown; target: unknown };
          return active && hlLinks.has(`${idOf(link.source)}>${idOf(link.target)}`) ? 2 : 0.6;
        }}
        linkDirectionalParticles={(l: unknown) => {
          const link = l as { source: unknown; target: unknown; kind: string };
          const key = `${idOf(link.source)}>${idOf(link.target)}`;
          if (active) return hlLinks.has(key) ? 3 : 0;
          return link.kind === 'ai' ? 2 : 0;
        }}
        linkDirectionalParticleWidth={2}
        linkDirectionalParticleColor={(l: unknown) =>
          (l as { kind: string }).kind === 'automation' ? '#34d399' : '#FF6B1A'
        }
        nodeCanvasObject={(n: unknown, ctx: CanvasRenderingContext2D, scale: number) => {
          const node = n as GNode & { x: number; y: number };
          // First tick: the force sim hasn't assigned positions yet — skip to
          // avoid a non-finite value crashing createRadialGradient.
          if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
          const color = CAT_COLOR[node.cat];
          const r = Math.sqrt(node.val) * 1.5;
          const faded = active && !hlNodes.has(node.id);

          // glow
          const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r * 2.6);
          glow.addColorStop(0, hexA(color, faded ? 0.06 : 0.5));
          glow.addColorStop(1, hexA(color, 0));
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r * 2.6, 0, 2 * Math.PI);
          ctx.fill();

          // core
          ctx.fillStyle = faded ? hexA(color, 0.3) : color;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
          ctx.fill();

          // label (hide tiny nodes when zoomed far out)
          if (scale > 0.55 || node.val >= 12 || hlNodes.has(node.id)) {
            const fontSize = Math.max(3, 10 / scale);
            ctx.font = `${fontSize}px Vazirmatn, system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = faded ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.92)';
            ctx.fillText(node.label, node.x, node.y + r + 2);
          }
        }}
      />

      {/* Legend */}
      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-1.5 rounded-lg border border-white/[0.08] bg-black/50 p-2.5 backdrop-blur">
        {(Object.keys(CAT_COLOR) as NodeCat[]).map((c) => (
          <span key={c} className="flex items-center gap-2 text-[11px] text-white/70">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: CAT_COLOR[c], boxShadow: `0 0 6px ${CAT_COLOR[c]}` }}
            />
            {CAT_LABEL[c]}
          </span>
        ))}
      </div>

      {/* Hint */}
      <div className="pointer-events-none absolute right-3 top-3 rounded-lg border border-white/[0.08] bg-black/50 px-3 py-1.5 text-[11px] text-white/55 backdrop-blur">
        مرّر فوق أي قسم لإبراز روابطه · اضغط للتكبير · اسحب للتحريك
      </div>
    </div>
  );
}
