import { stratify, tree, type HierarchyPointNode } from 'd3-hierarchy';
import { NODE_W, NODE_H, GAP_X, GAP_Y, type OrgNode } from './org-data';

export interface PositionedNode {
  node: OrgNode;
  x: number; // centre-x of the card in world coords
  y: number; // top-y of the card in world coords
}

export interface Connector {
  id: string; // `${parentId}->${childId}`
  d: string; // svg path (orthogonal elbow)
}

export interface LayoutResult {
  nodes: PositionedNode[];
  connectors: Connector[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number };
}

/**
 * Tidy top-down layout via d3-hierarchy (math only — we render the cards/edges
 * ourselves). Throws if `nodes` isn't a single-rooted tree; callers guard state
 * so that can't happen mid-edit.
 */
export function computeLayout(nodes: OrgNode[]): LayoutResult {
  const root = stratify<OrgNode>()
    .id((d) => d.id)
    .parentId((d) => d.parentId ?? '')(nodes);

  const layout = tree<OrgNode>().nodeSize([NODE_W + GAP_X, NODE_H + GAP_Y]);
  const positioned = layout(root);

  const placed: PositionedNode[] = [];
  const byId = new Map<string, HierarchyPointNode<OrgNode>>();
  positioned.each((p) => {
    byId.set(p.data.id, p);
    placed.push({ node: p.data, x: p.x, y: p.y });
  });

  const connectors: Connector[] = [];
  positioned.each((p) => {
    if (!p.parent) return;
    const parentBottomX = p.parent.x;
    const parentBottomY = p.parent.y + NODE_H;
    const childTopX = p.x;
    const childTopY = p.y;
    const midY = parentBottomY + GAP_Y / 2;
    connectors.push({
      id: `${p.parent.data.id}->${p.data.id}`,
      d: `M ${parentBottomX} ${parentBottomY} V ${midY} H ${childTopX} V ${childTopY}`,
    });
  });

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of placed) {
    minX = Math.min(minX, p.x - NODE_W / 2);
    maxX = Math.max(maxX, p.x + NODE_W / 2);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y + NODE_H);
  }
  if (!placed.length) {
    minX = minY = 0;
    maxX = NODE_W;
    maxY = NODE_H;
  }

  return {
    nodes: placed,
    connectors,
    bounds: { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY },
  };
}
