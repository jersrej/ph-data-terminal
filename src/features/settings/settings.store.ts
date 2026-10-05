import { useSyncExternalStore } from 'react';
import { readStored, writeStored } from '@/lib/storage';
import { DEFAULT_PALETTE_ID, applyPalette, getPalette, isPaletteId, type PaletteId } from '../theme/palettes';

export const PALETTE_KEY = 'ph-data-terminal-palette';
export const SETTINGS_KEY = 'ph-data-terminal-settings';

export interface Settings {
  palette: PaletteId;
  /** Fly between places. Off, the map cuts straight to the new view. */
  mapAnimation: boolean;
  /** Names and values drawn on the map. */
  mapLabels: boolean;
  /** Show a Baybayin form of the selected area's name where one can be derived. */
  baybayinNames: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  palette: DEFAULT_PALETTE_ID,
  mapAnimation: true,
  mapLabels: true,
  baybayinNames: true,
};

/** Read saved preferences, ignoring anything missing, malformed or out of date. */
export function readSettings(): Settings {
  const settings = { ...DEFAULT_SETTINGS };
  const palette = readStored(PALETTE_KEY);
  if (isPaletteId(palette)) settings.palette = palette;
  try {
    const saved: unknown = JSON.parse(readStored(SETTINGS_KEY) ?? 'null');
    if (saved && typeof saved === 'object') {
      for (const key of ['mapAnimation', 'mapLabels', 'baybayinNames'] as const) {
        const value = (saved as Record<string, unknown>)[key];
        if (typeof value === 'boolean') settings[key] = value;
      }
    }
  } catch {
    // Unparseable preferences are treated as absent.
  }
  return settings;
}

let current: Settings = DEFAULT_SETTINGS;
const listeners = new Set<() => void>();

/** Load preferences from storage and apply the palette. Called once before first paint. */
export function loadSettings(): Settings {
  current = readSettings();
  applyPalette(getPalette(current.palette));
  for (const listener of listeners) listener();
  return current;
}

export function updateSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch };
  if (patch.palette) {
    applyPalette(getPalette(current.palette));
    writeStored(PALETTE_KEY, current.palette);
  }
  const { mapAnimation, mapLabels, baybayinNames } = current;
  writeStored(SETTINGS_KEY, JSON.stringify({ mapAnimation, mapLabels, baybayinNames }));
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, () => current);
}
