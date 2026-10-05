import { describe, expect, it } from 'vitest';
import { compareAreas, rankAreas, shareOfParent } from './statistics.derive';
import { getLayer } from './statistics.layers';
import { CALABARZON, CAVITE, LAGUNA, LUCENA, fixtureBarangays, fixtureIndex, node } from '@/test/fixtures';

const index = fixtureIndex();
const population = getLayer('population');

describe('rankAreas', () => {
  it('orders areas from highest to lowest', () => {
    const ranked = rankAreas(index.children(CALABARZON), population, 2024);
    expect(ranked.map((r) => [r.rank, r.node.code])).toEqual([[1, CAVITE], [2, LAGUNA], [3, LUCENA]]);
    expect(ranked[0]!.fraction).toBe(1);
    expect(ranked[1]!.fraction).toBeCloseTo(3687345 / 4573884, 6);
  });

  it('leaves areas without data unranked at the end', () => {
    const ranked = rankAreas(index.children(CALABARZON), population, 2020);
    expect(ranked.at(-1)).toMatchObject({ rank: null, value: null, fraction: null });
    expect(ranked.at(-1)!.node.code).toBe(LUCENA);
  });

  it('gives tied areas the same rank', () => {
    const tied = [node('1', 'A', 'barangay', null, { population: 5 }), node('2', 'B', 'barangay', null, { population: 5 }), node('3', 'C', 'barangay', null, { population: 1 })];
    expect(rankAreas(tied, population, 2024).map((r) => r.rank)).toEqual([1, 1, 3]);
  });
});

describe('shareOfParent', () => {
  it('is the percentage of the parent population', () => {
    expect(shareOfParent(index.get(LAGUNA)!, index.get(CALABARZON))).toBeCloseTo(21.776, 2);
    expect(shareOfParent(index.root, undefined)).toBeNull();
  });
});

describe('compareAreas', () => {
  const rows = compareAreas(index.get(LAGUNA)!, index.get(CAVITE)!);
  const row = (id: string) => rows.find((r) => r.metric.id === id)!;

  it('puts both values side by side with bars scaled to the larger', () => {
    expect(row('population')).toMatchObject({ a: 3687345, b: 4573884 });
    expect(row('population').bars![1]).toBe(1);
    expect(row('population').ratio).toBeCloseTo(0.806, 3);
    expect(row('barangays')).toMatchObject({ a: 681, b: 803 });
  });

  it('computes density for each side from its own land area', () => {
    expect(row('density').a).toBeCloseTo(1912.3, 1);
    expect(row('density').b).toBeCloseTo(2996.75, 1);
  });

  it('shows no bar or ratio when either side lacks the figure', () => {
    expect(row('urban')).toMatchObject({ b: null, bars: null, ratio: null });
  });

  it('marks barangay land area as an estimate', () => {
    const [canlubang] = fixtureBarangays();
    const area = compareAreas(canlubang!, index.get(LAGUNA)!).find((r) => r.metric.id === 'area')!;
    expect(area.metric.note?.(canlubang!)).toBe('from boundary');
    expect(area.metric.note?.(index.get(LAGUNA)!)).toBeUndefined();
  });
});
