import { store, setSelection, setViewMode } from '../store.js';

let active = false;
let noteTitle = '';
let onResolve = null;
let previousViewMode = '3d';
let previousLayerId = null;

export function isPicking() {
  return active;
}

/** Переключает на 2D-карту и ждёт клика по ней; onPick(lat,lng) вызывается при выборе точки. */
export function startPicking(title, onPick) {
  active = true;
  noteTitle = title || 'заметки';
  onResolve = onPick;
  previousViewMode = store.viewMode;
  previousLayerId = store.selection.layerId;

  const mapLayer = store.data.layers.find((l) => l.kind === 'map');
  setSelection({ layerId: mapLayer ? mapLayer.id : store.selection.layerId });
  setViewMode('2d');

  updateBanner();
}

export function cancelPicking() {
  if (!active) return;
  finish(() => setViewMode(previousViewMode));
}

/** Вызывается слоем 2D-карты по клику, когда режим выбора активен. */
export function resolvePick(lat, lng) {
  if (!active) return;
  const callback = onResolve;
  finish(() => {
    setViewMode(previousViewMode);
    setSelection({ layerId: previousLayerId });
    callback?.(lat, lng);
  });
}

function finish(after) {
  active = false;
  onResolve = null;
  updateBanner();
  after?.();
}

function updateBanner() {
  const banner = document.getElementById('location-pick-banner');
  if (!banner) return;
  banner.classList.toggle('hidden', !active);
  banner.querySelector('.location-pick-text').textContent =
    `Кликните на карте, чтобы указать место для «${noteTitle}» — Esc для отмены`;
}

export function initLocationPicker() {
  const banner = document.getElementById('location-pick-banner');
  if (banner) {
    banner.querySelector('.location-pick-cancel')?.addEventListener('click', cancelPicking);
  }
  window.addEventListener('keydown', (e) => {
    if (active && e.key === 'Escape') cancelPicking();
  });
}
