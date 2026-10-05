/**
 * How to write a consonant that has no vowel after it (the "k" in "anak").
 * Baybayin letters carry an inherent "a", so this needs an explicit convention.
 */
export type FinalConsonantStyle =
  /** U+1715 pamudpod: the modern vowel-killer, borrowed from Hanunoo practice. */
  | 'pamudpod'
  /** U+1714 virama (krus-kudlit): the cross introduced in the 1600s; the most widely supported in fonts. */
  | 'virama'
  /** Traditional pre-colonial spelling: the consonant is simply not written. */
  | 'omit';

export type RaStyle =
  /** U+170D, the modern letter RA. */
  | 'modern'
  /** U+171F, the archaic RA attested in Zambales. */
  | 'archaic'
  /** Traditional spelling: R is written with DA, which historically covered both sounds. */
  | 'da';

export interface BaybayinOptions {
  finalConsonant: FinalConsonantStyle;
  ra: RaStyle;
}

export interface BaybayinResult {
  /** The transliteration, with spaces, digits, punctuation and line breaks preserved. */
  text: string;
  /**
   * Latin letters that have no Baybayin equivalent and were respelled by sound
   * (e.g. "c", "f", "v"). Non-empty means the input was not native Filipino spelling.
   */
  respelled: string[];
}
