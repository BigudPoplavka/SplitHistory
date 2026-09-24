import { store, setSelection, setGroupBy, deleteNote } from '../store.js';
import { openNoteWindow, createNoteWindow } from './noteWindows.js';
import { showContextMenu } from './contextMenu.js';
import { escapeHtml, TYPE_LABELS, formatDateRange } from '../utils.js';

const collapsedGroups = new Set();

export function initTreePanel() {
  const select = document.getElementById('group-by-select');
  select.value = store.groupBy;
  select.addEventListener('change', () => setGroupBy(select.value));

  document.getElementById('add-note-btn').addEventListener('click', () => {
    createNoteWindow(store.selection.layerId);
  });
}

function buildGroups() {
  const groupBy = store.groupBy;
  const groups = [];
  const byKey = new Map();

  const ensure = (key, label, color) => {
    if (!byKey.has(key)) {
      const g = { key, label, color, notes: [] };
      byKey.set(key, g);
      groups.push(g);
    }
    return byKey.get(key);
  };

  if (groupBy === 'layer') {
    for (const layer of [...store.data.layers].sort((a, b) => b.order - a.order)) {
      ensure(layer.id, layer.name, layer.color);
    }
    for (const note of store.data.notes) {
      const layer = store.data.layers.find((l) => l.id === note.layerId);
      ensure(note.layerId, layer ? layer.name : 'Без слоя', layer ? layer.color : '#888').notes.push(note);
    }
  } else if (groupBy === 'type') {
    for (const note of store.data.notes) {
      ensure(note.type, TYPE_LABELS[note.type] || note.type, '#888').notes.push(note);
    }
  } else if (groupBy === 'tag') {
    for (const note of store.data.notes) {
      const tags = note.tags && note.tags.length ? note.tags : ['Без тегов'];
      for (const tag of tags) ensure(tag, tag, '#888').notes.push(note);
    }
    groups.sort((a, b) => {
      if (a.key === 'Без тегов') return 1;
      if (b.key === 'Без тегов') return -1;
      return a.label.localeCompare(b.label, 'ru');
    });
  } else {
    for (const note of store.data.notes) {
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

export function renderTreePanel() {
  const container = document.getElementById('tree-panel');
  container.innerHTML = '';

  for (const group of buildGroups()) {
    const groupEl = document.createElement('div');
    groupEl.className = 'tree-group';
    if (collapsedGroups.has(group.key)) groupEl.classList.add('collapsed');

    const header = document.createElement('div');
    header.className = 'tree-group-header';

    const caret = document.createElement('span');
    caret.className = 'caret';
    caret.textContent = '▾';

    const swatch = document.createElement('span');
    swatch.className = 'tree-group-swatch';
    swatch.style.background = group.color;

    const label = document.createElement('span');
    label.textContent = group.label;

    const count = document.createElement('span');
    count.className = 'tree-group-count';
    count.textContent = group.notes.length;

    header.append(caret, swatch, label, count);
    header.addEventListener('click', () => {
      if (collapsedGroups.has(group.key)) collapsedGroups.delete(group.key);
      else collapsedGroups.add(group.key);
      renderTreePanel();
    });

    const itemsEl = document.createElement('div');
    itemsEl.className = 'tree-group-items';

    for (const note of group.notes) {
      const item = document.createElement('div');
      item.className = 'tree-note';
      if (note.id === store.selection.noteId) item.classList.add('selected');

      const dates = formatDateRange(note);
      item.innerHTML = `${escapeHtml(note.title)}${dates ? `<span class="tree-note-dates">${escapeHtml(dates)}</span>` : ''}`;

      item.addEventListener('click', () => setSelection({ noteId: note.id, layerId: note.layerId }));
      item.addEventListener('dblclick', () => openNoteWindow(note.id));
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        setSelection({ noteId: note.id, layerId: note.layerId });
        showContextMenu(e.clientX, e.clientY, [
          { label: 'Открыть', onClick: () => openNoteWindow(note.id) },
          {
            label: 'Удалить заметку',
            danger: true,
            onClick: () => {
              if (!window.confirm('Удалить заметку без возможности восстановления?')) return;
              deleteNote(note.id);
            }
          }
        ]);
      });

      itemsEl.appendChild(item);
    }

    groupEl.append(header, itemsEl);
    container.appendChild(groupEl);
  }
}
