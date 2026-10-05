import { queryOptions } from '@tanstack/react-query';
import type { Psgc } from '../geography/geography.types';
import { GeoIndex } from '../geography/geography.hierarchy';
import type { BarangaySearchData } from '../geography/geography.search';
import { normalizeBarangays, normalizeCore, indexByPsgc } from './statistics.normalizers';

/**
 * All statistics are PSA OpenSTAT tables, normalised at build time into static
 * JSON (see scripts/). The app therefore makes one request per dataset, never
 * one per map feature, and never calls the rate-limited OpenSTAT API at runtime.
 */
export class DataUnavailableError extends Error {
  constructor(readonly path: string, readonly status: number) {
    super(`Could not load ${path} (${status})`);
    this.name = 'DataUnavailableError';
  }
}

export async function fetchData(path: string): Promise<unknown> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${path}`);
  if (!response.ok) throw new DataUnavailableError(path, response.status);
  return response.json();
}

// The datasets are immutable for the life of a deployment.
const STATIC = { staleTime: Infinity, gcTime: Infinity } as const;

export const coreQuery = queryOptions({
  queryKey: ['core'],
  queryFn: async () => {
    const dataset = normalizeCore(await fetchData('core.json'));
    return { ...dataset, index: new GeoIndex(dataset.nodes) };
  },
  ...STATIC,
});

export const barangayQuery = (parent: Psgc) =>
  queryOptions({
    queryKey: ['barangays', parent],
    queryFn: async () => indexByPsgc(normalizeBarangays(await fetchData(`bgy/${parent}.json`), parent)),
    ...STATIC,
  });

export const barangaySearchQuery = queryOptions({
  queryKey: ['search-barangays'],
  queryFn: async () => (await fetchData('search-barangays.json')) as BarangaySearchData,
  ...STATIC,
});
