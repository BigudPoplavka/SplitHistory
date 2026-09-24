import { lngLatToUnit } from './worldMap.js';

function seededUnit(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

/**
 * Силовой лэйаут в пиксельных координатах для 2D-обзора одного слоя: заметки с geo
 * зафиксированы на проекции карты, остальные свободно стягиваются связями внутри слоя.
 */
export function computeLayerLayoutPixels(notes, width, height) {
  const positions = new Map();
  const fixedSet = new Set();
  const cx = width / 2;
  const cy = height / 2;
  const scatterRadius = Math.min(width, height) * 0.28;

  for (const note of notes) {
    if (note.geo && typeof note.geo.lat === 'number' && typeof note.geo.lng === 'number') {
      const u = lngLatToUnit(note.geo.lat, note.geo.lng);
      positions.set(note.id, { x: u.x * width, y: u.y * height });
      fixedSet.add(note.id);
    } else {
      const angle = seededUnit(note.id) * Math.PI * 2;
      const radius = scatterRadius * (0.3 + seededUnit(note.id + '_r') * 0.7);
      positions.set(note.id, { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
    }
  }

  const ids = notes.map((n) => n.id);
  const idSet = new Set(ids);
  const edges = [];
  const seenEdge = new Set();
  for (const note of notes) {
    for (const link of note.links) {
      if (!idSet.has(link.target)) continue;
      const key = [note.id, link.target].sort().join('~');
      if (seenEdge.has(key)) continue;
      seenEdge.add(key);
      edges.push([note.id, link.target]);
    }
  }

  const REPULSION = Math.max(4000, width * height * 0.0006);
  const SPRING = 0.02;
  const IDEAL_LEN = Math.min(width, height) * 0.16;
  const CENTER_PULL = 0.003;
  const PADDING = 24;

  for (let iter = 0; iter < 140; iter++) {
    const forces = new Map(ids.map((id) => [id, { x: 0, y: 0 }]));

    for (let i = 0; i < ids.length; i++) {
      const a = positions.get(ids[i]);
      for (let j = i + 1; j < ids.length; j++) {
        const b = positions.get(ids[j]);
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let distSq = dx * dx + dy * dy;
        if (distSq < 1) { dx = (Math.random() - 0.5); dy = (Math.random() - 0.5); distSq = 1; }
        const dist = Math.sqrt(distSq);
        const force = REPULSION / distSq;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        if (!fixedSet.has(ids[i])) { forces.get(ids[i]).x += fx; forces.get(ids[i]).y += fy; }
        if (!fixedSet.has(ids[j])) { forces.get(ids[j]).x -= fx; forces.get(ids[j]).y -= fy; }
      }
    }

    for (const [a, b] of edges) {
      const pa = positions.get(a);
      const pb = positions.get(b);
      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const dist = Math.max(0.01, Math.sqrt(dx * dx + dy * dy));
      const diff = (dist - IDEAL_LEN) * SPRING;
      const fx = (dx / dist) * diff;
      const fy = (dy / dist) * diff;
      if (!fixedSet.has(a)) { forces.get(a).x += fx; forces.get(a).y += fy; }
      if (!fixedSet.has(b)) { forces.get(b).x -= fx; forces.get(b).y -= fy; }
    }

    for (const id of ids) {
      if (fixedSet.has(id)) continue;
      const p = positions.get(id);
      const f = forces.get(id);
      f.x += -(p.x - cx) * CENTER_PULL;
      f.y += -(p.y - cy) * CENTER_PULL;
      p.x = Math.min(width - PADDING, Math.max(PADDING, p.x + f.x));
      p.y = Math.min(height - PADDING, Math.max(PADDING, p.y + f.y));
    }
  }

  return positions;
}
