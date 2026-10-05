import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { colorDistance, contrast, luminance } from './contrast';
import { DEFAULT_PALETTE_ID, PALETTES, applyPalette, getPalette, paletteVariables } from './palettes';
import { DEFAULT_SETTINGS, PALETTE_KEY, SETTINGS_KEY, loadSettings, readSettings, updateSettings } from '../settings/settings.store';

beforeEach(() => {
  window.localStorage.clear();
  loadSettings();
});
afterEach(() => vi.restoreAllMocks());

describe('palette catalogue', () => {
  it('offers at least four curated palettes with unique ids, blue first', () => {
    expect(PALETTES.length).toBeGreaterThanOrEqual(4);
    expect(new Set(PALETTES.map((p) => p.id)).size).toBe(PALETTES.length);
    expect(PALETTES[0].id).toBe(DEFAULT_PALETTE_ID);
    expect(DEFAULT_PALETTE_ID).toBe('philippine-blue');
  });

  it('resolves every palette, and anything unknown to the default', () => {
    for (const palette of PALETTES) expect(getPalette(palette.id)).toBe(palette);
    expect(getPalette('neon').id).toBe(DEFAULT_PALETTE_ID);
    expect(getPalette(null).id).toBe(DEFAULT_PALETTE_ID);
  });

  it('gives every palette its own data ramp and a full set of CSS variables', () => {
    expect(new Set(PALETTES.map((p) => p.dataScale.join())).size).toBe(PALETTES.length);
    const names = Object.keys(paletteVariables(PALETTES[0]));
    for (const palette of PALETTES) {
      const vars = paletteVariables(palette);
      expect(Object.keys(vars)).toEqual(names);
      for (const value of Object.values(vars)) expect(value).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe.each(PALETTES.map((p) => [p.label, p] as const))('%s accessibility', (_label, palette) => {
  const { ui, dataScale, declineScale } = palette;

  it('keeps text readable on panels and on the map sheet', () => {
    expect(contrast(ui.ink, ui.surface)).toBeGreaterThanOrEqual(7);
    expect(contrast(ui.ink2, ui.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(ui.ink3, ui.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(ui.ink3, ui.sea)).toBeGreaterThanOrEqual(4);
    // Solid buttons and the current breadcrumb: surface-coloured text on ink.
    expect(contrast(ui.surface, ui.ink)).toBeGreaterThanOrEqual(7);
  });

  it('runs the choropleth strictly from light to dark in separable steps', () => {
    for (let i = 1; i < dataScale.length; i++) {
      expect(luminance(dataScale[i]!)).toBeLessThan(luminance(dataScale[i - 1]!));
      expect(contrast(dataScale[i]!, dataScale[i - 1]!), `steps ${i - 1}-${i}`).toBeGreaterThanOrEqual(1.25);
    }
    expect(contrast(dataScale[0], dataScale[5])).toBeGreaterThanOrEqual(7);
  });

  it('keeps the map sheet, context land, the lowest class and "no data" apart', () => {
    // Neighbouring pale fills differ in hue as much as lightness, so this is a perceptual distance.
    const pairs: [string, string, string][] = [
      ['lowest class / context land', dataScale[0], ui.land],
      ['lowest class / no data', dataScale[0], ui.noData],
      ['no data / context land', ui.noData, ui.land],
      ['context land / map sheet', ui.land, ui.sea],
    ];
    for (const [what, a, b] of pairs) expect(colorDistance(a, b), what).toBeGreaterThanOrEqual(4);
    expect(dataScale as readonly string[]).not.toContain(ui.noData);
  });

  it('keeps focus and selection visible on every fill', () => {
    // The selection line sits on an ink casing, so it must stand out from ink ...
    expect(contrast(ui.selection, ui.ink)).toBeGreaterThanOrEqual(4);
    // ... and the casing itself must stand out from the map sheet and the lightest fill.
    expect(contrast(ui.ink, ui.sea)).toBeGreaterThanOrEqual(7);
    expect(contrast(ui.ink, dataScale[0])).toBeGreaterThanOrEqual(7);
    expect(dataScale as readonly string[]).not.toContain(ui.selection);
  });

  it('gives decline two steps that read as stronger and milder', () => {
    expect(luminance(declineScale[0])).toBeLessThan(luminance(declineScale[1]));
    expect(dataScale as readonly string[]).not.toContain(declineScale[0]);
  });
});

describe('applying a palette', () => {
  it('writes the palette to CSS variables on the root element', () => {
    applyPalette(getPalette('sunset'));
    const root = document.documentElement;
    expect(root.dataset.palette).toBe('sunset');
    expect(root.style.getPropertyValue('--color-data')).toBe(getPalette('sunset').dataScale[4]);
    expect(root.style.getPropertyValue('--color-sun')).toBe(getPalette('sunset').ui.selection);
  });
});

describe('palette persistence', () => {
  it('starts on Philippine Blue for a first visit', () => {
    expect(readSettings()).toEqual(DEFAULT_SETTINGS);
    expect(document.documentElement.dataset.palette).toBe('philippine-blue');
  });

  it('saves the chosen palette and restores it on the next visit', () => {
    updateSettings({ palette: 'monochrome' });
    expect(window.localStorage.getItem(PALETTE_KEY)).toBe('monochrome');
    expect(document.documentElement.dataset.palette).toBe('monochrome');

    document.documentElement.dataset.palette = '';
    expect(loadSettings().palette).toBe('monochrome'); // a fresh page load
    expect(document.documentElement.dataset.palette).toBe('monochrome');
  });

  it('ignores an invalid stored palette and malformed settings', () => {
    window.localStorage.setItem(PALETTE_KEY, 'hot-pink');
    window.localStorage.setItem(SETTINGS_KEY, '{"mapLabels":"maybe","mapAnimation":false');
    expect(readSettings()).toEqual(DEFAULT_SETTINGS);
    window.localStorage.setItem(SETTINGS_KEY, '{"mapLabels":"maybe","mapAnimation":false}');
    expect(readSettings()).toEqual({ ...DEFAULT_SETTINGS, mapAnimation: false });
  });

  it('falls back to the default, and still switches, when localStorage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('denied', 'SecurityError'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    expect(loadSettings().palette).toBe('philippine-blue');
    expect(() => updateSettings({ palette: 'archive' })).not.toThrow();
    expect(document.documentElement.dataset.palette).toBe('archive'); // applies for this session
  });
});
