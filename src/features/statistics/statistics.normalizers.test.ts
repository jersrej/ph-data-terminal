import { describe, expect, it } from 'vitest';
import { indexByPsgc, normalizeBarangays, normalizeCore } from './statistics.normalizers';
import { DatasetError } from './statistics.types';

const fields = ['code', 'name', 'kind', 'parent', 'alt', 'pop', 'hhPop', 'hh', 'urb', 'area', 'p20', 'p15', 'p10', 'g2024', 'g1520', 'g1015', 'nBgy'];
const meta = { generated: '2026-10-05', census: '2024 POPCEN', fields, tables: [] };
const laguna = ['0403400000', 'Laguna', 'province', '0400000000', null, 3687345, 3672000, 1001000, 3100000, 1928.23, 3382193, 3035081, 2669847, 2.1, 2.3, 2.47, 681];

describe('normalizeCore', () => {
  it('maps a row to a typed node', () => {
    const { nodes } = normalizeCore({ meta, nodes: [laguna] });
    expect(nodes[0]).toMatchObject({
      code: '0403400000',
      kind: 'province',
      parent: '0400000000',
      stats: { population: 3687345, landArea: 1928.23, landAreaEstimated: false, growth2020to2024: 2.1, barangays: 681 },
    });
  });

  it('keeps unpublished values as null rather than zero', () => {
    const row = [...laguna];
    row[9] = null; // land area
    row[13] = '..'; // a stray PXWeb "not available" marker
    const { stats } = normalizeCore({ meta, nodes: [row] }).nodes[0]!;
    expect(stats.landArea).toBeNull();
    expect(stats.growth2020to2024).toBeNull();
  });

  it('rejects malformed datasets instead of rendering them', () => {
    expect(() => normalizeCore(null)).toThrow(DatasetError);
    expect(() => normalizeCore({ meta, nodes: [['403400000', 'Laguna', 'province']] })).toThrow(/malformed row/);
    expect(() => normalizeCore({ meta: { ...meta, fields: ['code', 'pop'] }, nodes: [] })).toThrow(/field layout/);
    expect(() => normalizeCore({ meta, nodes: [[...laguna.slice(0, 2), 'duchy', ...laguna.slice(3)]] })).toThrow(DatasetError);
  });
});

describe('normalizeBarangays', () => {
  const dataset = {
    parent: '0403405000',
    fields: ['code', 'name', 'pop', 'hhPop', 'hh', 'urb', 'areaEst'],
    rows: [
      ['0403405011', 'Canlubang', 68780, 68700, 24244, 68780, 37.1],
      ['0403405099', 'No Outline', 500, 500, 120, 0, null],
    ],
  };

  it('flags land area as an estimate and leaves history unavailable', () => {
    const [canlubang, noOutline] = normalizeBarangays(dataset, '0403405000');
    expect(canlubang).toMatchObject({ kind: 'barangay', parent: '0403405000' });
    expect(canlubang!.stats).toMatchObject({ landArea: 37.1, landAreaEstimated: true, population2020: null, growth2020to2024: null });
    expect(noOutline!.stats.landArea).toBeNull();
    expect(noOutline!.stats.urbanPopulation).toBe(0); // a published zero stays a zero
  });

  it('refuses a file that belongs to another parent', () => {
    expect(() => normalizeBarangays(dataset, '0403401000')).toThrow(/belongs to/);
  });

  it('joins by PSGC and reports a missing join as undefined', () => {
    const byPsgc = indexByPsgc(normalizeBarangays(dataset, '0403405000'));
    expect(byPsgc.get('0403405011')?.name).toBe('Canlubang');
    expect(byPsgc.get('0403405012')).toBeUndefined();
  });
});
