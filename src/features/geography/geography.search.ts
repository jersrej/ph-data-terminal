import { barangayParentCode, type GeoIndex } from './geography.hierarchy';
import type { GeoKind, Psgc } from './geography.types';

export interface SearchEntry {
  code: Psgc;
  name: string;
  kind: GeoKind;
  /** Lower-cased, accent-free name used for matching. */
  key: string;
  /** Extra match keys, e.g. "ncr" or "region iv-a". */
  altKey?: string;
  population: number | null;
}

export interface SearchResult {
  code: Psgc;
  name: string;
  kind: GeoKind;
  /** Nearest-first ancestor names, e.g. ["City of Pasig", "National Capital Region"]. */
  trail: string[];
}

/** Barangay names keyed by the first seven PSGC digits of their parent; each entry is "BBBName". */
export type BarangaySearchData = Record<string, string[]>;

export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** "City of Cebu" should be found by "cebu city", and be the top hit for plain "cebu". */
function cityAliases(name: string): string[] {
  const match = name.match(/^City of (.+)$/i) ?? name.match(/^(.+) City$/i);
  return match ? [normalize(`${match[1]} City`), normalize(match[1]!)] : [];
}

export function buildCoreEntries(index: GeoIndex): SearchEntry[] {
  const entries: SearchEntry[] = [];
  for (const node of index.all()) {
    const altKey = [node.alt ? normalize(node.alt) : '', ...(node.kind === 'city' ? cityAliases(node.name) : [])].filter(Boolean).join('|');
    entries.push({
      code: node.code,
      name: node.name,
      kind: node.kind,
      key: normalize(node.name),
      altKey: altKey || undefined,
      population: node.stats.population,
    });
  }
  return entries;
}

export function buildBarangayEntries(data: BarangaySearchData): SearchEntry[] {
  const entries: SearchEntry[] = [];
  for (const [prefix, names] of Object.entries(data)) {
    for (const packed of names) {
      const name = packed.slice(3);
      entries.push({ code: prefix + packed.slice(0, 3), name, kind: 'barangay', key: normalize(name), population: null });
    }
  }
  return entries;
}

const KIND_ORDER: GeoKind[] = ['country', 'region', 'province', 'sga', 'city', 'municipality', 'submun', 'barangay'];

/** 0 = exact, 1 = starts with, 2 = a word starts with, 3 = contains; -1 = no match. */
function matchTier(key: string, query: string): number {
  if (key === query) return 0;
  if (key.startsWith(query)) return 1;
  const at = key.indexOf(query);
  if (at === -1) return -1;
  return key[at - 1] === ' ' ? 2 : 3;
}

export function search(entries: SearchEntry[], index: GeoIndex, rawQuery: string, limit = 12): SearchResult[] {
  let query = normalize(rawQuery);
  // "Barangay San Antonio" / "Brgy. San Antonio" restricts the search to barangays.
  const barangayOnly = /^(barangay|brgy|bgy)\s+\S/.test(query);
  if (barangayOnly) query = query.replace(/^(barangay|brgy|bgy)\s+/, '');
  if (query.length < 2) return [];

  const hits: { entry: SearchEntry; tier: number }[] = [];
  for (const entry of entries) {
    if (barangayOnly && entry.kind !== 'barangay') continue;
    let tier = matchTier(entry.key, query);
    if (entry.altKey) {
      for (const alt of entry.altKey.split('|')) {
        const altTier = matchTier(alt, query);
        if (altTier !== -1 && (tier === -1 || altTier < tier)) tier = altTier;
      }
    }
    // Barangays named e.g. "Barangay 12" keep the stripped word in their own name.
    if (tier === -1 && barangayOnly) tier = matchTier(entry.key, `barangay ${query}`);
    if (tier === -1) continue;
    // Thousands of barangays share names with towns ("Pasig", "San Jose"). Unless the query
    // asks for barangays, rank them one tier down so the better-known place comes first.
    if (entry.kind === 'barangay' && !barangayOnly) tier += 1;
    hits.push({ entry, tier });
  }

  hits.sort(
    (a, b) =>
      a.tier - b.tier ||
      KIND_ORDER.indexOf(a.entry.kind) - KIND_ORDER.indexOf(b.entry.kind) ||
      (b.entry.population ?? 0) - (a.entry.population ?? 0) ||
      a.entry.name.localeCompare(b.entry.name) ||
      a.entry.code.localeCompare(b.entry.code),
  );

  return hits.slice(0, limit).map(({ entry }) => ({
    code: entry.code,
    name: entry.name,
    kind: entry.kind,
    trail: trailFor(index, entry),
  }));
}

/** Resolve a result's ancestors from its PSGC code, nearest first, without the country. */
function trailFor(index: GeoIndex, entry: SearchEntry): string[] {
  const anchor = index.get(entry.kind === 'barangay' ? barangayParentCode(entry.code) : entry.code);
  if (!anchor) return [];
  const chain = entry.kind === 'barangay' ? index.lineage(anchor) : index.ancestors(anchor);
  return chain
    .filter((n) => n.kind !== 'country')
    .map((n) => n.name)
    .reverse();
}
