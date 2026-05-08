'use client';

import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltipBody } from '@/components/charts/primitives';
import { PROPERTY_LABELS, PROPERTY_SLUGS, type PropertySlug } from '@/lib/colors';
import type { RevenueByMonthRow } from '@/lib/dashboard';

function eur(cents: number) {
  if (!Number.isFinite(cents)) return '€0';
  return new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0, notation: 'compact',
  }).format(cents / 100);
}

const NAME_MAP: Record<PropertySlug, string> = PROPERTY_LABELS;

export default function RevenueByMonthChart({ data }: { data: RevenueByMonthRow[] }) {
  return (
    <ChartContainer height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: '#94a3b8' }}
          tickLine={false}
          axisLine={{ stroke: '#e2e8f0' }}
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#94a3b8' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => eur(v)}
        />
        <Tooltip
          cursor={{ fill: '#f1f5f9' }}
          content={(props) => (
            <ChartTooltipBody
              {...props}
              format={(v) => eur(Number(v))}
              nameMap={NAME_MAP}
            />
          )}
        />
        {PROPERTY_SLUGS.map((slug) => (
          <Bar
            key={slug}
            dataKey={slug}
            stackId="a"
            fill={`var(--color-property-${slug})`}
            radius={[0, 0, 0, 0]}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}
