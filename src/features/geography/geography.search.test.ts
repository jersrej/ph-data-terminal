import { describe, expect, it } from 'vitest';
import { buildBarangayEntries, buildCoreEntries, normalize, search } from './geography.search';
import { CALAMBA, CANLUBANG, CEBU_CITY, LAGUNA, NCR, PASIG, fixtureIndex } from '@/test/fixtures';

const index = fixtureIndex();
const entries = [
  ...buildCoreEntries(index),
  ...buildBarangayEntries({ '0403405': ['011Canlubang', '001Bagong Kalsada', '777Pasig'], '1381200': ['028San Antonio', '003Barangay 12'] }),
];
const find = (q: string) => search(entries, index, q);

describe('search', () => {
  it('ranks an exact match first', () => {
    expect(find('laguna')[0]).toMatchObject({ code: LAGUNA, name: 'Laguna', kind: 'province' });
  });

  it('matches partial names, ignoring case and accents', () => {
    expect(find('calam')[0]?.code).toBe(CALAMBA);
    expect(find('PASIG')[0]?.code).toBe(PASIG);
    expect(normalize('Biñan')).toBe('binan');
  });

  it('finds regions by designation and cities by their everyday name', () => {
    expect(find('ncr')[0]?.code).toBe(NCR);
    expect(find('region iv-a')[0]?.name).toBe('CALABARZON');
    expect(find('cebu city')[0]?.code).toBe(CEBU_CITY);
  });

  it('prefers a city over a same-named barangay unless barangays are asked for', () => {
    expect(find('pasig').map((r) => r.kind)).toEqual(['city', 'barangay']);
    expect(find('brgy pasig').map((r) => r.kind)).toEqual(['barangay']);
  });

  it('resolves the hierarchy of a result, nearest ancestor first', () => {
    expect(find('pasig')[0]?.trail).toEqual(['National Capital Region']);
    expect(find('canlubang')[0]).toMatchObject({ code: CANLUBANG, kind: 'barangay', trail: ['City of Calamba', 'Laguna', 'CALABARZON'] });
  });

  it('restricts to barangays when the query says so', () => {
    const hits = find('barangay san antonio');
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ name: 'San Antonio', trail: ['City of Pasig', 'National Capital Region'] });
    expect(find('barangay 12')[0]?.name).toBe('Barangay 12');
  });

  it('returns nothing for no match or a too-short query', () => {
    expect(find('atlantis')).toEqual([]);
    expect(find('l')).toEqual([]);
  });
});
