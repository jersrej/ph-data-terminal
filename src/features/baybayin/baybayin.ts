import { CONSONANTS, NATIVE_LETTERS, PAMUDPOD, RA_FORMS, RESPELLINGS, VIRAMA, VOWELS, VOWEL_CLASS, VOWEL_SIGNS, WORD_RESPELLINGS } from './baybayin.rules';
import type { BaybayinOptions, BaybayinResult } from './baybayin.types';

/**
 * Latin -> Baybayin transliteration. This converts sounds, not meaning: it is a
 * modern phonetic respelling, not a translation and not a historical spelling.
 *
 * Conventions (all deterministic, the two marked * are configurable):
 *   - a / e,i / o,u map to the three Baybayin vowels.
 *   - A consonant followed by a vowel is one letter, with a kudlit for i/e or u/o.
 *   - "ng" is always the single letter NGA, never N + G.
 *   - * A consonant with no vowel after it takes a vowel-killer: pamudpod by
 *       default, krus-kudlit virama, or (traditional) is left unwritten.
 *   - * R uses the modern letter RA by default.
 *   - "mga" and "ng" are written as pronounced (manga, nang).
 *   - Letters outside the native inventory (c, f, j, q, v, x, z, ñ) are respelled
 *     by sound first and reported, so callers can flag the result as approximate.
 *   - Everything that is not a letter (spaces, digits, punctuation, line breaks)
 *     passes through untouched.
 */
export const DEFAULT_OPTIONS: BaybayinOptions = { finalConsonant: 'pamudpod', ra: 'modern' };

const WORD = /[\p{L}\p{M}]+/gu;
const COMBINING_MARKS = /[\u0300-\u036F]/g;
const ENYE = '\u00F1';
// A private-use character that survives decomposition, standing in for n-tilde while accents are stripped.
const ENYE_PLACEHOLDER = '\uE000';

/** Lower-case and strip accents, keeping n-tilde distinct because it is its own sound. */
function fold(word: string): string {
  return word
    .toLowerCase()
    .replaceAll(ENYE, ENYE_PLACEHOLDER)
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replaceAll(ENYE_PLACEHOLDER, ENYE);
}

/** Rewrite non-native letters by sound, recording which ones were touched. */
function respell(word: string, respelled: Set<string>): string {
  let out = '';
  for (let i = 0; i < word.length; ) {
    const rule = RESPELLINGS.find(([pattern]) => word.startsWith(pattern, i));
    if (rule) {
      out += rule[1];
      respelled.add(rule[0]);
      i += rule[0].length;
    } else {
      out += word[i];
      i += 1;
    }
  }
  return out;
}

function transliterateWord(original: string, options: BaybayinOptions, respelled: Set<string>): string {
  const folded = fold(original);
  const word = respell(WORD_RESPELLINGS[folded] ?? folded, respelled);
  const consonant = (key: string) => (key === 'r' ? RA_FORMS[options.ra] : CONSONANTS[key]!);
  const killer = options.finalConsonant === 'pamudpod' ? PAMUDPOD : VIRAMA;

  let out = '';
  for (let i = 0; i < word.length; ) {
    const char = word[i]!;
    const vowel = VOWEL_CLASS[char];
    if (vowel) {
      // A vowel with no consonant before it stands alone.
      out += VOWELS[vowel];
      i += 1;
      continue;
    }
    const key = word.startsWith('ng', i) ? 'ng' : char;
    if (!(key in CONSONANTS)) {
      // A letter from another script: leave it as written rather than guess.
      out += char;
      i += 1;
      continue;
    }
    i += key.length;
    const next = VOWEL_CLASS[word[i] ?? ''];
    if (next) {
      out += consonant(key) + (next === 'a' ? '' : VOWEL_SIGNS[next]);
      i += 1;
    } else if (options.finalConsonant !== 'omit') {
      out += consonant(key) + killer;
    }
  }
  return out;
}

export function transliterate(input: string, options: Partial<BaybayinOptions> = {}): BaybayinResult {
  const resolved = { ...DEFAULT_OPTIONS, ...options };
  const respelled = new Set<string>();
  const text = input.replace(WORD, (word) => transliterateWord(word, resolved, respelled));
  return { text, respelled: [...respelled] };
}

export const toBaybayin = (input: string, options?: Partial<BaybayinOptions>) => transliterate(input, options).text;

const NAME_AFFIX = /^city of\s+|\s+city$/i;
const CONSONANT = '(?:ng|[bdghklmnprstwy])';
const INITIAL_CLUSTER = new RegExp(`^${CONSONANT}${CONSONANT}`);
const TRIPLE_CLUSTER = new RegExp(`${CONSONANT}{3}`);
const DOUBLED = /([bdghklmprstwy])\1|nn/;

/**
 * A Baybayin form of a place name, or null when the result would be a guess.
 * Only names spelled entirely with native letters and Filipino-like syllables
 * qualify, so "Laguna" and "Batangas" get one while "Cavite" (c, v), "Quezon"
 * and English names like "Greenhills" do not.
 */
export function placeNameInBaybayin(name: string, options?: Partial<BaybayinOptions>): string | null {
  const bare = name.replace(NAME_AFFIX, '').trim();
  const words = bare.split(/[\s-]+/).filter(Boolean);
  if (!words.length) return null;
  for (const raw of words) {
    const word = fold(raw);
    if (word.length < 2 || [...word].some((ch) => !NATIVE_LETTERS.has(ch))) return null;
    if (!/[aeiou]/.test(word) || INITIAL_CLUSTER.test(word) || TRIPLE_CLUSTER.test(word) || DOUBLED.test(word)) return null;
  }
  return toBaybayin(bare, options);
}
