import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { parseUrlState, serializeUrlState, toggleCompare, useUrlState } from './geography.store';
import { CAVITE, LAGUNA, LUCENA, PH } from '@/test/fixtures';

describe('URL state', () => {
  it('uses the country, population and latest year by default', () => {
    expect(parseUrlState('')).toEqual({ geo: PH, layer: 'population', year: null, compare: [] });
    expect(serializeUrlState(parseUrlState(''))).toBe('');
  });

  it('round-trips a full state', () => {
    const state = { geo: LAGUNA, layer: 'density', year: 2020, compare: [LAGUNA, CAVITE] };
    const query = serializeUrlState(state);
    expect(query).toBe(`?geo=${LAGUNA}&layer=density&year=2020&cmp=${LAGUNA},${CAVITE}`);
    expect(parseUrlState(query)).toEqual(state);
  });

  it('drops malformed comparison codes, duplicates and extras', () => {
    expect(parseUrlState(`?cmp=${LAGUNA},abc,${LAGUNA},${CAVITE},${LUCENA}`).compare).toEqual([LAGUNA, CAVITE]);
    expect(parseUrlState('?year=soon').year).toBeNull();
  });

  it('keeps an unrecognised geo so the app can report it', () => {
    expect(parseUrlState('?geo=nowhere').geo).toBe('nowhere');
  });
});

describe('comparison selection', () => {
  it('adds, removes, and replaces the older pick when full', () => {
    expect(toggleCompare([], LAGUNA)).toEqual([LAGUNA]);
    expect(toggleCompare([LAGUNA], CAVITE)).toEqual([LAGUNA, CAVITE]);
    expect(toggleCompare([LAGUNA, CAVITE], LAGUNA)).toEqual([CAVITE]);
    expect(toggleCompare([LAGUNA, CAVITE], LUCENA)).toEqual([CAVITE, LUCENA]);
  });
});

describe('useUrlState', () => {
  it('pushes history for a new place and follows the Back button', () => {
    const { result } = renderHook(() => useUrlState());
    const before = window.history.length;

    act(() => result.current[1]({ geo: LAGUNA }));
    expect(window.location.search).toBe(`?geo=${LAGUNA}`);
    expect(result.current[0].geo).toBe(LAGUNA);
    expect(window.history.length).toBe(before + 1);

    act(() => {
      window.history.replaceState(null, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(result.current[0].geo).toBe(PH);
  });

  it('replaces history when only the presentation changes', () => {
    const { result } = renderHook(() => useUrlState());
    const before = window.history.length;
    act(() => result.current[1]({ layer: 'density' }));
    expect(result.current[0].layer).toBe('density');
    expect(window.history.length).toBe(before);
  });
});
