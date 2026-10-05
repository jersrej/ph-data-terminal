import type { GeoNode } from '../geography/geography.types';
import { formatArea, formatDecimal, formatInteger, formatPercent, formatSignedPercent } from '@/lib/format';
import { density, householdSize, percentUrban, ratio, type DataLayer } from './statistics.layers';

export interface RankedArea {
  node: GeoNode;
  value: number | null;
  /** 1-based; null when the area has no value. Ties share a rank. */
  rank: number | null;
  /** Share of the largest value, 0..1, for the bar. */
  fraction: number | null;
}

/** Rank areas by a layer, highest first; areas without data sink to the end unranked. */
export function rankAreas(nodes: GeoNode[], layer: DataLayer, year: number): RankedArea[] {
  const rows = nodes.map((node) => ({ node, value: layer.getValue(node, year) }));
  rows.sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity) || a.node.name.localeCompare(b.node.name));
  const max = rows[0]?.value ?? null;
  let rank = 0;
  let previous: number | null = null;
  return rows.map((row, i) => {
    if (row.value === null) return { ...row, rank: null, fraction: null };
    if (row.value !== previous) rank = i + 1;
    previous = row.value;
    return { ...row, rank, fraction: max !== null && max > 0 ? Math.max(0, row.value / max) : null };
  });
}

/** Percentage of the parent's total, for additive measures only. */
export function shareOfParent(node: GeoNode, parent: GeoNode | undefined): number | null {
  const share = ratio(node.stats.population, parent?.stats.population ?? null);
  return share === null ? null : share * 100;
}

export interface Metric {
  id: string;
  label: string;
  getValue: (node: GeoNode) => number | null;
  format: (value: number) => string;
  /** Appended when the figure is an estimate rather than a published one. */
  note?: (node: GeoNode) => string | undefined;
}

/** The fixed set of figures shown for a selected area and in comparisons (2024). */
export const METRICS: Metric[] = [
  { id: 'population', label: 'Population', getValue: (n) => n.stats.population, format: formatInteger },
  {
    id: 'density',
    label: 'Density',
    getValue: (n) => density(n, 2024),
    format: (v) => `${formatInteger(v)} / km²`,
    note: (n) => (n.stats.landAreaEstimated ? 'approx.' : undefined),
  },
  {
    id: 'area',
    label: 'Land area',
    getValue: (n) => n.stats.landArea,
    format: formatArea,
    note: (n) => (n.stats.landAreaEstimated ? 'from boundary' : undefined),
  },
  { id: 'growth', label: 'Growth 2020–24', getValue: (n) => n.stats.growth2020to2024, format: (v) => `${formatSignedPercent(v)} / yr` },
  { id: 'urban', label: 'Urban', getValue: percentUrban, format: (v) => formatPercent(v) },
  { id: 'households', label: 'Households', getValue: (n) => n.stats.households, format: formatInteger },
  { id: 'household-size', label: 'Household size', getValue: householdSize, format: (v) => formatDecimal(v, 2) },
  { id: 'barangays', label: 'Barangays', getValue: (n) => (n.kind === 'barangay' ? null : n.stats.barangays), format: formatInteger },
];

export interface ComparisonRow {
  metric: Metric;
  a: number | null;
  b: number | null;
  /** Each side as a fraction of the larger, for paired bars; null if either is missing or negative. */
  bars: [number, number] | null;
  /** a relative to b, e.g. 1.24 = 24% higher; null when it cannot be computed. */
  ratio: number | null;
}

export function compareAreas(a: GeoNode, b: GeoNode, metrics: Metric[] = METRICS): ComparisonRow[] {
  return metrics.map((metric) => {
    const va = metric.getValue(a);
    const vb = metric.getValue(b);
    const comparable = va !== null && vb !== null;
    const max = comparable ? Math.max(va, vb) : 0;
    return {
      metric,
      a: va,
      b: vb,
      bars: comparable && va >= 0 && vb >= 0 && max > 0 ? [va / max, vb / max] : null,
      ratio: comparable && va >= 0 && vb > 0 ? va / vb : null,
    };
  });
}
