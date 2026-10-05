import { describe, expect, it } from 'vitest';
import { LAYERS, density, getLayer, householdSize, percentUrban, ratio, resolveYear } from './statistics.layers';
import { node, fixtureIndex, LAGUNA, CALAMBA } from '@/test/fixtures';

const laguna = fixtureIndex().get(LAGUNA)!;
const calamba = fixtureIndex().get(CALAMBA)!;

describe('derived calculations', () => {
  it('computes density as population over land area', () => {
    expect(density(laguna, 2024)).toBeCloseTo(3687345 / 1928.23, 6);
    expect(density(laguna, 2020)).toBeCloseTo(3382193 / 1928.23, 6);
  });

  it('never divides by missing or zero denominators', () => {
    expect(ratio(10, 0)).toBeNull();
    expect(ratio(null, 5)).toBeNull();
    expect(ratio(10, null)).toBeNull();
    expect(density(node('x', 'X', 'municipality', null, { population: 100 }), 2024)).toBeNull();
    expect(density(calamba, 2020)).toBeNull(); // no 2020 count in the fixture
  });

  it('computes percent urban and household size', () => {
    expect(percentUrban(laguna)).toBeCloseTo(81.36, 1);
    expect(householdSize(laguna)).toBeCloseTo(3.6, 6);
    expect(percentUrban(calamba)).toBeNull();
  });
});

describe('data layers', () => {
  it('reads the value for the requested year', () => {
    const population = getLayer('population');
    expect(population.getValue(laguna, 2024)).toBe(3687345);
    expect(population.getValue(laguna, 2020)).toBe(3382193);
    expect(population.getValue(laguna, 2015)).toBeNull();
    expect(population.getValue(laguna, 1990)).toBeNull();
  });

  it('labels growth by period and returns the published rate', () => {
    const growth = getLayer('growth');
    expect(growth.yearLabel(2024)).toBe('2020–2024');
    expect(growth.getValue(laguna, 2024)).toBe(2.1);
    expect(growth.getValue(laguna, 2020)).toBeNull();
    expect(growth.formatCompact(-0.5)).toBe('−0.50%');
  });

  it('falls back to a known layer and a year that layer supports', () => {
    expect(getLayer('nonsense').id).toBe('population');
    expect(resolveYear(getLayer('urban'), 2015)).toBe(2024);
    expect(resolveYear(getLayer('population'), 2015)).toBe(2015);
    expect(resolveYear(getLayer('population'), null)).toBe(2024);
  });

  it('gives every layer a unique id, years newest first, and safe formatting', () => {
    expect(new Set(LAYERS.map((l) => l.id)).size).toBe(LAYERS.length);
    for (const layer of LAYERS) {
      expect(layer.years).toEqual([...layer.years].sort((a, b) => b - a));
      expect(layer.formatValue(1234.5)).not.toMatch(/NaN|undefined/);
      expect(layer.getValue(node('x', 'X', 'barangay', null), layer.years[0]!)).toBeNull();
    }
  });
});
