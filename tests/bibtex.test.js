import { describe, it, expect } from 'vitest';
import { parseBibTeX, bibEntryToNotePartial } from '../src/import/bibtex.js';

const sample = `
@book{newton1687,
  author = {Isaac Newton},
  title = {Philosophiae Naturalis Principia Mathematica},
  year = {1687},
  publisher = {Royal Society}
}

@article{someone2020,
  author = {Jane Doe},
  title = {A Modern Analysis},
  year = {2020},
  url = {https://example.com}
}
`;

describe('parseBibTeX', () => {
  const entries = parseBibTeX(sample);

  it('parses both entries', () => {
    expect(entries).toHaveLength(2);
  });

  it('extracts fields of the first entry', () => {
    expect(entries[0]).toMatchObject({
      key: 'newton1687',
      title: 'Philosophiae Naturalis Principia Mathematica',
      author: 'Isaac Newton',
      publicationYear: 1687,
      publisher: 'Royal Society'
    });
  });

  it('extracts the url field', () => {
    expect(entries[1].url).toBe('https://example.com');
  });

  it('returns an empty array for text with no entries', () => {
    expect(parseBibTeX('no entries here')).toEqual([]);
  });
});

describe('bibEntryToNotePartial', () => {
  it('builds a source-type note partial with citation', () => {
    const entries = parseBibTeX(sample);
    const partial = bibEntryToNotePartial(entries[0], 'sources-layer');
    expect(partial.type).toBe('source');
    expect(partial.layerId).toBe('sources-layer');
    expect(partial.citation.author).toBe('Isaac Newton');
    expect(partial.citation.reliability).toBe(3);
  });
});
