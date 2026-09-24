import { describe, it, expect } from 'vitest';
import { matchesQuery } from '../src/search.js';

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
