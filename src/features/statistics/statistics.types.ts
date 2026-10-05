import type { GeoKind, Psgc } from '../geography/geography.types';

/** One row of public/data/core.json; field order is fixed by scripts/build-data.mjs. */
export type RawCoreRow = [
  code: Psgc,
  name: string,
  kind: GeoKind,
  parent: Psgc | null,
  alt: string | null,
  pop: number | null,
  hhPop: number | null,
  hh: number | null,
  urb: number | null,
  area: number | null,
  p20: number | null,
  p15: number | null,
  p10: number | null,
  g2024: number | null,
  g1520: number | null,
  g1015: number | null,
  nBgy: number,
];

export interface SourceTable {
  id: string;
  title: string;
  updated?: string;
}

export interface RawCoreDataset {
  meta: { generated: string; census: string; fields: string[]; tables: SourceTable[] };
  nodes: RawCoreRow[];
}

/** One row of public/data/bgy/{parent}.json. */
export type RawBarangayRow = [
  code: Psgc,
  name: string,
  pop: number | null,
  hhPop: number | null,
  hh: number | null,
  urb: number | null,
  areaEst: number | null,
];

export interface RawBarangayDataset {
  parent: Psgc;
  fields: string[];
  rows: RawBarangayRow[];
}

export class DatasetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatasetError';
  }
}
