import type { GeoNode } from '../geography/geography.types';
import { formatCompact, formatDecimal, formatInteger, formatPercent, formatSignedPercent } from '@/lib/format';

/**
 * A data layer turns a geography into one number. The map, legend, ranking and
 * comparison are all driven by this interface, so adding a layer means adding
 * one entry to LAYERS and nothing else.
 */
export interface DataLayer {
  id: string;
  label: string;
  unit?: string;
  /** Years with data, newest first. */
  years: number[];
  yearLabel: (year: number) => string;
  /** Diverging layers have a meaningful zero (growth vs decline). */
  scale: 'sequential' | 'diverging';
  getValue: (node: GeoNode, year: number) => number | null;
  formatValue: (value: number) => string;
  /** Short form for legends, labels and ranking rows. */
  formatCompact: (value: number) => string;
  /** Where the figure comes from, shown under the legend. */
  source: string;
}

const plainYear = (year: number) => String(year);

export function populationIn(node: GeoNode, year: number): number | null {
  switch (year) {
    case 2024: return node.stats.population;
    case 2020: return node.stats.population2020;
    case 2015: return node.stats.population2015;
    case 2010: return node.stats.population2010;
    default: return null;
  }
}

/** Division that refuses to manufacture a number from missing or zero inputs. */
export function ratio(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator <= 0) return null;
  return numerator / denominator;
}

export function density(node: GeoNode, year: number): number | null {
  return ratio(populationIn(node, year), node.stats.landArea);
}

export function percentUrban(node: GeoNode): number | null {
  const share = ratio(node.stats.urbanPopulation, node.stats.population);
  return share === null ? null : share * 100;
}

export function householdSize(node: GeoNode): number | null {
  return ratio(node.stats.householdPopulation, node.stats.households);
}

const GROWTH_PERIOD: Record<number, [label: string, get: (n: GeoNode) => number | null]> = {
  2024: ['2020–2024', (n) => n.stats.growth2020to2024],
  2020: ['2015–2020', (n) => n.stats.growth2015to2020],
  2015: ['2010–2015', (n) => n.stats.growth2010to2015],
};

export const LAYERS: DataLayer[] = [
  {
    id: 'population',
    label: 'Population',
    unit: 'persons',
    years: [2024, 2020, 2015, 2010],
    yearLabel: plainYear,
    scale: 'sequential',
    getValue: populationIn,
    formatValue: formatInteger,
    formatCompact,
    source: 'PSA census counts',
  },
  {
    id: 'density',
    label: 'Population density',
    unit: 'persons per km²',
    years: [2024, 2020, 2015],
    yearLabel: plainYear,
    scale: 'sequential',
    getValue: density,
    formatValue: (v) => `${formatInteger(v)} / km²`,
    formatCompact: (v) => formatCompact(Math.round(v)),
    source: 'Population ÷ land area',
  },
  {
    id: 'growth',
    label: 'Population growth',
    unit: '% per year',
    years: [2024, 2020, 2015],
    yearLabel: (year) => GROWTH_PERIOD[year]?.[0] ?? String(year),
    scale: 'diverging',
    getValue: (node, year) => GROWTH_PERIOD[year]?.[1](node) ?? null,
    formatValue: (v) => `${formatSignedPercent(v)} per year`,
    formatCompact: (v) => formatSignedPercent(v),
    source: 'PSA annual population growth rate',
  },
  {
    id: 'urban',
    label: 'Urbanization',
    unit: '% urban',
    years: [2024],
    yearLabel: plainYear,
    scale: 'sequential',
    getValue: percentUrban,
    formatValue: (v) => `${formatPercent(v)} urban`,
    formatCompact: (v) => formatPercent(v, v === 0 || v === 100 ? 0 : 1),
    source: 'Urban population ÷ total population',
  },
  {
    id: 'households',
    label: 'Households',
    unit: 'households',
    years: [2024],
    yearLabel: plainYear,
    scale: 'sequential',
    getValue: (node) => node.stats.households,
    formatValue: formatInteger,
    formatCompact,
    source: 'PSA census counts',
  },
  {
    id: 'household-size',
    label: 'Household size',
    unit: 'persons per household',
    years: [2024],
    yearLabel: plainYear,
    scale: 'sequential',
    getValue: householdSize,
    formatValue: (v) => `${formatDecimal(v, 2)} persons`,
    formatCompact: (v) => formatDecimal(v, 2),
    source: 'Household population ÷ households',
  },
];

export function getLayer(id: string): DataLayer {
  return LAYERS.find((l) => l.id === id) ?? LAYERS[0]!;
}

/** The requested year if the layer has it, otherwise the layer's latest. */
export function resolveYear(layer: DataLayer, year: number | null): number {
  return year !== null && layer.years.includes(year) ? year : layer.years[0]!;
}
