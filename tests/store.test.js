import { describe, it, expect, beforeEach } from 'vitest';
import {
  store, addNote, updateNote, restoreNoteVersion, deleteNote,
  isNoteInTimeline, getLayerStats, getCitationCoverage, getUncitedCount,
  addLayer, setTimeline, setSearchQuery, normalizeData, addAttachment, touchRecentNote
} from '../src/store.js';

beforeEach(() => {
  store.data = { layers: [], notes: [] };
  store.selection = { noteId: null, layerId: null };
  store.recentNoteIds = [];
});

describe('addNote', () => {
  it('fills sensible defaults for new fields', () => {
    const note = addNote({ layerId: 'l1' });
    expect(note.tags).toEqual([]);
    expect(note.links).toEqual([]);
    expect(note.dateApprox).toBe(false);
    expect(note.periodLabel).toBe('');
    expect(note.route).toBeNull();
    expect(note.region).toBeNull();
    expect(note.citation).toBeNull();
    expect(note.attachments).toEqual([]);
    expect(note.history).toEqual([]);
    expect(note.photo).toBeNull();
  });
});

describe('updateNote history snapshots', () => {
  it('records the previous title/content on the first content change', () => {
    const note = addNote({ layerId: 'l1', title: 'A', content: 'a' });
    updateNote(note.id, { content: 'b' });
    expect(note.history).toHaveLength(1);
    expect(note.history[0]).toMatchObject({ title: 'A', content: 'a' });
    expect(note.content).toBe('b');
  });

  it('does not spam a new snapshot for a rapid second edit', () => {
    const note = addNote({ layerId: 'l1', title: 'A', content: 'a' });
    updateNote(note.id, { content: 'b' });
    updateNote(note.id, { content: 'c' });
    expect(note.history).toHaveLength(1);
    expect(note.content).toBe('c');
  });

  it('does not snapshot for unrelated field changes', () => {
    const note = addNote({ layerId: 'l1', title: 'A', content: 'a' });
    updateNote(note.id, { dateStart: 1700 });
    expect(note.history).toHaveLength(0);
  });
});

describe('restoreNoteVersion', () => {
  it('restores a previous version and pushes the current one onto history', () => {
    const note = addNote({ layerId: 'l1', title: 'A', content: 'a' });
    updateNote(note.id, { content: 'b' });
    restoreNoteVersion(note.id, 0);
    expect(note.content).toBe('a');
    expect(note.history).toHaveLength(2);
  });
});

describe('isNoteInTimeline', () => {
  it('always includes undated notes', () => {
    setTimeline({ from: 1000, to: 2000 });
    expect(isNoteInTimeline({ dateStart: null, dateEnd: null })).toBe(true);
  });
  it('excludes notes fully outside the range', () => {
    setTimeline({ from: 1000, to: 1500 });
    expect(isNoteInTimeline({ dateStart: 1600, dateEnd: 1650 })).toBe(false);
  });
  it('includes notes overlapping the range', () => {
    setTimeline({ from: 1000, to: 1500 });
    expect(isNoteInTimeline({ dateStart: 1400, dateEnd: 1600 })).toBe(true);
  });
});

describe('getLayerStats', () => {
  it('counts notes and links for a layer', () => {
    addLayer({ name: 'Люди' });
    const layerId = store.data.layers[0].id;
    const a = addNote({ layerId, title: 'A' });
    const b = addNote({ layerId, title: 'B' });
    updateNote(a.id, { links: [{ target: b.id, type: 'x' }] });
    const stats = getLayerStats(layerId);
    expect(stats.noteCount).toBe(2);
    expect(stats.linkCount).toBe(1);
  });
});

