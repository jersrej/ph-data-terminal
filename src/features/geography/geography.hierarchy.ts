import { COUNTRY_CODE, type GeoKind, type GeoNode, type Psgc } from './geography.types';

/**
 * The PSGC hierarchy down to city/municipality level, held in memory for the
 * whole session. Barangays are loaded per parent and passed in where needed.
 */
export class GeoIndex {
  private readonly nodes = new Map<Psgc, GeoNode>();
  private readonly childCodes = new Map<Psgc, Psgc[]>();

  constructor(nodes: Iterable<GeoNode>) {
    for (const node of nodes) this.nodes.set(node.code, node);
    for (const node of this.nodes.values()) {
      if (node.parent === null) continue;
      const siblings = this.childCodes.get(node.parent);
      if (siblings) siblings.push(node.code);
      else this.childCodes.set(node.parent, [node.code]);
    }
  }

  get root(): GeoNode {
    const root = this.nodes.get(COUNTRY_CODE);
    if (!root) throw new Error('Hierarchy has no country node');
    return root;
  }

  get(code: Psgc): GeoNode | undefined {
    return this.nodes.get(code);
  }

  has(code: Psgc): boolean {
    return this.nodes.has(code);
  }

  all(): IterableIterator<GeoNode> {
    return this.nodes.values();
  }

  /** Children held in the index. Empty for areas whose children are barangays. */
  children(code: Psgc): GeoNode[] {
    return (this.childCodes.get(code) ?? []).map((c) => this.nodes.get(c)!);
  }

  /** True when the children of this area are barangays, which load on demand. */
  hasBarangayChildren(code: Psgc): boolean {
    return this.nodes.has(code) && !this.childCodes.has(code);
  }

  /** Root-first chain of ancestors, excluding the node itself. */
  ancestors(node: GeoNode): GeoNode[] {
    const chain: GeoNode[] = [];
    let parent = node.parent ? this.nodes.get(node.parent) : undefined;
    while (parent) {
      chain.unshift(parent);
      parent = parent.parent ? this.nodes.get(parent.parent) : undefined;
    }
    return chain;
  }

  /** Root-first chain ending at the node itself. */
  lineage(node: GeoNode): GeoNode[] {
    return [...this.ancestors(node), node];
  }

  /** Counts of descendants by kind, e.g. how many cities a region contains. */
  descendantCounts(code: Psgc): Partial<Record<GeoKind, number>> {
    const counts: Partial<Record<GeoKind, number>> = {};
    const visit = (c: Psgc) => {
      for (const child of this.children(c)) {
        counts[child.kind] = (counts[child.kind] ?? 0) + 1;
        visit(child.code);
      }
    };
    visit(code);
    return counts;
  }
}

/**
 * A barangay's parent is encoded in its PSGC: the first seven digits identify the
 * city, municipality or sub-municipality. This lets a barangay deep link resolve
 * its ancestors before any barangay data has loaded.
 */
export function barangayParentCode(code: Psgc): Psgc {
  return `${code.slice(0, 7)}000`;
}

export function isPsgc(value: string): value is Psgc {
  return /^\d{10}$/.test(value);
}

export type Resolution =
  | { status: 'ok'; code: Psgc; isBarangay: boolean; focus: GeoNode; lineage: GeoNode[] }
  | { status: 'unknown'; code: string };

/**
 * Resolve a requested code to the area whose children the map should show (the
 * "focus") and the root-first lineage of that focus. A barangay focuses its parent.
 */
export function resolveSelection(index: GeoIndex, code: string): Resolution {
  if (!isPsgc(code)) return { status: 'unknown', code };
  const node = index.get(code);
  if (node) return { status: 'ok', code, isBarangay: false, focus: node, lineage: index.lineage(node) };
  const parent = index.get(barangayParentCode(code));
  if (parent && index.hasBarangayChildren(parent.code)) {
    return { status: 'ok', code, isBarangay: true, focus: parent, lineage: index.lineage(parent) };
  }
  return { status: 'unknown', code };
}

/** Plural label for the children of an area, used in headings. */
export function childrenLabel(index: GeoIndex, node: GeoNode): string {
  if (index.hasBarangayChildren(node.code)) return 'Barangays';
  const kinds = new Set(index.children(node.code).map((c) => c.kind));
  if (node.kind === 'country') return 'Regions';
  if (kinds.has('submun')) return 'Sub-municipalities';
  if (node.kind === 'region') {
    if (!kinds.has('province')) return 'Cities & municipalities';
    return kinds.has('city') ? 'Provinces & highly urbanized cities' : 'Provinces';
  }
  return 'Cities & municipalities';
}
