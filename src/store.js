/** Центральное состояние приложения: данные хранилища + подписки на изменения. */

import { resolveWikiLinks } from './utils.js';

const TIMELINE_MIN = -1000;
const CURRENT_YEAR = new Date().getFullYear();

function freshTimeline() {
  return { min: TIMELINE_MIN, max: CURRENT_YEAR, from: TIMELINE_MIN, to: CURRENT_YEAR, viewMin: TIMELINE_MIN, viewMax: CURRENT_YEAR };
}

export const store = {
  data: { layers: [], notes: [] },
  filePath: null,
  selection: { noteId: null, layerId: null },
  timeline: freshTimeline(),
  groupBy: 'layer',
  viewMode: '3d'
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of listeners) fn();
}

function genId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function init() {
  const result = await window.vaultAPI.load();
  store.data = result.data;
  store.filePath = result.filePath;
  store.timeline = freshTimeline();
  notify();
}

export function getNote(id) {
  return store.data.notes.find((n) => n.id === id) || null;
}

export function getLayer(id) {
  return store.data.layers.find((l) => l.id === id) || null;
}

export function notesInLayer(layerId) {
  return store.data.notes.filter((n) => n.layerId === layerId);
}

export function isNoteInTimeline(note) {
  const { from, to } = store.timeline;
  const start = typeof note.dateStart === 'number' ? note.dateStart : null;
  const end = typeof note.dateEnd === 'number' ? note.dateEnd : start;
  if (start === null) return true;
  return start <= to && (end === null ? start : end) >= from;
}

export function addNote(partial) {
  const note = {
    id: genId('n'),
    layerId: partial.layerId,
    title: partial.title || 'Новая заметка',
    type: partial.type || 'event',
    content: partial.content || '',
    dateStart: partial.dateStart ?? null,
    dateEnd: partial.dateEnd ?? null,
    geo: partial.geo || null,
    tags: partial.tags || [],
    links: partial.links || []
  };
  store.data.notes.push(note);
  notify();
  return note;
}

export function updateNote(id, patch) {
  const note = getNote(id);
  if (!note) return;
  Object.assign(note, patch);
  notify();
}

export function deleteNote(id) {
  store.data.notes = store.data.notes.filter((n) => n.id !== id);
  for (const note of store.data.notes) {
    note.links = note.links.filter((l) => l.target !== id);
  }
  if (store.selection.noteId === id) store.selection.noteId = null;
  notify();
}

/**
 * Добавляет в note.links связи, обнаруженные в тексте через [[Название]], не трогая уже
 * существующие (в т.ч. типизированные вручную) — линковка из текста только дополняет граф.
 */
export function syncLinksFromContent(noteId) {
  const note = getNote(noteId);
  if (!note) return false;
  const resolved = resolveWikiLinks(note.content, store.data.notes, noteId).filter((r) => r.note);
  let changed = false;
  for (const { note: target } of resolved) {
    if (!note.links.some((l) => l.target === target.id)) {
      note.links.push({ target: target.id, type: 'упоминание' });
      changed = true;
    }
  }
  if (changed) notify();
  return changed;
}

export function addLayer(partial) {
  const maxOrder = store.data.layers.reduce((m, l) => Math.max(m, l.order), 0);
  const layer = {
    id: genId('layer'),
    name: partial.name || 'Новый слой',
    kind: 'notes',
    order: maxOrder + 1,
    color: partial.color || '#ffffff',
    visible: true,
    opacity: 0.85
  };
  store.data.layers.push(layer);
  notify();
  return layer;
}

export function updateLayer(id, patch) {
  const layer = getLayer(id);
  if (!layer) return;
  Object.assign(layer, patch);
  notify();
}

export function deleteLayer(id) {
  const layer = getLayer(id);
  if (!layer || layer.kind === 'map') return;
  store.data.layers = store.data.layers.filter((l) => l.id !== id);
  const removedIds = new Set(store.data.notes.filter((n) => n.layerId === id).map((n) => n.id));
  store.data.notes = store.data.notes.filter((n) => n.layerId !== id);
  for (const note of store.data.notes) {
    note.links = note.links.filter((l) => !removedIds.has(l.target));
  }
  if (store.selection.layerId === id) store.selection.layerId = null;
  notify();
}

export function toggleLayerVisibility(id) {
  const layer = getLayer(id);
  if (!layer) return;
  layer.visible = !layer.visible;
  notify();
}

export function setSelection(patch) {
  Object.assign(store.selection, patch);
  notify();
}

export function setTimeline(patch) {
  Object.assign(store.timeline, patch);
  notify();
}

/** Зумит видимое окно временной шкалы до заданного числа лет вокруг центра текущего выбора. */
export function setTimelineScale(spanYears) {
  const { min, max, from, to } = store.timeline;
  const mid = (from + to) / 2;
  const half = Math.min(max - min, spanYears) / 2;
  let viewMin = mid - half;
  let viewMax = mid + half;
  if (viewMin < min) { viewMax += min - viewMin; viewMin = min; }
  if (viewMax > max) { viewMin -= viewMax - max; viewMax = max; }
  store.timeline.viewMin = Math.round(Math.max(min, viewMin));
  store.timeline.viewMax = Math.round(Math.min(max, viewMax));
  notify();
}

/** Сдвигает видимое окно шкалы на половину его текущей ширины влево (-1) или вправо (+1). */
export function panTimeline(direction) {
  const { min, max, viewMin, viewMax } = store.timeline;
  const span = viewMax - viewMin;
  const shift = direction * span * 0.5;
  let newMin = viewMin + shift;
  let newMax = viewMax + shift;
  if (newMin < min) { newMax += min - newMin; newMin = min; }
  if (newMax > max) { newMin -= newMax - max; newMax = max; }
  store.timeline.viewMin = Math.round(Math.max(min, newMin));
  store.timeline.viewMax = Math.round(Math.min(max, newMax));
  notify();
}

export function resetTimelineView() {
  store.timeline.viewMin = store.timeline.min;
  store.timeline.viewMax = store.timeline.max;
  notify();
}

export function setGroupBy(value) {
  store.groupBy = value;
  notify();
}

export function setViewMode(mode) {
  store.viewMode = mode;
  notify();
}

export function getLayerStats(layerId) {
  const notes = notesInLayer(layerId);
  const linkCount = notes.reduce((sum, n) => sum + n.links.length, 0);
  const weight = Math.round((notes.length + linkCount * 0.4) * 10) / 10;
  return { noteCount: notes.length, linkCount, weight };
}

export async function saveVault() {
  const result = await window.vaultAPI.save(store.data);
  store.filePath = result.filePath;
  notify();
  return result.filePath;
}

export async function saveVaultAs() {
  const result = await window.vaultAPI.saveAs(store.data);
  if (!result) return null;
  store.filePath = result.filePath;
  notify();
  return result.filePath;
}

export async function openVault() {
  const result = await window.vaultAPI.open();
  if (!result) return false;
  store.data = result.data;
  store.filePath = result.filePath;
  store.timeline = freshTimeline();
  store.selection = { noteId: null, layerId: null };
  notify();
  return true;
}
