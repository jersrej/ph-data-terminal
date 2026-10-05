import { describe, expect, it } from 'vitest';
import { DEFAULT_OPTIONS, placeNameInBaybayin, toBaybayin, transliterate } from './baybayin';

// Code points, so expectations do not depend on how an editor renders the script.
const A = '\u1700', I = '\u1701', U = '\u1702';
const KA = '\u1703', GA = '\u1704', NGA = '\u1705', TA = '\u1706', DA = '\u1707', NA = '\u1708';
const PA = '\u1709', BA = '\u170A', MA = '\u170B', YA = '\u170C', RA = '\u170D', LA = '\u170E';
const WA = '\u170F', SA = '\u1710', HA = '\u1711';
const i = '\u1712', u = '\u1713';
const VIRAMA = '\u1714', PAMUDPOD = '\u1715', ARCHAIC_RA = '\u171F';
const X = PAMUDPOD; // the default vowel-killer

describe('vowels', () => {
  it('writes a, i, u as independent vowels', () => {
    expect(toBaybayin('a')).toBe(A);
    expect(toBaybayin('i')).toBe(I);
    expect(toBaybayin('u')).toBe(U);
  });

  it('folds e into i and o into u', () => {
    expect(toBaybayin('e')).toBe(I);
    expect(toBaybayin('o')).toBe(U);
    expect(toBaybayin('oo')).toBe(U + U); // "oo" (yes) is two syllables
  });

  it('writes a vowel after another vowel on its own', () => {
    expect(toBaybayin('aalis')).toBe(A + A + LA + i + SA + X);
    expect(toBaybayin('paa')).toBe(PA + A);
  });
});

describe('consonants', () => {
  it('maps every native consonant to its letter with inherent a', () => {
    const expected: [string, string][] = [
      ['ka', KA], ['ga', GA], ['nga', NGA], ['ta', TA], ['da', DA], ['na', NA], ['pa', PA], ['ba', BA],
      ['ma', MA], ['ya', YA], ['ra', RA], ['la', LA], ['wa', WA], ['sa', SA], ['ha', HA],
    ];
    for (const [latin, baybayin] of expected) expect(toBaybayin(latin), latin).toBe(baybayin);
  });

  it('adds a kudlit for i/e and u/o', () => {
    expect(toBaybayin('ki')).toBe(KA + i);
    expect(toBaybayin('ke')).toBe(KA + i);
    expect(toBaybayin('ku')).toBe(KA + u);
    expect(toBaybayin('ko')).toBe(KA + u);
  });
});

describe('ng', () => {
  it('is one letter, never n + g', () => {
    expect(toBaybayin('nga')).toBe(NGA);
    expect(toBaybayin('ngiti')).toBe(NGA + i + TA + i);
    expect(toBaybayin('ang')).toBe(A + NGA + X);
    expect(toBaybayin('nga')).not.toContain(NA);
  });

  it('keeps a following g separate (tang-gap)', () => {
    expect(toBaybayin('tanggap')).toBe(TA + NGA + X + GA + PA + X);
  });

  it('writes the particles "ng" and "mga" as they are pronounced', () => {
    expect(toBaybayin('ng')).toBe(NA + NGA + X); // nang
    expect(toBaybayin('mga')).toBe(MA + NGA); // ma-nga
    expect(toBaybayin('Mga')).toBe(MA + NGA);
    expect(toBaybayin('ang mga bata')).toBe(`${A + NGA + X} ${MA + NGA} ${BA + TA}`);
  });
});

describe('final consonants', () => {
  it('never lets a vowelless consonant read as "-a": pamudpod by default', () => {
    expect(DEFAULT_OPTIONS.finalConsonant).toBe('pamudpod');
    expect(toBaybayin('anak')).toBe(A + NA + KA + PAMUDPOD);
    expect(toBaybayin('k')).toBe(KA + PAMUDPOD);
  });

  it('can use the krus-kudlit virama instead', () => {
    expect(toBaybayin('anak', { finalConsonant: 'virama' })).toBe(A + NA + KA + VIRAMA);
  });

  it('can drop them, as traditional spelling did', () => {
    expect(toBaybayin('anak', { finalConsonant: 'omit' })).toBe(A + NA);
    expect(toBaybayin('bundok', { finalConsonant: 'omit' })).toBe(BA + u + DA + u);
  });

  it('marks consonants inside clusters too', () => {
    expect(toBaybayin('bundok')).toBe(BA + u + NA + X + DA + u + KA + X);
    expect(toBaybayin('araw')).toBe(A + RA + WA + X);
  });
});

describe('ra', () => {
  it('uses modern RA by default, with archaic RA and DA as options', () => {
    expect(toBaybayin('ra')).toBe(RA);
    expect(toBaybayin('ra', { ra: 'archaic' })).toBe(ARCHAIC_RA);
    expect(toBaybayin('ra', { ra: 'da' })).toBe(DA);
  });
});