describe('getCitationCoverage / getUncitedCount', () => {
  it('is unconfirmed with no source links', () => {
    const note = addNote({ layerId: 'l1', title: 'Событие' });
    expect(getCitationCoverage(note)).toBe('unconfirmed');
  });

  it('is partial with one source', () => {
    const source = addNote({ layerId: 'l1', title: 'Источник 1', type: 'source', citation: { author: 'X' } });
    const note = addNote({ layerId: 'l1', title: 'Событие', links: [{ target: source.id, type: 'упоминание' }] });
    expect(getCitationCoverage(note)).toBe('partial');
  });

  it('is confirmed with two independent sources', () => {
    const s1 = addNote({ layerId: 'l1', title: 'Источник 1', type: 'source', citation: { author: 'X' } });
    const s2 = addNote({ layerId: 'l1', title: 'Источник 2', type: 'source', citation: { author: 'Y' } });
    const note = addNote({
      layerId: 'l1',
      title: 'Событие',
      links: [{ target: s1.id, type: 'a' }, { target: s2.id, type: 'a' }]
    });
    expect(getCitationCoverage(note)).toBe('confirmed');
    expect(getUncitedCount('l1')).toBe(0);
  });

  it('getUncitedCount counts unconfirmed non-source notes only', () => {
    addNote({ layerId: 'l1', title: 'Без источника' });
    addNote({ layerId: 'l1', title: 'Источник', type: 'source' });
    expect(getUncitedCount('l1')).toBe(1);
  });
});

describe('deleteNote', () => {
  it('removes the note and dangling links to it', () => {
    const a = addNote({ layerId: 'l1', title: 'A' });
    const b = addNote({ layerId: 'l1', title: 'B', links: [{ target: a.id, type: 'x' }] });
    deleteNote(a.id);
    expect(store.data.notes.find((n) => n.id === a.id)).toBeUndefined();
    expect(b.links).toEqual([]);
  });
});

describe('touchRecentNote', () => {
  it('adds a note to the front of the recent list', () => {
    touchRecentNote('a');
    touchRecentNote('b');
    expect(store.recentNoteIds).toEqual(['b', 'a']);
  });

  it('moves an already-present id back to the front instead of duplicating it', () => {
    touchRecentNote('a');
    touchRecentNote('b');
    touchRecentNote('a');
    expect(store.recentNoteIds).toEqual(['a', 'b']);
  });

  it('caps the list at 30 entries', () => {
    for (let i = 0; i < 35; i++) touchRecentNote(`n${i}`);
    expect(store.recentNoteIds).toHaveLength(30);
    expect(store.recentNoteIds[0]).toBe('n34');
  });

  it('addNote touches the new note as recent', () => {
    const note = addNote({ layerId: 'l1', title: 'A' });
    expect(store.recentNoteIds[0]).toBe(note.id);
  });
});

describe('setSearchQuery', () => {
  it('updates store.searchQuery', () => {
    setSearchQuery('ньютон');
    expect(store.searchQuery).toBe('ньютон');
  });
});

describe('normalizeData', () => {
  it('fills in missing fields on notes loaded from an older schema', () => {
    const data = {
      layers: [],
      notes: [{ id: 'n1', layerId: 'l1', title: 'Старая заметка', type: 'event', content: '', dateStart: null, dateEnd: null, geo: null }]
    };
    normalizeData(data);
    const note = data.notes[0];
    expect(note.tags).toEqual([]);
    expect(note.links).toEqual([]);
    expect(note.attachments).toEqual([]);
    expect(note.history).toEqual([]);
    expect(note.citation).toBeNull();
    expect(note.route).toBeNull();
    expect(note.region).toBeNull();
    expect(note.dateApprox).toBe(false);
    expect(note.periodLabel).toBe('');
    expect(note.photo).toBeNull();
  });

  it('fills in missing icon field on layers loaded from an older schema', () => {
    const data = { layers: [{ id: 'l1', name: 'Люди', kind: 'notes', order: 1, color: '#fff', visible: true, opacity: 0.85 }], notes: [] };
    normalizeData(data);
    expect(data.layers[0].icon).toBeNull();
  });

  it('makes attachments/history mutation safe after normalization', () => {
    const data = { layers: [], notes: [{ id: 'n1', layerId: 'l1', title: 'A', type: 'event' }] };
    normalizeData(data);
    store.data = data;
    expect(() => addAttachment('n1', { id: 'a1', fileName: 'x.png', path: '/x.png' })).not.toThrow();
    expect(data.notes[0].attachments).toHaveLength(1);
  });
});
