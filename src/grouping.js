import { TYPE_LABELS } from './utils.js';

/**
 * Группирует заметки по текущему режиму (слой/тип/тег/период) — общая логика для дерева заметок
 * слева и для панели открытых заметок по группам. Порядок групп стабилен и предсказуем.
 */
export function buildNoteGroups(notes, layers, groupBy) {
  const groups = [];
  const byKey = new Map();

  const ensure = (key, label, color, icon) => {
    if (!byKey.has(key)) {
      const g = { key, label, color, icon: icon || null, notes: [] };
      byKey.set(key, g);
      groups.push(g);
    }
    return byKey.get(key);
  };

  if (groupBy === 'layer') {
    for (const layer of [...layers].sort((a, b) => b.order - a.order)) {
      ensure(layer.id, layer.name, layer.color, layer.icon);
    }
    for (const note of notes) {
      const layer = layers.find((l) => l.id === note.layerId);
      ensure(note.layerId, layer ? layer.name : 'Без слоя', layer ? layer.color : '#888', layer?.icon).notes.push(note);
    }
  } else if (groupBy === 'type') {
    for (const note of notes) {
      ensure(note.type, TYPE_LABELS[note.type] || note.type, '#888').notes.push(note);
    }
  } else if (groupBy === 'tag') {
    for (const note of notes) {
      const tags = note.tags && note.tags.length ? note.tags : ['Без тегов'];
      for (const tag of tags) ensure(tag, tag, '#888').notes.push(note);
    }
    groups.sort((a, b) => {
      if (a.key === 'Без тегов') return 1;
      if (b.key === 'Без тегов') return -1;
      return a.label.localeCompare(b.label, 'ru');
    });
  } else {
    for (const note of notes) {
      const key = typeof note.dateStart === 'number' ? String(Math.floor(note.dateStart / 100) * 100) : 'no-date';
      const label = key === 'no-date' ? 'Без даты' : `${key}-е гг.`;
      ensure(key, label, '#888').notes.push(note);
    }
    groups.sort((a, b) => {
      if (a.key === 'no-date') return 1;
      if (b.key === 'no-date') return -1;
      return Number(a.key) - Number(b.key);
    });
  }

  return groups;
}
