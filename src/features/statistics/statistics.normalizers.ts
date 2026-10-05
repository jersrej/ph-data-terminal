import type { GeoKind, GeoNode, Psgc } from '../geography/geography.types';
import { isPsgc } from '../geography/geography.hierarchy';
import { DatasetError, type RawBarangayDataset, type RawCoreDataset, type SourceTable } from './statistics.types';

const KINDS: ReadonlySet<string> = new Set<GeoKind>(['country', 'region', 'province', 'sga', 'city', 'municipality', 'submun', 'barangay']);
const CORE_FIELDS = ['code', 'name', 'kind', 'parent', 'alt', 'pop', 'hhPop', 'hh', 'urb', 'area', 'p20', 'p15', 'p10', 'g2024', 'g1520', 'g1015', 'nBgy'];
const BARANGAY_FIELDS = ['code', 'name', 'pop', 'hhPop', 'hh', 'urb', 'areaEst'];

/** Anything that is not a finite number is "not published", never zero. */
function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function assertFields(actual: unknown, expected: string[], what: string) {
  if (!Array.isArray(actual) || expected.some((f, i) => actual[i] !== f)) {
    throw new DatasetError(`${what}: unexpected field layout`);
  }
}

export interface CoreDataset {
  nodes: GeoNode[];
  census: string;
  generated: string;
  tables: SourceTable[];
}

export function normalizeCore(raw: unknown): CoreDataset {
  const data = raw as Partial<RawCoreDataset> | null;
  if (!data || !Array.isArray(data.nodes) || !data.meta) throw new DatasetError('Core dataset: missing nodes or metadata');
  assertFields(data.meta.fields, CORE_FIELDS, 'Core dataset');

  const nodes: GeoNode[] = [];
  for (const row of data.nodes) {
    const [code, name, kind, parent, alt, pop, hhPop, hh, urb, area, p20, p15, p10, g2024, g1520, g1015, nBgy] = row;
    if (!isPsgc(code) || typeof name !== 'string' || !KINDS.has(kind)) {
      throw new DatasetError(`Core dataset: malformed row for ${String(code)}`);
    }
    nodes.push({
      code,
      name,
      kind,
      parent,
      alt: alt ?? undefined,
      stats: {
        population: num(pop),
        householdPopulation: num(hhPop),
        households: num(hh),
        urbanPopulation: num(urb),
        landArea: num(area),
        // PSA publishes no land area below city level; the build measures it from boundaries.
        landAreaEstimated: kind === 'submun',
        population2020: num(p20),
        population2015: num(p15),
        population2010: num(p10),
        growth2020to2024: num(g2024),
        growth2015to2020: num(g1520),
        growth2010to2015: num(g1015),
        barangays: num(nBgy) ?? 0,
      },
    });
  }
  return { nodes, census: data.meta.census, generated: data.meta.generated, tables: data.meta.tables ?? [] };
}

export function normalizeBarangays(raw: unknown, parent: Psgc): GeoNode[] {
  const data = raw as Partial<RawBarangayDataset> | null;
  if (!data || !Array.isArray(data.rows)) throw new DatasetError(`Barangay dataset ${parent}: missing rows`);
  if (data.parent !== parent) throw new DatasetError(`Barangay dataset ${parent}: belongs to ${String(data.parent)}`);
  assertFields(data.fields, BARANGAY_FIELDS, `Barangay dataset ${parent}`);

  return data.rows.map(([code, name, pop, hhPop, hh, urb, areaEst]) => {
    if (!isPsgc(code) || typeof name !== 'string') throw new DatasetError(`Barangay dataset ${parent}: malformed row`);
    const landArea = num(areaEst);
    return {
      code,
      name,
      kind: 'barangay',
      parent,
      stats: {
        population: num(pop),
        householdPopulation: num(hhPop),
        households: num(hh),
        urbanPopulation: num(urb),
        // A polygon that collapsed to nothing has no usable area.
        landArea: landArea !== null && landArea > 0 ? landArea : null,
        landAreaEstimated: true,
        population2020: null,
        population2015: null,
        population2010: null,
        growth2020to2024: null,
        growth2015to2020: null,
        growth2010to2015: null,
        barangays: 1,
      },
    };
  });
}

/** Index statistics by PSGC so features join in O(1). */
export function indexByPsgc(nodes: GeoNode[]): Map<Psgc, GeoNode> {
  return new Map(nodes.map((n) => [n.code, n]));
}
