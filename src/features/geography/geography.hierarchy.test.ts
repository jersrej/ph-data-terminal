import { describe, expect, it } from 'vitest';
import { barangayParentCode, childrenLabel, isPsgc, resolveSelection } from './geography.hierarchy';
import { CALABARZON, CALAMBA, CANLUBANG, LAGUNA, LUCENA, NCR, PH, fixtureIndex } from '@/test/fixtures';

describe('PSGC hierarchy', () => {
  const index = fixtureIndex();

  it('resolves children by parent code', () => {
    expect(index.children(CALABARZON).map((n) => n.name)).toEqual(['Laguna', 'Cavite', 'City of Lucena']);
    expect(index.children(PH)).toHaveLength(3);
  });

  it('treats a highly urbanized city as a sibling of provinces, not a child of one', () => {
    expect(index.get(LUCENA)?.parent).toBe(CALABARZON);
    expect(index.children(LAGUNA).some((n) => n.code === LUCENA)).toBe(false);
  });

  it('walks ancestors root-first and excludes the node itself', () => {
    const calamba = index.get(CALAMBA)!;
    expect(index.ancestors(calamba).map((n) => n.code)).toEqual([PH, CALABARZON, LAGUNA]);
    expect(index.lineage(calamba).at(-1)?.code).toBe(CALAMBA);
    expect(index.ancestors(index.root)).toEqual([]);
  });

  it('knows which areas have barangays as children', () => {
    expect(index.hasBarangayChildren(CALAMBA)).toBe(true);
    expect(index.hasBarangayChildren(LAGUNA)).toBe(false);
    expect(index.hasBarangayChildren('9999999999')).toBe(false);
  });

  it('counts descendants by kind', () => {
    expect(index.descendantCounts(CALABARZON)).toEqual({ province: 2, city: 3, municipality: 1 });
  });

  it('labels the children of each level', () => {
    expect(childrenLabel(index, index.root)).toBe('Regions');
    expect(childrenLabel(index, index.get(CALABARZON)!)).toBe('Provinces & highly urbanized cities');
    expect(childrenLabel(index, index.get(NCR)!)).toBe('Cities & municipalities');
    expect(childrenLabel(index, index.get(LAGUNA)!)).toBe('Cities & municipalities');
    expect(childrenLabel(index, index.get(CALAMBA)!)).toBe('Barangays');
  });
});

describe('selection resolution', () => {
  const index = fixtureIndex();

  it('focuses a non-barangay area on itself', () => {
    const r = resolveSelection(index, LAGUNA);
    expect(r).toMatchObject({ status: 'ok', isBarangay: false });
    expect(r.status === 'ok' && r.focus.code).toBe(LAGUNA);
    expect(r.status === 'ok' && r.lineage.map((n) => n.code)).toEqual([PH, CALABARZON, LAGUNA]);
  });

  it('derives a barangay parent from its code and focuses the parent', () => {
    expect(barangayParentCode(CANLUBANG)).toBe(CALAMBA);
    const r = resolveSelection(index, CANLUBANG);
    expect(r).toMatchObject({ status: 'ok', isBarangay: true });
    expect(r.status === 'ok' && r.focus.code).toBe(CALAMBA);
  });

  it('rejects codes that are malformed or belong to no known area', () => {
    expect(resolveSelection(index, 'laguna').status).toBe('unknown');
    expect(resolveSelection(index, '9912345678').status).toBe('unknown');
    // A code under a province (not a city) cannot be a barangay.
    expect(resolveSelection(index, '0403400001').status).toBe('unknown');
    expect(isPsgc('403400000')).toBe(false);
  });
});
