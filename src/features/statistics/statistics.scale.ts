import { isDarkColor } from '../theme/contrast';

/**
 * Choropleth classing. Values are grouped into quantile classes so skewed
 * distributions (one megacity among rural towns) still use the whole ramp, and
 * each class maps to one step of a single-hue ramp: more is darker.
 */
export interface ColorScale {
  /** Upper-exclusive class boundaries; classes = breaks.length + 1. */
  breaks: number[];
  colors: string[];
  min: number;
  max: number;
  classOf: (value: number) => number;
  colorOf: (value: number | null) => string | null;
}

/** The colours a scale draws from; supplied by the active palette. */
export interface ScaleRamps {
  /** One hue, light to dark. */
  sequential: readonly string[];
  /** Decline, strongest first. Paired with the sequential ramp around a zero midpoint. */
  decline: readonly string[];
}

/** One hue, light to dark. */
export const SEQUENTIAL_RAMP = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#1c5cab', '#0d366b'];
/** Decline, strongest first. Paired with the blue ramp around a zero midpoint. */
export const DECLINE_RAMP = ['#b4532a', '#eab69c'];
export const DEFAULT_RAMPS: ScaleRamps = { sequential: SEQUENTIAL_RAMP, decline: DECLINE_RAMP };

export function quantileBreaks(values: number[], classes: number): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const breaks: number[] = [];
  for (let i = 1; i < classes; i++) {
    const at = sorted[Math.floor((i * sorted.length) / classes)]!;
    // A break at the minimum would leave an empty first class.
    if (at > sorted[0]! && at !== breaks.at(-1)) breaks.push(at);
  }
  return breaks;
}

/** Spread `count` classes across the ramp so few classes still span light to dark. */
function pickColors(ramp: readonly string[], count: number): string[] {
  if (count === 1) return [ramp[Math.floor(ramp.length / 2)]!];
  return Array.from({ length: count }, (_, i) => ramp[Math.round((i * (ramp.length - 1)) / (count - 1))]!);
}

/**
 * Quantile breaks for up to `max` classes. When one value dominates (most
 * barangays are 0% urban, a few are 100%), plain quantiles all land on that
 * value and every area would share a colour, so fall back to classing the
 * distinct values instead.
 */
function classBreaks(values: number[], max: number): number[] {
  const distinct = [...new Set(values)];
  const classes = Math.min(max, distinct.length);
  const breaks = quantileBreaks(values, classes);
  return breaks.length === 0 && classes > 1 ? quantileBreaks(distinct, classes) : breaks;
}

export function buildScale(input: (number | null)[], kind: 'sequential' | 'diverging', ramps: ScaleRamps = DEFAULT_RAMPS): ColorScale | null {
  const values = input.filter((v): v is number => v !== null && Number.isFinite(v));
  if (!values.length) return null;

  let breaks: number[];
  let colors: string[];
  const negatives = values.filter((v) => v < 0);

  if (kind === 'diverging' && negatives.length) {
    const positives = values.filter((v) => v >= 0);
    const negBreaks = classBreaks(negatives, ramps.decline.length);
    const posBreaks = positives.length ? classBreaks(positives, 4) : [];
    breaks = positives.length ? [...negBreaks, 0, ...posBreaks] : negBreaks;
    colors = [
      ...(negBreaks.length ? ramps.decline : [ramps.decline.at(-1)!]),
      ...(positives.length ? pickColors(ramps.sequential.slice(0, -1), posBreaks.length + 1) : []),
    ];
  } else {
    breaks = classBreaks(values, ramps.sequential.length);
    colors = pickColors(ramps.sequential, breaks.length + 1);
  }

  const classOf = (value: number) => {
    let i = 0;
    while (i < breaks.length && value >= breaks[i]!) i++;
    return i;
  };
  return {
    breaks,
    colors,
    min: Math.min(...values),
    max: Math.max(...values),
    classOf,
    colorOf: (value) => (value === null || !Number.isFinite(value) ? null : colors[classOf(value)]!),
  };
}

/** Dark fills need light labels. Judged by luminance, so it holds for every palette. */
export function isDarkFill(color: string | null): boolean {
  return color !== null && isDarkColor(color);
}
