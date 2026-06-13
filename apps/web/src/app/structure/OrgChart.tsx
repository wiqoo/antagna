'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import {
  SEED,
  DEPT_KEYS,
  childrenOf,
  descendantIds,
  wouldCycle,
  newId,
  type Dept,
  type OrgNode,
} from './org-data';
import { computeLayout } from './tree-layout';
import { OrgNodeCard } from './OrgNodeCard';
import { Toolbar } from './Toolbar';
import { Legend } from './Legend';
import { EditPanel } from './EditPanel';
import { SuggestionsPopover } from './SuggestionsPopover';

const STORAGE_KEY = 'volt-org-chart-v1';
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

interface View {
  x: number;
  y: number;
  scale: number;
}
interface DragState {
  nodeId: string;
  pointerX: number;
  pointerY: number;
  dropTargetId: string | null;
}

export function OrgChart() {
  const [nodes, setNodes] = useState<OrgNode[]>(SEED);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 });
  const [drag, setDrag] = useState<DragState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [suggestOpen, setSuggestOpen] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ startX: number; startY: number; vx: number; vy: number } | null>(null);
  const dragRef = useRef<{ nodeId: string; startX: number; startY: number; started: boolean } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didInitialFit = useRef(false);

  // ── layout ────────────────────────────────────────────────────────────────
  const layout = useMemo(() => {
    try {
      return computeLayout(nodes);
    } catch {
      return null;
    }
  }, [nodes]);

  const selected = selectedId ? nodes.find((n) => n.id === selectedId) ?? null : null;
  const rootId = nodes.find((n) => n.parentId === null)?.id ?? null;

  // ── fit to screen ───────────────────────────────────────────────────────────
  const fit = useCallback(() => {
    if (!layout || !canvasRef.current) return;
    const cw = canvasRef.current.clientWidth;
    const ch = canvasRef.current.clientHeight;
    const pad = 80;
    const { bounds } = layout;
    const sx = (cw - pad * 2) / Math.max(bounds.width, 1);
    const sy = (ch - pad * 2) / Math.max(bounds.height, 1);
    const scale = clamp(Math.min(sx, sy, 1), 0.2, 1);
    const x = cw / 2 - (bounds.minX + bounds.width / 2) * scale;
    // Centre vertically, but keep the top clear of the toolbar.
    const y = Math.max(64, (ch - bounds.height * scale) / 2) - bounds.minY * scale;
    setView({ x, y, scale });
  }, [layout]);

  // Fit as soon as the layout + canvas are measurable — independent of the
  // network load, so the seed renders centred even if the API is slow/offline.
  // The loader resets didInitialFit when real data arrives so it refits to it.
  useEffect(() => {
    if (layout && !didInitialFit.current && canvasRef.current?.clientWidth) {
      didInitialFit.current = true;
      fit();
    }
  }, [layout, fit]);

  // ── persistence: load ───────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/org-chart', {
          cache: 'no-store',
          signal: AbortSignal.timeout(6000),
        });
        const data = await res.json();
        if (!cancelled && data?.ok && Array.isArray(data.nodes) && data.nodes.length) {
          setNodes(normalize(data.nodes));
          didInitialFit.current = false; // refit to the freshly loaded tree
          setLoaded(true);
          return;
        }
      } catch {
        /* fall through to localStorage */
      }
      if (cancelled) return;
      try {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length) setNodes(normalize(parsed));
        }
      } catch {
        /* seed stands */
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── persistence: save (debounced) ────────────────────────────────────────────
  const persist = useCallback((next: OrgNode[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota */
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState('saving');
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/org-chart', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ nodes: next }),
        });
        const data = await res.json();
        setSaveState(data?.ok ? 'saved' : 'error');
      } catch {
        setSaveState('error');
      }
    }, 700);
  }, []);

  /** Single funnel for every mutation: set state + autosave. */
  const commit = useCallback(
    (updater: (prev: OrgNode[]) => OrgNode[]) => {
      setNodes((prev) => {
        const next = updater(prev);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  // ── mutations ────────────────────────────────────────────────────────────────
  const updateNode = useCallback(
    (id: string, patch: Partial<OrgNode>) =>
      commit((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n))),
    [commit],
  );

  const addChild = useCallback(
    (parentId: string, init?: Partial<OrgNode>) => {
      const id = newId();
      const parent = nodes.find((n) => n.id === parentId);
      commit((prev) => [
        ...prev,
        {
          id,
          parentId,
          name: init?.name ?? 'موظف جديد',
          role: init?.role ?? '',
          dept: init?.dept ?? parent?.dept ?? 'production',
          vacant: init?.vacant ?? false,
        },
      ]);
      setSelectedId(id);
    },
    [commit, nodes],
  );

  const deleteNode = useCallback(
    (id: string) => {
      const target = nodes.find((n) => n.id === id);
      if (!target || target.parentId === null) return; // never delete the root
      commit((prev) =>
        prev
          .filter((n) => n.id !== id)
          // re-attach orphans to the deleted node's parent — never lose people
          .map((n) => (n.parentId === id ? { ...n, parentId: target.parentId } : n)),
      );
      setSelectedId(null);
    },
    [commit, nodes],
  );

  const reparent = useCallback(
    (nodeId: string, newParentId: string) => {
      if (wouldCycle(nodes, nodeId, newParentId)) return;
      const cur = nodes.find((n) => n.id === nodeId);
      if (!cur || cur.parentId === newParentId) return;
      commit((prev) => prev.map((n) => (n.id === nodeId ? { ...n, parentId: newParentId } : n)));
    },
    [commit, nodes],
  );

  const importNodes = useCallback(
    (incoming: OrgNode[]) => {
      const norm = normalize(incoming);
      if (!norm.length || norm.filter((n) => n.parentId === null).length !== 1) return false;
      commit(() => norm);
      setSelectedId(null);
      didInitialFit.current = false;
      return true;
    },
    [commit],
  );

  // ── canvas pan ────────────────────────────────────────────────────────────────
  const onCanvasPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    setSelectedId(null);
    setSuggestOpen(false);
    panRef.current = { startX: e.clientX, startY: e.clientY, vx: view.x, vy: view.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onCanvasPointerMove = (e: React.PointerEvent) => {
    const p = panRef.current;
    if (!p) return;
    setView((v) => ({ ...v, x: p.vx + (e.clientX - p.startX), y: p.vy + (e.clientY - p.startY) }));
  };
  const onCanvasPointerUp = (e: React.PointerEvent) => {
    panRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  };

  // ── wheel zoom around cursor (non-passive) ───────────────────────────────────
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      setView((v) => {
        const factor = Math.exp(-e.deltaY * 0.0015);
        const scale = clamp(v.scale * factor, 0.2, 2);
        const wx = (px - v.x) / v.scale;
        const wy = (py - v.y) / v.scale;
        return { scale, x: px - wx * scale, y: py - wy * scale };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // ── node drag → reparent ──────────────────────────────────────────────────────
  const onNodePointerDown = useCallback(
    (e: React.PointerEvent, node: OrgNode) => {
      if (e.button !== 0) return;
      e.stopPropagation(); // don't start a canvas pan
      dragRef.current = { nodeId: node.id, startX: e.clientX, startY: e.clientY, started: false };

      const onMove = (ev: PointerEvent) => {
        const d = dragRef.current;
        if (!d) return;
        const dist = Math.hypot(ev.clientX - d.startX, ev.clientY - d.startY);
        if (!d.started && dist < 6) return; // click, not drag
        d.started = true;

        // hit-test the card under the pointer
        const hit = document
          .elementFromPoint(ev.clientX, ev.clientY)
          ?.closest('[data-node-id]') as HTMLElement | null;
        const overId = hit?.getAttribute('data-node-id') ?? null;
        const forbidden =
          !overId ||
          overId === d.nodeId ||
          descendantIds(nodes, d.nodeId).has(overId) ||
          nodes.find((n) => n.id === d.nodeId)?.parentId === overId;
        setDrag({
          nodeId: d.nodeId,
          pointerX: ev.clientX,
          pointerY: ev.clientY,
          dropTargetId: forbidden ? null : overId,
        });
      };

      const onUp = () => {
        const d = dragRef.current;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        dragRef.current = null;
        setDrag((cur) => {
          if (d && !d.started) {
            // a click: select + open edit
            setSelectedId(d.nodeId);
          } else if (cur?.dropTargetId) {
            reparent(cur.nodeId, cur.dropTargetId);
          }
          return null;
        });
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [nodes, reparent],
  );

  // Escape closes things
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedId(null);
        setSuggestOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── export PNG (fit first, then snapshot the world only) ──────────────────────
  const exportPng = useCallback(async () => {
    fit();
    await new Promise((r) => setTimeout(r, 420));
    const el = canvasRef.current;
    if (!el) return;
    try {
      const dataUrl = await toPng(el, { pixelRatio: 2, backgroundColor: '#0F0F12', cacheBust: true });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'volt-org-chart.png';
      a.click();
    } catch {
      /* ignore */
    }
  }, [fit]);

  const draggingNode = drag ? nodes.find((n) => n.id === drag.nodeId) : null;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[var(--bg)] text-[var(--text)]">
      <Toolbar
        scale={view.scale}
        saveState={saveState}
        nodes={nodes}
        onFit={fit}
        onZoom={(dir) =>
          setView((v) => ({ ...v, scale: clamp(v.scale * (dir > 0 ? 1.2 : 0.8), 0.2, 2) }))
        }
        onAddTop={() => rootId && addChild(rootId)}
        onOpenSuggestions={() => setSuggestOpen((s) => !s)}
        onImport={importNodes}
        onExportPng={exportPng}
        onPrint={() => window.print()}
      />

      <div
        ref={canvasRef}
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onCanvasPointerMove}
        onPointerUp={onCanvasPointerUp}
        className="absolute inset-0"
        style={{ touchAction: 'none', cursor: panRef.current ? 'grabbing' : 'default' }}
      >
        <div ref={exportRef} className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}>
          {layout && (
            <svg
              className="pointer-events-none absolute left-0 top-0"
              style={{ overflow: 'visible', width: 1, height: 1 }}
            >
              {layout.connectors.map((c) => (
                <path
                  key={c.id}
                  d={c.d}
                  fill="none"
                  stroke="var(--line-strong)"
                  strokeWidth={1.5}
                />
              ))}
            </svg>
          )}
          {layout?.nodes.map((p) => (
            <OrgNodeCard
              key={p.node.id}
              node={p.node}
              x={p.x}
              y={p.y}
              selected={p.node.id === selectedId}
              dragging={drag?.nodeId === p.node.id}
              dropTarget={drag?.dropTargetId === p.node.id}
              onPointerDown={onNodePointerDown}
            />
          ))}
        </div>
      </div>

      <Legend />

      {suggestOpen && (
        <SuggestionsPopover
          onPick={(item, dept) => {
            const parentId = selectedId ?? rootId;
            if (parentId) addChild(parentId, { name: item.name, role: item.role, dept, vacant: true });
            setSuggestOpen(false);
          }}
          onClose={() => setSuggestOpen(false)}
          targetName={(selected ?? nodes.find((n) => n.id === rootId))?.name ?? ''}
        />
      )}

      {selected && (
        <EditPanel
          node={selected}
          isRoot={selected.parentId === null}
          childCount={childrenOf(nodes, selected.id).length}
          onChange={(patch) => updateNode(selected.id, patch)}
          onAddChild={() => addChild(selected.id)}
          onDelete={() => deleteNode(selected.id)}
          onClose={() => setSelectedId(null)}
        />
      )}

      {/* floating ghost label while dragging */}
      {drag && draggingNode && (
        <div
          className="pointer-events-none fixed z-50 rounded-lg px-2.5 py-1 text-[12px] font-medium shadow-lg"
          style={{
            left: drag.pointerX + 14,
            top: drag.pointerY + 14,
            background: 'var(--accent)',
            color: '#1a1a1a',
          }}
        >
          {drag.dropTargetId ? '↳ ' : ''}
          {draggingNode.name}
        </div>
      )}

      {!loaded && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 grid place-items-center text-xs text-[var(--text-dim)]">
          جارٍ المزامنة…
        </div>
      )}
    </div>
  );
}

// Coerce arbitrary persisted/imported data into clean OrgNodes.
function normalize(arr: unknown[]): OrgNode[] {
  const valid = new Set<Dept>(DEPT_KEYS);
  return (arr as Record<string, unknown>[])
    .filter((r) => r && typeof r.id === 'string')
    .map((r) => ({
      id: String(r.id),
      parentId: r.parentId == null ? null : String(r.parentId),
      name: String(r.name ?? '—').slice(0, 120),
      role: String(r.role ?? '').slice(0, 160),
      dept: valid.has(r.dept as Dept) ? (r.dept as Dept) : 'production',
      vacant: r.vacant === true,
    }));
}
