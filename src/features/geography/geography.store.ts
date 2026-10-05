import { useCallback, useSyncExternalStore } from 'react';
import { COUNTRY_CODE, type Psgc } from './geography.types';
import { isPsgc } from './geography.hierarchy';

/**
 * Everything shareable lives in the query string, so a copied URL reproduces the
 * view and the browser's Back button steps through the drill-down. Query strings
 * need no server rewrites, which keeps this safe on GitHub Pages.
 */
export interface UrlState {
  geo: Psgc;
  layer: string;
  /** null = the layer's most recent year. */
  year: number | null;
  compare: Psgc[];
}

export const DEFAULT_LAYER = 'population';
export const MAX_COMPARE = 2;

export function parseUrlState(search: string): UrlState {
  const params = new URLSearchParams(search);
  const geo = params.get('geo') ?? '';
  const year = Number(params.get('year'));
  const compare = (params.get('cmp') ?? '').split(',').filter(isPsgc);
  return {
    // An unrecognised but well-formed code is kept so the app can report it.
    geo: geo === '' ? COUNTRY_CODE : geo,
    layer: params.get('layer') || DEFAULT_LAYER,
    year: Number.isInteger(year) && year > 0 ? year : null,
    compare: [...new Set(compare)].slice(0, MAX_COMPARE),
  };
}

/** Defaults are omitted, so the country view is the bare URL. */
export function serializeUrlState(state: UrlState): string {
  const params = new URLSearchParams();
  if (state.geo !== COUNTRY_CODE) params.set('geo', state.geo);
  if (state.layer !== DEFAULT_LAYER) params.set('layer', state.layer);
  if (state.year !== null) params.set('year', String(state.year));
  if (state.compare.length) params.set('cmp', state.compare.join(','));
  const query = params.toString().replace(/%2C/g, ',');
  return query ? `?${query}` : '';
}

/** Add or remove an area from the comparison; a third pick replaces the older of two. */
export function toggleCompare(compare: Psgc[], code: Psgc): Psgc[] {
  if (compare.includes(code)) return compare.filter((c) => c !== code);
  return [...compare, code].slice(-MAX_COMPARE);
}

const NAVIGATE_EVENT = 'phdt:navigate';

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange);
  window.addEventListener(NAVIGATE_EVENT, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(NAVIGATE_EVENT, onChange);
  };
}

const getSearch = () => window.location.search;

let cachedSearch: string | null = null;
let cachedState: UrlState = parseUrlState('');

function readState(search: string): UrlState {
  if (search !== cachedSearch) {
    cachedSearch = search;
    cachedState = parseUrlState(search);
  }
  return cachedState;
}

export type Navigate = (patch: Partial<UrlState>, options?: { replace?: boolean }) => void;

export function useUrlState(): [UrlState, Navigate] {
  const search = useSyncExternalStore(subscribe, getSearch);
  const state = readState(search);

  const navigate = useCallback<Navigate>((patch, options) => {
    const next = serializeUrlState({ ...readState(window.location.search), ...patch });
    if (next === window.location.search) return;
    const url = `${window.location.pathname}${next}${window.location.hash}`;
    // Moving between places is history; changing how they are shown is not.
    if (options?.replace ?? !('geo' in patch)) window.history.replaceState(null, '', url);
    else window.history.pushState(null, '', url);
    window.dispatchEvent(new Event(NAVIGATE_EVENT));
  }, []);

  return [state, navigate];
}
