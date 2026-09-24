import { store, getLayer, getNote, getLayerStats } from '../store.js';
import { escapeHtml, TYPE_LABELS, formatDateRange } from '../utils.js';

export function renderInfoPanel() {
  const titleEl = document.getElementById('layer-info-title');
  const bodyEl = document.getElementById('layer-info-body');

  const layer = store.selection.layerId ? getLayer(store.selection.layerId) : null;
  if (!layer) {
    titleEl.textContent = 'Слой не выбран';
    bodyEl.innerHTML = 'Выберите слой в списке справа или кликните по плоскости слоя в 3D-сцене.';
    return;
  }

  const stats = getLayerStats(layer.id);
  titleEl.textContent = `Слой: ${layer.name}`;
  let html = `
    Всего заметок: <b>${stats.noteCount}</b><br/>
    Вес слоя: <b>${stats.weight}</b><br/>
    Ссылок: <b>${stats.linkCount}</b>
  `;

  const note = store.selection.noteId ? getNote(store.selection.noteId) : null;
  if (note) {
    const dates = formatDateRange(note);
    html += `
      <hr style="border-color: var(--border); margin: 10px 0;" />
      Заметка: <b>${escapeHtml(note.title)}</b><br/>
      Тип: ${TYPE_LABELS[note.type] || note.type}${dates ? `<br/>Даты: ${escapeHtml(dates)}` : ''}
    `;
  }

  bodyEl.innerHTML = html;
}