describe('formatting', () => {
  it('preserves spaces, punctuation and line breaks', () => {
    expect(toBaybayin('Mabuhay, Pilipinas!\n')).toBe(`${MA + BA + u + HA + YA + X}, ${PA + i + LA + i + PA + i + NA + SA + X}!\n`);
    expect(toBaybayin('a  -  b?')).toBe(`${A}  -  ${BA + X}?`);
  });

  it('preserves numbers', () => {
    expect(toBaybayin('2024 na')).toBe(`2024 ${NA}`);
    expect(toBaybayin('Barangay 12')).toBe(`${BA + RA + NGA + YA + X} 12`);
  });

  it('handles multi-line input line by line', () => {
    expect(toBaybayin('isa\ndalawa\r\ntatlo')).toBe(`${I + SA}\n${DA + LA + WA}\r\n${TA + TA + X + LA + u}`);
  });

  it('ignores case', () => {
    expect(toBaybayin('MABUHAY')).toBe(toBaybayin('mabuhay'));
    expect(toBaybayin('PiLiPiNaS')).toBe(toBaybayin('pilipinas'));
  });

  it('returns empty output for empty input', () => {
    expect(transliterate('')).toEqual({ text: '', respelled: [] });
    expect(toBaybayin('   ')).toBe('   ');
  });

  it('ignores accents but keeps \u00F1 as its own sound', () => {
    expect(toBaybayin('Bi\u00F1an')).toBe(BA + i + NA + X + YA + NA + X);
    expect(toBaybayin('b\u00E1t\u00E0')).toBe(BA + TA);
  });
});

describe('Filipino phrases', () => {
  it.each([
    ['Mabuhay', MA + BA + u + HA + YA + X],
    ['Pilipinas', PA + i + LA + i + PA + i + NA + SA + X],
    ['Magandang araw', `${MA + GA + NA + X + DA + NGA + X} ${A + RA + WA + X}`],
    ['Kumusta ka?', `${KA + u + MA + u + SA + X + TA} ${KA}?`],
    ['Mahal ko ang Pilipinas', `${MA + HA + LA + X} ${KA + u} ${A + NGA + X} ${PA + i + LA + i + PA + i + NA + SA + X}`],
    ['Salamat', SA + LA + MA + TA + X],
    ['Laguna', LA + GA + u + NA],
  ])('%s', (latin, expected) => {
    expect(toBaybayin(latin)).toBe(expected);
  });

  it('is deterministic', () => {
    expect(toBaybayin('Mahal ko ang Pilipinas')).toBe(toBaybayin('Mahal ko ang Pilipinas'));
  });
});

describe('non-native spelling', () => {
  it('respells foreign letters by sound and reports them', () => {
    const result = transliterate('Cavite');
    expect(result.text).toBe(KA + BA + i + TA + i); // ka-bi-te
    expect(result.respelled).toEqual(['c', 'v']);
  });

  it('picks the sound of c from the vowel after it', () => {
    expect(toBaybayin('cebu')).toBe(SA + i + BA + u);
    expect(toBaybayin('coco')).toBe(KA + u + KA + u);
  });

  it('handles digraphs before single letters', () => {
    expect(toBaybayin('chico')).toBe(TA + X + SA + i + KA + u); // tsiko
    expect(toBaybayin('jeep')).toBe(DA + X + YA + i + I + PA + X); // dy-e-ep
    expect(transliterate('quezon').respelled).toEqual(['qu', 'z']);
  });

  it('reports nothing for native spelling', () => {
    expect(transliterate('Magandang araw, Pilipinas!').respelled).toEqual([]);
  });

  it('passes through letters from other scripts', () => {
    expect(toBaybayin('\u65E5\u672C ka')).toBe(`\u65E5\u672C ${KA}`);
  });
});

describe('placeNameInBaybayin', () => {
  it('transliterates names in native spelling', () => {
    expect(placeNameInBaybayin('Laguna')).toBe(LA + GA + u + NA);
    // Follows the spelling (ba-ta-nga-s). Spoken, it is ba-tang-gas: one reason results are labelled approximate.
    expect(placeNameInBaybayin('Batangas')).toBe(BA + TA + NGA + SA + X);
    expect(placeNameInBaybayin('Bagong Silang')).toBe(`${BA + GA + u + NGA + X} ${SA + i + LA + NGA + X}`);
  });

  it('drops the "City of" wrapper before judging the name', () => {
    expect(placeNameInBaybayin('City of Pasig')).toBe(PA + SA + i + GA + X);
    expect(placeNameInBaybayin('Pasay City')).toBe(PA + SA + YA + X);
  });

  it('declines names it would have to guess at', () => {
    for (const name of ['Cavite', 'Quezon', 'Rizal', 'Philippines', 'Greenhills', 'Barangay 12', 'CALABARZON', 'Zone 4', '']) {
      expect(placeNameInBaybayin(name), name).toBeNull();
    }
  });
});
