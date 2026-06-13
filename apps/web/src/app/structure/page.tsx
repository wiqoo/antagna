import type { Metadata } from 'next';
import { OrgChart } from './OrgChart';

export const metadata: Metadata = {
  title: 'الهيكل التنظيمي — Volt Production',
  description: 'مخطط تنظيمي تفاعلي لفريق فولت برودكشن.',
};

// Public, full-screen, no app shell. Auth is bypassed in middleware; the chart
// loads its data client-side from /api/org-chart (with a localStorage fallback).
export default function StructurePage() {
  return <OrgChart />;
}
