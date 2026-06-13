// Org-chart domain data — shared by the canvas, cards, edit panel and toolbar.

export type Dept =
  | 'leadership'
  | 'management'
  | 'commercial'
  | 'production'
  | 'finance'
  | 'admin';

export interface OrgNode {
  id: string;
  parentId: string | null; // null = root
  name: string;
  role: string;
  dept: Dept;
  vacant: boolean;
}

export const DEPTS: Record<Dept, { label: string; color: string }> = {
  leadership: { label: 'القيادة', color: '#FF6B1A' },
  management: { label: 'الإدارة', color: '#2DB6A8' },
  commercial: { label: 'التجاري', color: '#4D8DF0' },
  production: { label: 'الإنتاج', color: '#A78BFA' },
  finance: { label: 'المالية', color: '#9AA0A6' },
  admin: { label: 'الدعم والإدارة', color: '#F4B740' },
};

export const DEPT_KEYS = Object.keys(DEPTS) as Dept[];

// Layout geometry (d3-hierarchy nodeSize). Cards render at NODE_W × NODE_H.
export const NODE_W = 230;
export const NODE_H = 104;
export const GAP_X = 32;
export const GAP_Y = 62;

// Fallback structure when the API + localStorage are both empty (matches the
// DB seed in migration 074).
export const SEED: OrgNode[] = [
  { id: 'n1', parentId: null, name: 'محمد المالكي', role: 'Founder & Creative Director', dept: 'leadership', vacant: false },
  { id: 'n2', parentId: 'n1', name: 'خالد الغامدي', role: 'Project Manager', dept: 'management', vacant: false },
  { id: 'n3', parentId: 'n1', name: 'محمد غريب', role: 'Production Manager / Photographer', dept: 'management', vacant: false },
  { id: 'n4', parentId: 'n1', name: 'حسين', role: 'Financial Manager', dept: 'finance', vacant: false },
  { id: 'n14', parentId: 'n1', name: 'HR', role: 'الموارد البشرية', dept: 'admin', vacant: true },
  { id: 'n15', parentId: 'n1', name: 'Legal', role: 'الشؤون القانونية', dept: 'admin', vacant: true },
  { id: 'n5', parentId: 'n2', name: 'عبدالله منصوري', role: 'Account Manager (Abu Luka)', dept: 'commercial', vacant: false },
  { id: 'n6', parentId: 'n2', name: 'Sales', role: 'مبيعات', dept: 'commercial', vacant: true },
  { id: 'n7', parentId: 'n2', name: 'Marketing', role: 'تسويق', dept: 'commercial', vacant: true },
  { id: 'n8', parentId: 'n5', name: 'Videographer', role: 'مصوّر فيديو', dept: 'production', vacant: true },
  { id: 'n9', parentId: 'n3', name: 'محسن', role: 'Editor (Mid-level)', dept: 'production', vacant: false },
  { id: 'n10', parentId: 'n3', name: 'مساعد', role: 'Technician', dept: 'production', vacant: false },
  { id: 'n11', parentId: 'n3', name: 'Post-Production Head', role: 'رئيس ما بعد الإنتاج', dept: 'production', vacant: true },
  { id: 'n12', parentId: 'n3', name: 'Videographer', role: 'مصوّر فيديو', dept: 'production', vacant: true },
  { id: 'n13', parentId: 'n4', name: 'خالد الشهري', role: 'Accountant', dept: 'finance', vacant: false },
];

export interface SuggestionGroup {
  dept: Dept;
  label: string;
  items: { name: string; role: string }[];
}

export const SUGGESTIONS: SuggestionGroup[] = [
  {
    dept: 'commercial',
    label: 'التجاري',
    items: [
      { name: 'Account Director', role: 'مدير حسابات أول' },
      { name: 'Account Executive', role: 'تنفيذي حسابات' },
      { name: 'Sales Manager', role: 'مدير مبيعات' },
      { name: 'Marketing Manager', role: 'مدير تسويق' },
      { name: 'Social Media Manager', role: 'سوشيال ميديا' },
      { name: 'Media Buyer', role: 'مشتري إعلانات' },
    ],
  },
  {
    dept: 'production',
    label: 'الإنتاج',
    items: [
      { name: 'Producer', role: 'منتج' },
      { name: 'Production Coordinator', role: 'منسّق إنتاج' },
      { name: 'DOP / Cinematographer', role: 'مدير تصوير' },
      { name: 'Gaffer / Lighting', role: 'مهندس إضاءة' },
      { name: 'Camera Operator', role: 'مشغّل كاميرا' },
      { name: 'Drone Operator', role: 'مشغّل درون' },
    ],
  },
  {
    dept: 'production',
    label: 'ما بعد الإنتاج',
    items: [
      { name: 'Senior Editor', role: 'مونتير أول' },
      { name: 'Colorist', role: 'مصحّح ألوان' },
      { name: 'Motion / VFX Artist', role: 'موشن / مؤثرات' },
      { name: 'Sound Engineer', role: 'مهندس صوت' },
      { name: 'DIT / Media Manager', role: 'إدارة الميديا' },
    ],
  },
  {
    dept: 'admin',
    label: 'الدعم والإدارة',
    items: [
      { name: 'HR Manager', role: 'مدير موارد بشرية' },
      { name: 'Legal Counsel', role: 'مستشار قانوني' },
      { name: 'Operations Manager', role: 'مدير عمليات' },
    ],
  },
];

// ── Tree helpers (pure) ──────────────────────────────────────────────────────

/** Children of `id`, preserving array order (which encodes sibling position). */
export function childrenOf(nodes: OrgNode[], id: string | null): OrgNode[] {
  return nodes.filter((n) => n.parentId === id);
}

/** Every descendant id of `id` (excluding itself) — used for cycle guards. */
export function descendantIds(nodes: OrgNode[], id: string): Set<string> {
  const out = new Set<string>();
  const walk = (pid: string) => {
    for (const n of nodes) {
      if (n.parentId === pid && !out.has(n.id)) {
        out.add(n.id);
        walk(n.id);
      }
    }
  };
  walk(id);
  return out;
}

/** Would re-parenting `nodeId` under `targetId` create a cycle (or be a no-op)? */
export function wouldCycle(nodes: OrgNode[], nodeId: string, targetId: string): boolean {
  if (nodeId === targetId) return true;
  return descendantIds(nodes, nodeId).has(targetId);
}

let counter = 0;
/** Stable-enough unique id without Math.random in the module scope. */
export function newId(): string {
  counter += 1;
  return `node-${Date.now().toString(36)}-${counter}`;
}
