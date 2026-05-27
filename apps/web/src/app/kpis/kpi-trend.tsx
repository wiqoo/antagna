'use client';

import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts';

const TONE_COLOR: Record<string, string> = {
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  neutral: '#FF6B1A',
};

/** Compact KPI trend sparkline over recent snapshots. */
export function KpiTrend({
  data,
  tone,
  id,
}: {
  data: { t: string; v: number }[];
  tone: string;
  id: string;
}) {
  if (!data || data.length < 2) {
    return (
      <div className="flex h-12 items-center text-[10px] text-[var(--text-dim)]">
        — لا يوجد سجل كافٍ للرسم —
      </div>
    );
  }
  const color = TONE_COLOR[tone] ?? '#FF6B1A';
  const gid = `kpi-g-${id}`;
  return (
    <ResponsiveContainer width="100%" height={48}>
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#${gid})`}
          dot={false}
          isAnimationActive={false}
        />
        <Tooltip
          contentStyle={{
            background: '#17171C',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8,
            fontSize: 11,
            padding: '4px 8px',
          }}
          labelStyle={{ color: '#fff', fontSize: 10 }}
          itemStyle={{ color }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
