import { describe, it, expect } from 'vitest';
import { buildNoteGroups } from '../src/grouping.js';

const layers = [
  { id: 'people', name: 'Люди', order: 1, color: '#fff', icon: null },
  { id: 'events', name: 'События', order: 2, color: '#eee', icon: '📜' }
];

const notes = [
  { id: 'n1', layerId: 'people', type: 'person', tags: ['физика'], dateStart: 1643 },
  { id: 'n2', layerId: 'events', type: 'event', tags: [], dateStart: 1660 },
  { id: 'n3', layerId: 'people', type: 'person', tags: ['физика', 'механика'], dateStart: null }
];

describe('buildNoteGroups', () => {
  it('groups by layer, pre-registering every layer even if empty', () => {
    const groups = buildNoteGroups(notes, layers, 'layer');
    expect(groups.map((g) => g.key)).toEqual(['events', 'people']); // order: descending by layer.order
    expect(groups.find((g) => g.key === 'people').notes).toHaveLength(2);
    expect(groups.find((g) => g.key === 'events').icon).toBe('📜');
  });

  it('groups by type', () => {
    const groups = buildNoteGroups(notes, layers, 'type');
    const person = groups.find((g) => g.key === 'person');
    expect(person.notes).toHaveLength(2);
  });

  it('groups by tag, a note can appear in multiple groups, untagged notes go to "Без тегов"', () => {
    const groups = buildNoteGroups(notes, layers, 'tag');
    expect(groups.find((g) => g.key === 'физика').notes).toHaveLength(2);
    expect(groups.find((g) => g.key === 'механика').notes).toHaveLength(1);
    expect(groups.find((g) => g.key === 'Без тегов').notes.map((n) => n.id)).toEqual(['n2']);
    expect(groups[groups.length - 1].key).toBe('Без тегов');
  });

  it('groups by decade, notes without a date go to "no-date" last', () => {
    const groups = buildNoteGroups(notes, layers, 'decade');
    expect(groups[groups.length - 1].key).toBe('no-date');
    expect(groups.find((g) => g.key === '1600').notes.map((n) => n.id)).toEqual(['n1', 'n2']);
  });
});
