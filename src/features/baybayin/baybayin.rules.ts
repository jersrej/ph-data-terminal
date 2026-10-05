import type { BaybayinOptions } from './baybayin.types';

/**
 * Unicode "Tagalog" block, U+1700–U+171F. Code points are written as escapes
 * so the mapping is unambiguous regardless of editor fonts.
 */
export const VOWELS: Record<'a' | 'i' | 'u', string> = {
  a: '\u1700', // ᜀ
  i: '\u1701', // ᜁ  (also e)
  u: '\u1702', // ᜂ  (also o)
};

/** Each consonant letter carries an inherent "a": KA, GA, NGA ... */
export const CONSONANTS: Record<string, string> = {
  k: '\u1703', // ᜃ
  g: '\u1704', // ᜄ
  ng: '\u1705', // ᜅ
  t: '\u1706', // ᜆ
  d: '\u1707', // ᜇ
  n: '\u1708', // ᜈ
  p: '\u1709', // ᜉ
  b: '\u170A', // ᜊ
  m: '\u170B', // ᜋ
  y: '\u170C', // ᜌ
  r: '\u170D', // ᜍ  modern RA; see RA_FORMS
  l: '\u170E', // ᜎ
  w: '\u170F', // ᜏ
  s: '\u1710', // ᜐ
  h: '\u1711', // ᜑ
};

/** Kudlit: marks that replace the inherent "a". */
export const VOWEL_SIGNS: Record<'i' | 'u', string> = {
  i: '\u1712', // ◌ᜒ  i / e
  u: '\u1713', // ◌ᜓ  u / o
};

export const VIRAMA = '\u1714'; // ◌᜔  krus-kudlit
export const PAMUDPOD = '\u1715'; // ◌᜕

export const RA_FORMS: Record<BaybayinOptions['ra'], string> = {
  modern: '\u170D',
  archaic: '\u171F',
  da: '\u1707',
};

/** Baybayin has three vowels: e is written as i, o as u. */
export const VOWEL_CLASS: Record<string, 'a' | 'i' | 'u'> = { a: 'a', e: 'i', i: 'i', o: 'u', u: 'u' };

/**
 * Whole words whose spelling does not match their sound. Filipino abbreviates
 * two very common words; both are transliterated as they are pronounced.
 */
export const WORD_RESPELLINGS: Record<string, string> = {
  mga: 'manga',
  ng: 'nang',
};

/**
 * Latin letters outside the native (Abakada) inventory, respelled by their
 * usual sound in modern Filipino orthography before transliteration. Longest
 * match wins. These are approximations: a borrowed word can have several
 * defensible Baybayin spellings, and this table picks one deterministically.
 */
export const RESPELLINGS: [pattern: string, replacement: string][] = [
  ['ch', 'ts'], // "chico"  -> tsiko
  ['sh', 'sy'], // "shabu"  -> syabu
  ['ph', 'p'], //  "Philip" -> pilip
  ['th', 't'],
  ['qu', 'kw'],
  ['ce', 'se'],
  ['ci', 'si'],
  ['\u00F1', 'ny'], // ñ: "Niño" -> ninyo
  ['c', 'k'],
  ['f', 'p'],
  ['j', 'dy'], // "jeep" -> dyip
  ['q', 'k'],
  ['v', 'b'],
  ['x', 'ks'],
  ['z', 's'],
];

/** Letters the engine can place directly; everything else in a word is respelled or passed through. */
export const NATIVE_LETTERS = new Set('abdeghiklmnoprstuwy');
