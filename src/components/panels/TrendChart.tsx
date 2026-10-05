import { Bar, BarChart, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { formatCompact } from '@/lib/format';

export interface TrendPoint {
  year: number;
  population: number;
}

/** Census counts over time. One series, so no legend: the heading names it. */
export default function TrendChart({ points, activeYear }: { points: TrendPoint[]; activeYear: number }) {
  return (
    <div className="h-28" role="img" aria-label={`Population by census year: ${points.map((p) => `${p.year}, ${formatCompact(p.population)}`).join('; ')}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 16, right: 0, bottom: 0, left: 0 }} barCategoryGap="22%">
          <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: 'var(--color-rule)' }} tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--color-ink-2)' }} />
          <YAxis hide domain={[0, 'dataMax']} />
          <Bar
            dataKey="population"
            radius={[3, 3, 0, 0]}
            isAnimationActive={false}
            shape={(props: { x?: number; y?: number; width?: number; height?: number; payload?: TrendPoint }) => (
              <rect
                x={props.x}
                y={props.y}
                width={props.width}
                height={props.height}
                rx={3}
                fill={props.payload?.year === activeYear ? 'var(--color-data)' : 'var(--color-data-soft)'}
              />
            )}
          >
            <LabelList dataKey="population" position="top" formatter={(v) => formatCompact(Number(v))} style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--color-ink)' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
