import { describe, it, expect } from 'vitest';
import { formatYear, formatDateRange, extractWikiLinkTitles, resolveWikiLinks, parseTagsInput, escapeHtml } from '../src/utils.js';

describe('formatYear', () => {
  it('formats BCE years', () => {
    expect(formatYear(-500)).toBe('500 до н.э.');
  });
  it('formats CE years', () => {
    expect(formatYear(1687)).toBe('1687');
  });
  it('returns empty string for non-numbers', () => {
    expect(formatYear(null)).toBe('');
    expect(formatYear(undefined)).toBe('');
  });
});

describe('formatDateRange', () => {
  it('formats a range', () => {
    expect(formatDateRange({ dateStart: 1643, dateEnd: 1727 })).toBe('1643 — 1727');
  });
  it('formats a single year when start === end', () => {
    expect(formatDateRange({ dateStart: 1660, dateEnd: 1660 })).toBe('1660');
  });
  it('formats only start when end is missing', () => {
    expect(formatDateRange({ dateStart: 1660, dateEnd: null })).toBe('1660');
  });
  it('returns empty string when no dates', () => {
    expect(formatDateRange({ dateStart: null, dateEnd: null })).toBe('');
  });
});

describe('extractWikiLinkTitles', () => {
  it('extracts plain [[Title]] links', () => {
    expect(extractWikiLinkTitles('см. [[Исаак Ньютон]] и [[Готфрид Лейбниц]]'))
      .toEqual(['Исаак Ньютон', 'Готфрид Лейбниц']);
  });
  it('extracts alias form [[Title|Alias]] using the title part', () => {
    expect(extractWikiLinkTitles('[[Исаак Ньютон|Ньютон]]')).toEqual(['Исаак Ньютон']);
  });
  it('dedupes repeated links', () => {
    expect(extractWikiLinkTitles('[[A]] и снова [[A]]')).toEqual(['A']);
  });
  it('returns empty array for no links', () => {
    expect(extractWikiLinkTitles('обычный текст')).toEqual([]);
  });
});

describe('resolveWikiLinks', () => {
  const notes = [
    { id: 'n1', title: 'Исаак Ньютон' },
    { id: 'n2', title: 'Готфрид Лейбниц' }
  ];

  it('resolves matching titles case-insensitively', () => {
    const result = resolveWikiLinks('[[исаак ньютон]]', notes, 'n2');
    expect(result).toHaveLength(1);
    expect(result[0].note.id).toBe('n1');
  });

  it('does not resolve the note itself', () => {
    const result = resolveWikiLinks('[[Готфрид Лейбниц]]', notes, 'n2');
    expect(result[0].note).toBeNull();
  });

  it('leaves unknown titles unresolved', () => {
    const result = resolveWikiLinks('[[Неизвестно]]', notes, 'n1');
    expect(result[0].note).toBeNull();
    expect(result[0].title).toBe('Неизвестно');
  });
});

describe('parseTagsInput', () => {
  it('splits, trims and dedupes comma-separated tags', () => {
    expect(parseTagsInput(' физика, механика ,физика,')).toEqual(['физика', 'механика']);
  });
  it('returns empty array for empty input', () => {
    expect(parseTagsInput('')).toEqual([]);
  });
});

describe('escapeHtml', () => {
  it('escapes special characters', () => {
    expect(escapeHtml('<b>"a" & \'b\'</b>')).toBe('&lt;b&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/b&gt;');
  });
});
