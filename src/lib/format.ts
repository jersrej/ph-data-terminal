const integer = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat('en-PH', { notation: 'compact', maximumSignificantDigits: 3 });

export const formatInteger = (value: number) => integer.format(value);

/** 3,687,345 -> "3.69M"; small numbers stay exact. */
export const formatCompact = (value: number) => (Math.abs(value) < 10_000 ? integer.format(value) : compact.format(value));

export const formatDecimal = (value: number, digits = 1) =>
  new Intl.NumberFormat('en-PH', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);

export const formatPercent = (value: number, digits = 1) => `${formatDecimal(value, digits)}%`;

/** Signed percent with a true minus sign, for growth rates. */
export const formatSignedPercent = (value: number, digits = 2) =>
  `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatDecimal(Math.abs(value), digits)}%`;

export const formatArea = (km2: number) => `${formatDecimal(km2, km2 < 10 ? 2 : km2 < 100 ? 1 : 0)} km²`;

export const UNAVAILABLE = 'Data unavailable';

/** "the Philippines", but "CALABARZON" and "Laguna" as they are. */
export const inProse = (name: string) => (name === 'Philippines' ? 'the Philippines' : name);
