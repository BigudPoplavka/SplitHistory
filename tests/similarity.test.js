import { describe, it, expect } from 'vitest';
import { normalizeTitle, levenshtein, titleSimilarity, findSimilarNotes } from '../src/similarity.js';

describe('normalizeTitle', () => {
  it('trims, lowercases and collapses whitespace', () => {
    expect(normalizeTitle('  Исаак   Ньютон ')).toBe('исаак ньютон');
  });
});

describe('levenshtein', () => {
  it('is 0 for identical strings', () => {
    expect(levenshtein('abc', 'abc')).toBe(0);
  });
  it('counts a single substitution', () => {
    expect(levenshtein('abc', 'abd')).toBe(1);
  });
  it('handles empty strings', () => {
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
  });
});

describe('titleSimilarity', () => {
  it('is 1 for identical (normalized) titles', () => {
    expect(titleSimilarity('Исаак Ньютон', ' исаак  ньютон ')).toBe(1);
  });
  it('is high for near-duplicates', () => {
    expect(titleSimilarity('Исаак Ньютон', 'И. Ньютон')).toBeGreaterThan(0.4);
  });
  it('is 0 when either title is empty', () => {
    expect(titleSimilarity('', 'abc')).toBe(0);
  });
});

describe('findSimilarNotes', () => {
  const notes = [
    { id: 'n1', title: 'Исаак Ньютон', type: 'person' },
    { id: 'n2', title: 'Готфрид Лейбниц', type: 'person' },
    { id: 'n3', title: 'Исаак Ньютон', type: 'source' }
  ];

  it('finds an exact-title duplicate of the same type', () => {
    const result = findSimilarNotes('Исаак Ньютон', 'person', notes, null);
    expect(result.map((r) => r.note.id)).toEqual(['n1']);
  });

  it('excludes the note itself and other types', () => {
    const result = findSimilarNotes('Исаак Ньютон', 'person', notes, 'n1');
    expect(result).toHaveLength(0);
  });
});
