import { getLayer, addLayer, updateLayer, deleteLayer } from '../store.js';
import { LAYER_ICON_OPTIONS } from '../icons.js';

let editingLayerId = null;
let selectedIcon = null;
let els = {};

export function initLayerModal() {
  els = {
    overlay: document.getElementById('layer-modal-overlay'),
    title: document.getElementById('layer-modal-title'),
    name: document.getElementById('lf-name'),
    color: document.getElementById('lf-color'),
    iconPicker: document.getElementById('lf-icon-picker'),
    close: document.getElementById('layer-modal-close'),
    cancel: document.getElementById('layer-modal-cancel'),
    save: document.getElementById('layer-modal-save'),
    del: document.getElementById('layer-modal-delete')
  };

  buildIconPicker();

  els.close.addEventListener('click', hide);
  els.cancel.addEventListener('click', hide);
  els.save.addEventListener('click', onSave);
  els.del.addEventListener('click', onDelete);
  els.overlay.addEventListener('click', (e) => { if (e.target === els.overlay) hide(); });
}

function buildIconPicker() {
  els.iconPicker.innerHTML = '';

  const noneBtn = document.createElement('button');
  noneBtn.type = 'button';
  noneBtn.className = 'icon-picker-item icon-picker-none';
  noneBtn.textContent = '—';
  noneBtn.title = 'Без иконки (цветная метка)';
  noneBtn.addEventListener('click', () => setSelectedIcon(null));
  els.iconPicker.appendChild(noneBtn);

  for (const icon of LAYER_ICON_OPTIONS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'icon-picker-item';
    btn.textContent = icon;
    btn.addEventListener('click', () => setSelectedIcon(icon));
    els.iconPicker.appendChild(btn);
  }
}

function setSelectedIcon(icon) {
  selectedIcon = icon;
  for (const btn of els.iconPicker.children) {
    const isNone = btn.classList.contains('icon-picker-none');
    btn.classList.toggle('selected', isNone ? icon === null : btn.textContent === icon);
  }
}

export function openLayerModalForNew() {
  editingLayerId = null;
  els.title.textContent = 'Новый слой';
  els.name.value = '';
  els.color.value = '#8ec9ff';
  els.del.classList.add('hidden');
  setSelectedIcon(null);
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
  setSelectedIcon(layer.icon || null);
  show();
}

function onSave() {
  const name = els.name.value.trim() || 'Без имени';
  const color = els.color.value;
  if (editingLayerId) updateLayer(editingLayerId, { name, color, icon: selectedIcon });
  else addLayer({ name, color, icon: selectedIcon });
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
