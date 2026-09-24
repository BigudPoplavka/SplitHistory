import { store, toggleLayerVisibility, setSelection } from '../store.js';
import { openLayerModalForEdit, openLayerModalForNew } from './layerModal.js';

export function initLayersPanel() {
  document.getElementById('add-layer-btn').addEventListener('click', () => openLayerModalForNew());
}

export function renderLayersPanel() {
  const container = document.getElementById('layers-list');
  container.innerHTML = '';

  const layers = [...store.data.layers].sort((a, b) => b.order - a.order);
  for (const layer of layers) {
    const row = document.createElement('div');
    row.className = 'layer-row';
    if (layer.id === store.selection.layerId) row.classList.add('selected');
    if (!layer.visible) row.classList.add('hidden-layer');

    const eyeBtn = document.createElement('button');
    eyeBtn.className = 'eye-btn';
    eyeBtn.textContent = layer.visible ? '◉' : '◯';
    eyeBtn.title = layer.visible ? 'Скрыть слой' : 'Показать слой';
    eyeBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleLayerVisibility(layer.id); });

    let swatch;
    if (layer.icon) {
      swatch = document.createElement('span');
      swatch.className = 'layer-icon';
      swatch.textContent = layer.icon;
    } else {
      swatch = document.createElement('span');
      swatch.className = 'layer-swatch';
      swatch.style.background = layer.color || '#ffffff';
    }

    const name = document.createElement('span');
    name.className = 'layer-name';
    name.textContent = layer.name;

    const editBtn = document.createElement('button');
    editBtn.className = 'layer-edit-btn';
    editBtn.textContent = '✎';
    editBtn.title = 'Изменить слой';
    editBtn.addEventListener('click', (e) => { e.stopPropagation(); openLayerModalForEdit(layer.id); });

    row.append(eyeBtn, swatch, name, editBtn);
    row.addEventListener('click', () => setSelection({ layerId: layer.id, noteId: null }));

    container.appendChild(row);
  }
}
