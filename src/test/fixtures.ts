import type { GeoKind, GeoNode, GeoStats, Psgc } from '@/features/geography/geography.types';
import { GeoIndex } from '@/features/geography/geography.hierarchy';

const EMPTY_STATS: GeoStats = {
  population: null,
  householdPopulation: null,
  households: null,
  urbanPopulation: null,
  landArea: null,
  landAreaEstimated: false,
  population2020: null,
  population2015: null,
  population2010: null,
  growth2020to2024: null,
  growth2015to2020: null,
  growth2010to2015: null,
  barangays: 0,
};

export function node(code: Psgc, name: string, kind: GeoKind, parent: Psgc | null, stats: Partial<GeoStats> = {}, alt?: string): GeoNode {
  return { code, name, kind, parent, alt, stats: { ...EMPTY_STATS, ...stats } };
}

export const PH = '0000000000';
export const CALABARZON = '0400000000';
export const NCR = '1300000000';
export const LAGUNA = '0403400000';
export const CAVITE = '0402100000';
export const LUCENA = '0431200000';
export const CALAMBA = '0403405000';
export const SAN_PEDRO = '0403425000';
export const PASIG = '1381200000';
export const CEBU_CITY = '0730600000';
export const CANLUBANG = '0403405011';

/** A small but structurally faithful slice of the real hierarchy, with real 2024 figures. */
export function fixtureNodes(): GeoNode[] {
  return [
    node(PH, 'Philippines', 'country', null, { population: 112729484, landArea: 300000 }),
    node(CALABARZON, 'CALABARZON', 'region', PH, { population: 16933234, landArea: 15470 }, 'Region IV-A'),
    node(NCR, 'National Capital Region', 'region', PH, { population: 14001751, landArea: 620.61 }, 'NCR'),
    node('0700000000', 'Central Visayas', 'region', PH, { population: 6640875 }, 'Region VII'),
    node(LAGUNA, 'Laguna', 'province', CALABARZON, { population: 3687345, landArea: 1928.23, population2020: 3382193, growth2020to2024: 2.1, urbanPopulation: 3000000, households: 1000000, householdPopulation: 3600000, barangays: 681 }),
    node(CAVITE, 'Cavite', 'province', CALABARZON, { population: 4573884, landArea: 1526.28, population2020: 4344829, growth2020to2024: 1.24, barangays: 803 }),
    node(LUCENA, 'City of Lucena', 'city', CALABARZON, { population: 280000, landArea: 80.21 }),
    node(CALAMBA, 'City of Calamba', 'city', LAGUNA, { population: 575046, landArea: 149.07, barangays: 54 }),
    node(SAN_PEDRO, 'City of San Pedro', 'city', LAGUNA, { population: 340000, landArea: 24.05, barangays: 27 }),
    node('0403401000', 'Alaminos', 'municipality', LAGUNA, { population: 52000, barangays: 15 }),
    node(PASIG, 'City of Pasig', 'city', NCR, { population: 853050, barangays: 30 }),
    node(CEBU_CITY, 'City of Cebu', 'city', '0700000000', { population: 965000, barangays: 80 }),
  ];
}

export const fixtureIndex = () => new GeoIndex(fixtureNodes());

export const fixtureBarangays = (): GeoNode[] => [
  node(CANLUBANG, 'Canlubang', 'barangay', CALAMBA, { population: 68780, landArea: 37.1, landAreaEstimated: true, barangays: 1 }),
  node('0403405001', 'Bagong Kalsada', 'barangay', CALAMBA, { population: 3600, landArea: 1.37, landAreaEstimated: true, barangays: 1 }),
];
