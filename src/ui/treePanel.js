import { store, setSelection, setGroupBy, setSearchQuery, deleteNote } from '../store.js';
import { openNoteWindow, createNoteWindow } from './noteWindows.js';
import { showContextMenu } from './contextMenu.js';
import { matchesQuery } from '../search.js';
import { buildNoteGroups } from '../grouping.js';
import { BUILTIN_TEMPLATES, applyTemplate } from '../templates.js';
import { escapeHtml, formatDateRange } from '../utils.js';

const collapsedGroups = new Set();

export function initTreePanel() {
  const select = document.getElementById('group-by-select');
  select.value = store.groupBy;
  select.addEventListener('change', () => setGroupBy(select.value));

  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', () => setSearchQuery(searchInput.value));

  document.getElementById('add-note-btn').addEventListener('click', () => {
    createNoteWindow(store.selection.layerId);
  });

  document.getElementById('add-note-template-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    showContextMenu(rect.left, rect.bottom + 4, BUILTIN_TEMPLATES.map((template) => ({
      label: template.name,
      onClick: () => createNoteWindow(store.selection.layerId, applyTemplate(template))
    })));
  });
}

export function renderTreePanel() {
  const container = document.getElementById('tree-panel');
  container.innerHTML = '';

  const isSearching = store.searchQuery.trim() !== '';
  const visibleNotes = store.data.notes.filter((note) => matchesQuery(note, store.searchQuery));
  const groups = buildNoteGroups(visibleNotes, store.data.layers, store.groupBy);

  for (const group of groups) {
    if (isSearching && group.notes.length === 0) continue;
    const groupEl = document.createElement('div');
    groupEl.className = 'tree-group';
    if (collapsedGroups.has(group.key)) groupEl.classList.add('collapsed');

    const header = document.createElement('div');
    header.className = 'tree-group-header';

    const caret = document.createElement('span');
    caret.className = 'caret';
    caret.textContent = '▾';

    let swatch;
    if (group.icon) {
      swatch = document.createElement('span');
      swatch.className = 'tree-group-icon';
      swatch.textContent = group.icon;
    } else {
      swatch = document.createElement('span');
      swatch.className = 'tree-group-swatch';
      swatch.style.background = group.color;
    }

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
