import { store, getLayer, getNote, notesInLayer, isNoteInTimeline, setSelection } from '../store.js';
import { drawWorldOutline, lngLatToUnit } from '../worldMap.js';
import { computeLayerLayoutPixels } from '../layout2d.js';
import { matchesQuery } from '../search.js';

let canvas, ctx;
let nodePositions = new Map();
let onEditNoteCallback = null;

export function initLayer2D(canvasEl, callbacks) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');
  onEditNoteCallback = callbacks.onEditNote;
  canvas.addEventListener('click', onCanvasClick);
  canvas.addEventListener('dblclick', onCanvasDblClick);
}

function resizeCanvasToContainer() {
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { width: rect.width, height: rect.height };
}

function findNoteAt(px, py) {
  let found = null;
  let bestDist = 16;
  for (const [id, pos] of nodePositions) {
    const dist = Math.hypot(pos.x - px, pos.y - py);
    if (dist < bestDist) { bestDist = dist; found = id; }
  }
  return found;
}

function eventToCanvasXY(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function onCanvasClick(event) {
  const { x, y } = eventToCanvasXY(event);
  const noteId = findNoteAt(x, y);
  if (!noteId) return;
  const note = getNote(noteId);
  if (note) setSelection({ noteId, layerId: note.layerId });
}

function onCanvasDblClick(event) {
  const { x, y } = eventToCanvasXY(event);
  const noteId = findNoteAt(x, y);
  if (noteId && onEditNoteCallback) onEditNoteCallback(noteId);
}

export function renderLayer2D() {
  if (!canvas) return;
  const { width, height } = resizeCanvasToContainer();
  ctx.clearRect(0, 0, width, height);
  drawWorldOutline(ctx, width, height, { fill: '#33363c', stroke: '#45484e' });

  const layerId = store.selection.layerId;
  if (!layerId) {
    nodePositions = new Map();
    ctx.fillStyle = '#9a9da3';
    ctx.font = '14px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Выберите слой справа, чтобы посмотреть его 2D-граф', width / 2, height / 2);
    return;
  }

  const layer = getLayer(layerId);
  const notes = notesInLayer(layerId)
    .filter(isNoteInTimeline)
    .filter((n) => matchesQuery(n, store.searchQuery));
  nodePositions = computeLayerLayoutPixels(notes, width, height);

  ctx.lineWidth = 1.6;
  ctx.strokeStyle = (layer && layer.color) || '#ffffff';
  ctx.globalAlpha = 0.8;
  for (const note of notes) {
    if (note.route && note.route.length > 1) {
      ctx.beginPath();
      note.route.forEach((p, i) => {
        const u = lngLatToUnit(p.lat, p.lng);
        const x = u.x * width;
        const y = u.y * height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    } else if (note.region && note.region.length > 1) {
      ctx.beginPath();
      note.region.forEach(([lat, lng], i) => {
        const u = lngLatToUnit(lat, lng);
        const x = u.x * width;
        const y = u.y * height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  const idSet = new Set(notes.map((n) => n.id));
  const seenEdge = new Set();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = 'rgba(224, 100, 90, 0.6)';
  for (const note of notes) {
    for (const link of note.links) {
      if (!idSet.has(link.target)) continue;
      const key = [note.id, link.target].sort().join('~');
      if (seenEdge.has(key)) continue;
      seenEdge.add(key);
      const a = nodePositions.get(note.id);
      const b = nodePositions.get(link.target);
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  ctx.font = '12px "Segoe UI", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (const note of notes) {
    const pos = nodePositions.get(note.id);
    if (!pos) continue;
    const selected = note.id === store.selection.noteId;

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, selected ? 7 : 5, 0, Math.PI * 2);
    ctx.fillStyle = (layer && layer.color) || '#ffffff';
    ctx.fill();
    if (selected) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }

    ctx.fillStyle = '#e8e8ea';
    ctx.fillText(note.title, pos.x + 10, pos.y);
  }

  if (notes.length === 0) {
    ctx.fillStyle = '#9a9da3';
    ctx.font = '14px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('В этом слое пока нет заметок', width / 2, height / 2);
  }
}
