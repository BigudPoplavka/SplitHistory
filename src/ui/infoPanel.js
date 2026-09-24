import { store, getLayer, getNote, getLayerStats, getUncitedCount, getCitationCoverage } from '../store.js';
import { escapeHtml, TYPE_LABELS, formatDateRange } from '../utils.js';

const COVERAGE_LABELS = {
  confirmed: '✓ подтверждено ≥2 источниками',
  partial: '~ подтверждено 1 источником',
  unconfirmed: '✗ без источника'
};

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
  const uncited = getUncitedCount(layer.id);
  titleEl.textContent = `Слой: ${layer.name}`;
  let html = `
    Всего заметок: <b>${stats.noteCount}</b><br/>
    Вес слоя: <b>${stats.weight}</b><br/>
    Ссылок: <b>${stats.linkCount}</b><br/>
    Без источника: <b>${uncited}</b>
  `;

  const note = store.selection.noteId ? getNote(store.selection.noteId) : null;
  if (note) {
    const dates = formatDateRange(note);
    const period = note.periodLabel ? ` (${escapeHtml(note.periodLabel)})` : '';
    html += `
      <hr style="border-color: var(--border); margin: 10px 0;" />
      Заметка: <b>${escapeHtml(note.title)}</b><br/>
      Тип: ${TYPE_LABELS[note.type] || note.type}${dates ? `<br/>Даты: ${escapeHtml(dates)}${note.dateApprox ? ' (ок.)' : ''}${period}` : period}
      ${note.type !== 'source' ? `<br/>Источники: ${COVERAGE_LABELS[getCitationCoverage(note)]}` : ''}
    `;
  }

  bodyEl.innerHTML = html;
}
