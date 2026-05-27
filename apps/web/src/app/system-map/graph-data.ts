// The Antagna system map: modules, data stores, AI, automation + how data flows
// between them. Rendered as an Obsidian-style force-directed graph.

export type NodeCat = 'ai' | 'ingest' | 'domain' | 'surface' | 'auto' | 'data';

export interface GNode {
  id: string;
  label: string;
  cat: NodeCat;
  val: number; // relative size / importance
}
export type LinkKind = 'data' | 'automation' | 'ai';
export interface GLink {
  source: string;
  target: string;
  kind: LinkKind;
}

export const CAT_COLOR: Record<NodeCat, string> = {
  ai: '#FF6B1A', // AI brain / learning — the orange core
  ingest: '#38bdf8', // inbound sources
  domain: '#e5e7eb', // business entities
  surface: '#a78bfa', // pages/surfaces
  auto: '#34d399', // automation / notifications
  data: '#64748b', // data stores / feeds
};

export const CAT_LABEL: Record<NodeCat, string> = {
  ai: 'ذكاء اصطناعي',
  ingest: 'مصادر واردة',
  domain: 'كيانات العمل',
  surface: 'واجهات',
  auto: 'أتمتة / إشعارات',
  data: 'مخازن بيانات',
};

export const NODES: GNode[] = [
  // AI core
  { id: 'ai_brain', label: 'AI Brain · الذاكرة', cat: 'ai', val: 26 },
  { id: 'learning', label: 'حلقة التعلّم', cat: 'ai', val: 12 },
  // Inbound
  { id: 'gmail', label: 'Gmail', cat: 'ingest', val: 10 },
  { id: 'wa_in', label: 'WhatsApp وارد', cat: 'ingest', val: 10 },
  // Domain entities
  { id: 'clients', label: 'العملاء', cat: 'domain', val: 12 },
  { id: 'leads', label: 'الفرص (Leads)', cat: 'domain', val: 11 },
  { id: 'projects', label: 'المشاريع', cat: 'domain', val: 18 },
  { id: 'tasks', label: 'المهام', cat: 'domain', val: 9 },
  { id: 'deliverables', label: 'المخرجات', cat: 'domain', val: 9 },
  { id: 'equipment', label: 'المعدات', cat: 'domain', val: 11 },
  { id: 'people', label: 'الفريق', cat: 'domain', val: 10 },
  { id: 'freelancers', label: 'الفريلانسرز', cat: 'domain', val: 7 },
  { id: 'talents', label: 'المواهب', cat: 'domain', val: 6 },
  { id: 'attendance', label: 'الحضور', cat: 'domain', val: 8 },
  // Surfaces
  { id: 'dashboard', label: 'Dashboard', cat: 'surface', val: 12 },
  { id: 'inbox', label: 'Inbox + اقتراحات', cat: 'surface', val: 12 },
  { id: 'wa_inbox', label: 'WhatsApp inbox', cat: 'surface', val: 9 },
  { id: 'crm', label: 'CRM', cat: 'surface', val: 8 },
  { id: 'kpis', label: 'KPIs', cat: 'surface', val: 8 },
  { id: 'reports', label: 'التقارير', cat: 'surface', val: 8 },
  { id: 'social', label: 'السوشيال', cat: 'surface', val: 7 },
  { id: 'cmdk', label: '⌘K بحث', cat: 'surface', val: 6 },
  // Automation / cross-cutting
  { id: 'automation', label: 'Automation / Alerts', cat: 'auto', val: 11 },
  { id: 'notifications', label: 'الإشعارات', cat: 'auto', val: 11 },
  // Data stores / feeds
  { id: 'activity', label: 'activity_events', cat: 'data', val: 14 },
  { id: 'memory', label: 'ai_memory_chunks', cat: 'data', val: 9 },
  { id: 'kpi_snap', label: 'kpi_snapshots', cat: 'data', val: 7 },
  { id: 'action_log', label: 'ai_action_log', cat: 'data', val: 6 },
];

