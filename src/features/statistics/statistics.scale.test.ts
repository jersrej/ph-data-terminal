import { describe, expect, it } from 'vitest';
import { DECLINE_RAMP, SEQUENTIAL_RAMP, buildScale, isDarkFill, quantileBreaks } from './statistics.scale';

describe('quantileBreaks', () => {
  it('splits values into equally populated classes', () => {
    expect(quantileBreaks([1, 2, 3, 4, 5, 6, 7, 8], 4)).toEqual([3, 5, 7]);
  });

  it('collapses duplicate breaks in skewed data', () => {
    expect(quantileBreaks([0, 0, 0, 0, 0, 100], 3)).toEqual([]);
    expect(quantileBreaks([1, 1, 1, 5, 9, 9], 3)).toEqual([9]);
  });
});

describe('buildScale', () => {
  it('returns no scale when nothing has a value', () => {
    expect(buildScale([null, null], 'sequential')).toBeNull();
    expect(buildScale([], 'sequential')).toBeNull();
  });

  it('maps larger values to darker steps and missing values to no colour', () => {
    const scale = buildScale([10, 20, 30, 40, 50, 60, null], 'sequential')!;
    expect(scale.colors).toEqual(SEQUENTIAL_RAMP);
    expect(scale.colorOf(10)).toBe(SEQUENTIAL_RAMP[0]);
    expect(scale.colorOf(60)).toBe(SEQUENTIAL_RAMP[5]);
    expect(scale.colorOf(null)).toBeNull();
    expect([scale.min, scale.max]).toEqual([10, 60]);
    const steps = [10, 20, 30, 40, 50, 60].map((v) => scale.classOf(v));
    expect(steps).toEqual([...steps].sort((a, b) => a - b));
  });

  it('still spans light to dark with few areas', () => {
    const scale = buildScale([5, 500], 'sequential')!;
    expect(scale.colors).toEqual([SEQUENTIAL_RAMP[0], SEQUENTIAL_RAMP[5]]);
  });

  it('still separates a dominant value from the rest', () => {
    // e.g. percent urban across barangays: mostly 0, a few 100
    const scale = buildScale([0, 0, 0, 0, 0, 0, 0, 100], 'sequential')!;
    expect(scale.colorOf(0)).not.toBe(scale.colorOf(100));
  });

  it('uses a single mid step when every area has the same value', () => {
    const scale = buildScale([100, 100, 100], 'sequential')!;
    expect(scale.colors).toHaveLength(1);
    expect(scale.colorOf(100)).toBe(scale.colors[0]);
  });

  it('splits a diverging layer at zero: decline is warm, growth is blue', () => {
    const scale = buildScale([-2, -1, 0.5, 1, 2, 3], 'diverging')!;
    expect(scale.breaks).toContain(0);
    expect(DECLINE_RAMP).toContain(scale.colorOf(-2));
    expect(DECLINE_RAMP).toContain(scale.colorOf(-0.01));
    expect(SEQUENTIAL_RAMP).toContain(scale.colorOf(0));
    expect(SEQUENTIAL_RAMP).toContain(scale.colorOf(3));
    expect(scale.colors).toHaveLength(scale.breaks.length + 1);
  });

  it('draws from the ramps it is given, so a palette can restyle the map', () => {
    const ramps = { sequential: ['#eeeeee', '#cccccc', '#999999', '#666666', '#333333', '#111111'], decline: ['#aa0000', '#ffaaaa'] };
    const sequential = buildScale([10, 20, 30, 40, 50, 60], 'sequential', ramps)!;
    expect(sequential.colors).toEqual(ramps.sequential);
    const diverging = buildScale([-2, -1, 1, 2], 'diverging', ramps)!;
    expect(diverging.colorOf(-2)).toBe('#aa0000');
    expect(ramps.sequential).toContain(diverging.colorOf(2));
    expect(diverging.colors.some((c) => SEQUENTIAL_RAMP.includes(c))).toBe(false);
  });

  it('picks label colour from the fill itself', () => {
    expect(isDarkFill('#161616')).toBe(true);
    expect(isDarkFill('#dedede')).toBe(false);
    expect(isDarkFill(null)).toBe(false);
  });

  it('treats a diverging layer with no decline as sequential', () => {
    expect(buildScale([0.5, 1, 2], 'diverging')!.colors.every((c) => SEQUENTIAL_RAMP.includes(c))).toBe(true);
  });
});
