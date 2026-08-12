import { rankOptions, SearchableSelectOption } from '../searchable-select';

const med = (label: string, sub?: string): SearchableSelectOption => ({
  value: label.toLowerCase().replace(/\s+/g, '-'),
  label,
  sub,
});

// Deliberately not in alphabetical order — ranking must not depend on input order.
const CATALOGUE: SearchableSelectOption[] = [
  med('Co-Panadol', '500mg · TABLET'),
  med('Amoxicillin', '250mg · CAPSULE'),
  med('Panadol Extra', '500mg · TABLET'),
  med('Ibuprofen', '400mg · TABLET'),
  med('Panadol', '500mg · TABLET'),
  med('Zinc Sulphate', '20mg · SYRUP'),
  med('Paracetamol', '500mg · TABLET'),
];

describe('rankOptions', () => {
  it('puts the exact name first, ahead of names that merely start with the query', () => {
    const { results } = rankOptions(CATALOGUE, 'panadol', 100);

    expect(results[0].label).toBe('Panadol');
    expect(results.map((r) => r.label)).toEqual(['Panadol', 'Panadol Extra', 'Co-Panadol']);
  });

  it('ranks a prefix of the name above a match inside the name', () => {
    const { results } = rankOptions(CATALOGUE, 'pana', 100);

    // "Panadol"/"Panadol Extra" start with it; "Co-Panadol" only contains it
    expect(results.map((r) => r.label)).toEqual(['Panadol', 'Panadol Extra', 'Co-Panadol']);
  });

  it('matches a word inside a hyphenated name ahead of an unrelated substring', () => {
    const { results } = rankOptions([med('Co-Panadol'), med('Vitamin Panadol X')], 'panadol', 100);

    expect(results[0].label).toBe('Co-Panadol');
  });

  it('requires every term to match, so name and strength can be combined', () => {
    const { results } = rankOptions(CATALOGUE, 'pana 500', 100);

    expect(results.map((r) => r.label)).toEqual(['Panadol', 'Panadol Extra', 'Co-Panadol']);
  });

  it('returns nothing when a term matches no row', () => {
    const { results, totalMatches } = rankOptions(CATALOGUE, 'panadol 999', 100);

    expect(results).toEqual([]);
    expect(totalMatches).toBe(0);
  });

  it('searches the secondary line as well as the name', () => {
    const { results } = rankOptions(CATALOGUE, 'syrup', 100);

    expect(results.map((r) => r.label)).toEqual(['Zinc Sulphate']);
  });

  it('is case-insensitive and ignores surrounding whitespace', () => {
    expect(rankOptions(CATALOGUE, '  PANADOL  ', 100).results[0].label).toBe('Panadol');
  });

  it('caps rendered rows but reports the true match count', () => {
    const many = Array.from({ length: 3000 }, (_, i) => med(`Medicine ${i}`, '500mg'));

    const { results, totalMatches } = rankOptions(many, 'medicine', 100);

    expect(results).toHaveLength(100);
    expect(totalMatches).toBe(3000);
  });

  it('caps an unsearched list too, so opening the picker never mounts the whole catalogue', () => {
    const many = Array.from({ length: 3000 }, (_, i) => med(`Medicine ${i}`));

    const { results, totalMatches } = rankOptions(many, '', 100);

    expect(results).toHaveLength(100);
    expect(totalMatches).toBe(3000);
  });

  it('treats punctuation in names as literal, not as a pattern', () => {
    const options = [med('Vitamin B-12 (Inj)'), med('Vitamin B1')];

    // A regex-based ranker would read "(inj)" as a group and match nothing
    const { results } = rankOptions(options, 'b-12 (inj)', 100);

    expect(results.map((r) => r.label)).toEqual(['Vitamin B-12 (Inj)']);
  });

  it('orders ties alphabetically so results do not shuffle between keystrokes', () => {
    const options = [med('Zinc Tablet'), med('Alpha Tablet'), med('Mid Tablet')];

    const { results } = rankOptions(options, 'tablet', 100);

    expect(results.map((r) => r.label)).toEqual(['Alpha Tablet', 'Mid Tablet', 'Zinc Tablet']);
  });
});
