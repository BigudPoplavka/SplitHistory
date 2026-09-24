import { store, getLayer } from '../store.js';
import { drawWorldOutline, lngLatToUnit } from '../worldMap.js';

export function renderMiniGraph() {
  const canvas = document.getElementById('mini-graph-canvas');
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);
  drawWorldOutline(ctx, w, h, { fill: '#33363c', stroke: '#45484e' });

  const layerId = store.selection.layerId;
  const geoNotes = store.data.notes.filter((n) => n.geo);
  const toXY = (note) => {
    const u = lngLatToUnit(note.geo.lat, note.geo.lng);
    return { x: u.x * w, y: u.y * h };
  };

  ctx.lineWidth = 1.2;
  for (const note of geoNotes) {
    for (const link of note.links) {
      const target = geoNotes.find((n) => n.id === link.target);
      if (!target) continue;
      const relevant = !layerId || note.layerId === layerId || target.layerId === layerId;
      if (!relevant) continue;
      const highlighted = layerId && (note.layerId === layerId || target.layerId === layerId);
      ctx.strokeStyle = highlighted ? 'rgba(224, 100, 90, 0.85)' : 'rgba(255,255,255,0.18)';
      const a = toXY(note);
      const b = toXY(target);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  for (const note of geoNotes) {
    const { x, y } = toXY(note);
    const inSelectedLayer = layerId && note.layerId === layerId;
    const layer = getLayer(note.layerId);
    ctx.beginPath();
    ctx.arc(x, y, inSelectedLayer ? 3.4 : 2.2, 0, Math.PI * 2);
    ctx.fillStyle = inSelectedLayer ? '#e0645a' : (layer ? layer.color : '#ffffff');
    ctx.globalAlpha = layerId && !inSelectedLayer ? 0.35 : 0.9;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}
