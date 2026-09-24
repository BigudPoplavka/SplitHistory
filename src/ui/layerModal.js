import { getLayer, addLayer, updateLayer, deleteLayer } from '../store.js';

let editingLayerId = null;
let els = {};

export function initLayerModal() {
  els = {
    overlay: document.getElementById('layer-modal-overlay'),
    title: document.getElementById('layer-modal-title'),
    name: document.getElementById('lf-name'),
    color: document.getElementById('lf-color'),
    close: document.getElementById('layer-modal-close'),
    cancel: document.getElementById('layer-modal-cancel'),
    save: document.getElementById('layer-modal-save'),
    del: document.getElementById('layer-modal-delete')
  };

  els.close.addEventListener('click', hide);
  els.cancel.addEventListener('click', hide);
  els.save.addEventListener('click', onSave);
  els.del.addEventListener('click', onDelete);
  els.overlay.addEventListener('click', (e) => { if (e.target === els.overlay) hide(); });
}

export function openLayerModalForNew() {
  editingLayerId = null;
  els.title.textContent = 'Новый слой';
  els.name.value = '';
  els.color.value = '#8ec9ff';
  els.del.classList.add('hidden');
  show();
}

export function openLayerModalForEdit(layerId) {
  const layer = getLayer(layerId);
  if (!layer) return;
  editingLayerId = layerId;
  els.title.textContent = 'Изменить слой';
  els.name.value = layer.name;
  els.color.value = layer.color || '#ffffff';
  els.del.classList.toggle('hidden', layer.kind === 'map');
  show();
}

function onSave() {
  const name = els.name.value.trim() || 'Без имени';
  const color = els.color.value;
  if (editingLayerId) updateLayer(editingLayerId, { name, color });
  else addLayer({ name, color });
  hide();
}

function onDelete() {
  if (!editingLayerId) return;
  if (!window.confirm('Удалить слой вместе со всеми его заметками?')) return;
  deleteLayer(editingLayerId);
  hide();
}

function show() { els.overlay.classList.remove('hidden'); }
function hide() { els.overlay.classList.add('hidden'); editingLayerId = null; }
