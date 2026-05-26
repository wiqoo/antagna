/**
 * Data shapes the production dashboard feeds into the wired cards. Every
 * card prop is optional — when absent the card falls back to its built-in
 * sample content (so the preview labs keep rendering with no data source).
 */

export type EmailTriageData = {
  awaitingOurReply: number;
  urgent: number;
  items: { who: string; what: string; priority: 'critical' | 'high' | 'med'; href?: string }[];
};

export type SuggestionsData = {
  pending: number;
  items: { type: string; text: string; confidence: number }[];
};

export type ProjectHealthData = {
  analyzed: number;
  items: { name: string; health: 'red' | 'amber' | 'green'; why: string; pct: number; href?: string }[];
};

export type AtRiskData = {
  confidence?: number;
  items: { name: string; score: number; why: string; href?: string }[];
};

export type StaleConvosData = {
  items: { client: string; why: string; days: number; href?: string }[];
};

export type CapacityData = {
  note?: string;
  people: { name: string; days: number[] }[];
};

export type ShootsData = {
  count: number;
  conflicts: number;
  items: { when: string; what: string; city: string; isToday: boolean; conflict: boolean; href?: string }[];
};

export type RevenueData = { value: number; deltaPct?: number };

export type ApprovalsData = {
  items: { what: string; sub?: string; href?: string }[];
};

export type ConflictsData = {
  count: number;
  items: { label: string; detail: string }[];
};

export type GlanceData = {
  active: number;
  tasks: number;
  leads: number;
  review: number;
};
