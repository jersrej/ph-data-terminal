/** A 10-digit Philippine Standard Geographic Code. The only identifier used for joins. */
export type Psgc = string;

export type GeoKind =
  | 'country'
  | 'region'
  | 'province'
  /** BARMM's Special Geographic Area: province-level, but not a province. */
  | 'sga'
  | 'city'
  | 'municipality'
  /** Sub-municipality; only the City of Manila has them. */
  | 'submun'
  | 'barangay';

/** Official figures. `null` always means "not published for this area", never zero. */
export interface GeoStats {
  population: number | null;
  householdPopulation: number | null;
  households: number | null;
  urbanPopulation: number | null;
  /** Square kilometres. */
  landArea: number | null;
  /** True when land area was measured from the boundary polygon rather than published. */
  landAreaEstimated: boolean;
  population2020: number | null;
  population2015: number | null;
  population2010: number | null;
  /** Annual population growth rates, percent, as published by PSA. */
  growth2020to2024: number | null;
  growth2015to2020: number | null;
  growth2010to2015: number | null;
  /** Barangays within this area; 1 for a barangay itself. */
  barangays: number;
}

export interface GeoNode {
  code: Psgc;
  name: string;
  kind: GeoKind;
  parent: Psgc | null;
  /** Alternative designation, e.g. "Region IV-A" for CALABARZON. */
  alt?: string;
  stats: GeoStats;
}

export const COUNTRY_CODE: Psgc = '0000000000';

export const KIND_LABEL: Record<GeoKind, string> = {
  country: 'Country',
  region: 'Region',
  province: 'Province',
  sga: 'Special geographic area',
  city: 'City',
  municipality: 'Municipality',
  submun: 'Sub-municipality',
  barangay: 'Barangay',
};
