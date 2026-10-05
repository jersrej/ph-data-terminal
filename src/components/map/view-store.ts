import { useSyncExternalStore } from 'react';
import type { ViewTransform } from '@/features/geography/geography.shapes';

/**
 * The live zoom transform. It changes every animation frame, so it lives outside
 * React state: the map group is updated imperatively and only the few components
 * that must follow the view (the graticule) subscribe here.
 */
export function createViewStore() {
  let view: ViewTransform = { k: 1, x: 0, y: 0 };
  const listeners = new Set<() => void>();
  return {
    get: () => view,
    set(next: ViewTransform) {
      view = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type ViewStore = ReturnType<typeof createViewStore>;

export function useView(store: ViewStore): ViewTransform {
  return useSyncExternalStore(store.subscribe, store.get);
}
