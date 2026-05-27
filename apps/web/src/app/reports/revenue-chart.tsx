'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/** Interactive monthly-revenue bar chart for /reports. */
export function RevenueChart({
  data,
}: {
  data: { month: string; value: number; count: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }}
          axisLine={false}
          tickLine={false}
          width={44}
          tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}K` : String(v))}
        />
        <Tooltip
          cursor={{ fill: 'rgba(255,107,26,0.08)' }}
          contentStyle={{
            background: '#17171C',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: '#fff' }}
          itemStyle={{ color: '#FF6B1A' }}
        />
        <Bar dataKey="value" name="الإيراد (ر.س)" fill="#FF6B1A" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
