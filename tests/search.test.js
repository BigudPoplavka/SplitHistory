import { describe, it, expect } from 'vitest';
import { matchesQuery, scoreTitleMatch, rankNotesByTitle } from '../src/search.js';

const note = { title: 'Исаак Ньютон', content: 'Английский физик и математик', tags: ['физика', 'механика'] };

describe('matchesQuery', () => {
  it('matches everything for an empty query', () => {
    expect(matchesQuery(note, '')).toBe(true);
    expect(matchesQuery(note, '   ')).toBe(true);
  });
  it('matches by title, case-insensitively', () => {
    expect(matchesQuery(note, 'ньютон')).toBe(true);
  });
  it('matches by content', () => {
    expect(matchesQuery(note, 'физик')).toBe(true);
  });
  it('matches by tag', () => {
    expect(matchesQuery(note, 'механика')).toBe(true);
  });
  it('does not match unrelated queries', () => {
    expect(matchesQuery(note, 'лейбниц')).toBe(false);
  });
});

describe('scoreTitleMatch', () => {
  it('scores an exact match highest', () => {
    expect(scoreTitleMatch('Исаак Ньютон', 'исаак ньютон')).toBe(100);
  });
  it('scores a prefix match higher than a mid-string match', () => {
    const prefix = scoreTitleMatch('Ньютон Исаак', 'нью');
    const midString = scoreTitleMatch('Исаак Ньютон', 'нью');
    expect(prefix).toBeGreaterThan(midString);
  });
  it('scores an earlier substring match higher than a later one', () => {
    const early = scoreTitleMatch('Ньютон и Лейбниц', 'лейбниц');
    const late = scoreTitleMatch('Спор Ньютона и Лейбница о приоритете', 'лейбниц');
    expect(early).toBeGreaterThan(late);
  });
  it('returns -1 for no match', () => {
    expect(scoreTitleMatch('Исаак Ньютон', 'галилей')).toBe(-1);
  });
  it('returns 0 for an empty query', () => {
    expect(scoreTitleMatch('Исаак Ньютон', '')).toBe(0);
  });
});

describe('rankNotesByTitle', () => {
  const notes = [
    { id: 'a', title: 'Спор Ньютона и Лейбница' },
    { id: 'b', title: 'Ньютон' },
    { id: 'c', title: 'Готфрид Лейбниц' },
    { id: 'd', title: 'Галилео Галилей' }
  ];

  it('excludes non-matching notes and ranks the rest by relevance', () => {
    const result = rankNotesByTitle(notes, 'ньютон');
    expect(result.map((n) => n.id)).toEqual(['b', 'a']);
  });

  it('respects the limit', () => {
    const result = rankNotesByTitle(notes, 'е', 1);
    expect(result).toHaveLength(1);
  });
});