export const LINKS: GLink[] = [
  // Ingestion → AI + surfaces
  { source: 'gmail', target: 'inbox', kind: 'data' },
  { source: 'gmail', target: 'ai_brain', kind: 'ai' },
  { source: 'wa_in', target: 'wa_inbox', kind: 'data' },
  { source: 'wa_in', target: 'ai_brain', kind: 'ai' },
  // AI brain → suggestions / bot
  { source: 'ai_brain', target: 'inbox', kind: 'ai' },
  { source: 'ai_brain', target: 'wa_inbox', kind: 'ai' },
  { source: 'ai_brain', target: 'projects', kind: 'ai' }, // risk insights
  // Propose→approve executors
  { source: 'inbox', target: 'clients', kind: 'automation' },
  { source: 'inbox', target: 'leads', kind: 'automation' },
  { source: 'inbox', target: 'projects', kind: 'automation' },
  { source: 'inbox', target: 'tasks', kind: 'automation' },
  { source: 'inbox', target: 'action_log', kind: 'data' },
  // Learning loop
  { source: 'action_log', target: 'learning', kind: 'ai' },
  { source: 'learning', target: 'ai_brain', kind: 'ai' },
  // CRM graph
  { source: 'crm', target: 'leads', kind: 'data' },
  { source: 'crm', target: 'clients', kind: 'data' },
  { source: 'leads', target: 'clients', kind: 'data' }, // convert
  { source: 'clients', target: 'projects', kind: 'data' },
  // Project relations
  { source: 'projects', target: 'tasks', kind: 'data' },
  { source: 'projects', target: 'deliverables', kind: 'data' },
  { source: 'projects', target: 'equipment', kind: 'data' },
  { source: 'projects', target: 'people', kind: 'data' },
  { source: 'projects', target: 'freelancers', kind: 'data' },
  { source: 'people', target: 'talents', kind: 'data' },
  // write_activity → the company timeline
  { source: 'projects', target: 'activity', kind: 'automation' },
  { source: 'clients', target: 'activity', kind: 'automation' },
  { source: 'leads', target: 'activity', kind: 'automation' },
  { source: 'tasks', target: 'activity', kind: 'automation' },
  { source: 'equipment', target: 'activity', kind: 'automation' },
  { source: 'attendance', target: 'activity', kind: 'automation' },
  // Activity → AI memory (indexer + RAG)
  { source: 'activity', target: 'memory', kind: 'ai' },
  { source: 'memory', target: 'ai_brain', kind: 'ai' },
  // Automation → notifications, fed by deadlines/battery
  { source: 'projects', target: 'automation', kind: 'data' },
  { source: 'equipment', target: 'automation', kind: 'data' },
  { source: 'automation', target: 'notifications', kind: 'automation' },
  { source: 'notifications', target: 'people', kind: 'automation' },
  { source: 'notifications', target: 'wa_in', kind: 'automation' }, // outbound WhatsApp channel
  // KPI engine
  { source: 'attendance', target: 'kpi_snap', kind: 'data' },
  { source: 'projects', target: 'kpi_snap', kind: 'data' },
  { source: 'kpi_snap', target: 'kpis', kind: 'data' },
  { source: 'kpi_snap', target: 'reports', kind: 'data' },
  // Dashboard aggregates
  { source: 'projects', target: 'dashboard', kind: 'data' },
  { source: 'inbox', target: 'dashboard', kind: 'data' },
  { source: 'kpis', target: 'dashboard', kind: 'data' },
  // ⌘K search reaches the entities
  { source: 'cmdk', target: 'projects', kind: 'data' },
  { source: 'cmdk', target: 'clients', kind: 'data' },
  { source: 'cmdk', target: 'equipment', kind: 'data' },
  { source: 'cmdk', target: 'people', kind: 'data' },
  // Social
  { source: 'social', target: 'talents', kind: 'data' },
  { source: 'social', target: 'clients', kind: 'data' },
];
