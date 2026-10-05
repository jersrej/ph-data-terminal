/**
 * Curated palettes. Each one is a complete, checked set: interface colours, a
 * six-step sequential ramp for the choropleth (one hue, light to dark), a
 * contrasting pair for decline on diverging layers, and a selection colour
 * chosen to sit outside the ramp's hue. There is deliberately no free colour
 * picker: palettes.test.ts holds every palette to the same contrast floor.
 */
export interface Palette {
  id: string;
  label: string;
  description: string;
  ui: {
    /** Text, borders of controls, solid buttons. */
    ink: string;
    ink2: string;
    ink3: string;
    /** Panels and controls. */
    surface: string;
    /** The map sheet behind the land. */
    sea: string;
    /** Land outside the level being explored. */
    land: string;
    landOpen: string;
    border: string;
    borderSoft: string;
    /** Areas with no published value. Never a step of the data ramp. */
    noData: string;
    /** The selected area's outline and other "this one" highlights. */
    selection: string;
  };
  /** Low to high. */
  dataScale: [string, string, string, string, string, string];
  /** Population decline, strongest first; shown against dataScale around zero. */
  declineScale: [string, string];
}

export const PALETTES = [
  {
    id: 'philippine-blue',
    label: 'Philippine Blue',
    description: 'Cartographic blue',
    ui: {
      ink: '#0c1e33', ink2: '#44566b', ink3: '#5d6b79', surface: '#fbfbf9', sea: '#edf0f2', land: '#d3d8dc', landOpen: '#e2e6e9',
      border: '#c3cbd3', borderSoft: '#e1e5e9', noData: '#ddd3bd', selection: '#f2b01e',
    },
    dataScale: ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#1c5cab', '#0d366b'],
    declineScale: ['#b4532a', '#eab69c'],
  },
  {
    id: 'topographic-green',
    label: 'Topographic Green',
    description: 'Lowland to forest',
    ui: {
      ink: '#14261c', ink2: '#465a4d', ink3: '#5c6b60', surface: '#fafbf8', sea: '#edf1ec', land: '#d1d6cf', landOpen: '#e2e6e0',
      border: '#c1cabd', borderSoft: '#e0e6dd', noData: '#e3cfae', selection: '#f5a623',
    },
    dataScale: ['#d9eccf', '#b3d9a2', '#86c078', '#4f9e55', '#2a7641', '#124a2b'],
    declineScale: ['#7b4a9e', '#d3bfe3'],
  },
  {
    id: 'sunset',
    label: 'Sunset',
    description: 'Amber to deep red',
    ui: {
      ink: '#2a1a14', ink2: '#5e4a40', ink3: '#705d54', surface: '#fcfaf7', sea: '#f2eeea', land: '#e3dcd5', landOpen: '#ece6e0',
      border: '#d4cac1', borderSoft: '#e8e1da', noData: '#c9d2da', selection: '#35b6d6',
    },
    dataScale: ['#fde6b8', '#fbc877', '#f5a04a', '#e6702e', '#c2401f', '#7f1d1d'],
    declineScale: ['#2f6690', '#b5d0e2'],
  },
  {
    id: 'monochrome',
    label: 'Monochrome',
    description: 'Printed statistical atlas',
    ui: {
      ink: '#111111', ink2: '#4a4a4a', ink3: '#666666', surface: '#fbfbfb', sea: '#ededec', land: '#fdfdfd', landOpen: '#ffffff',
      border: '#c6c6c6', borderSoft: '#e2e2e2', noData: '#eadfbe', selection: '#e5382a',
    },
    dataScale: ['#dedede', '#bdbdbd', '#969696', '#6b6b6b', '#404040', '#161616'],
    declineScale: ['#b3261e', '#e8b4ae'],
  },
  {
    id: 'archive',
    label: 'Archive',
    description: 'Sepia on aged paper',
    ui: {
      ink: '#2b2118', ink2: '#5c4d3f', ink3: '#6e5f50', surface: '#f9f5ec', sea: '#e8e0cc', land: '#f6f1e6', landOpen: '#faf6ee',
      border: '#d3c8b3', borderSoft: '#e6dece', noData: '#c8d2d2', selection: '#3cc0b4',
    },
    dataScale: ['#e6d6b4', '#d6bd8c', '#bf9a63', '#9c7444', '#70502c', '#432c16'],
    declineScale: ['#3d5a80', '#b8c7d9'],
  },
] as const satisfies readonly Palette[];

export type PaletteId = (typeof PALETTES)[number]['id'];

export const DEFAULT_PALETTE_ID: PaletteId = 'philippine-blue';

export function isPaletteId(value: unknown): value is PaletteId {
  return PALETTES.some((p) => p.id === value);
}

/** The palette for an id, or the default for anything unrecognised. */
export function getPalette(id: unknown): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}

/** The CSS custom properties a palette controls. Every themed rule reads these. */
export function paletteVariables(palette: Palette): Record<string, string> {
  const { ui, dataScale } = palette;
  return {
    '--color-ink': ui.ink,
    '--color-ink-2': ui.ink2,
    '--color-ink-3': ui.ink3,
    '--color-panel': ui.surface,
    '--color-sea': ui.sea,
    '--color-land': ui.land,
    '--color-land-open': ui.landOpen,
    '--color-rule': ui.border,
    '--color-rule-soft': ui.borderSoft,
    '--color-nodata': ui.noData,
    '--color-sun': ui.selection,
    '--color-data': dataScale[4],
    '--color-data-soft': dataScale[1],
  };
}

export function applyPalette(palette: Palette, root: HTMLElement = document.documentElement): void {
  for (const [name, value] of Object.entries(paletteVariables(palette))) root.style.setProperty(name, value);
  root.dataset.palette = palette.id;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', palette.ui.ink);
}
