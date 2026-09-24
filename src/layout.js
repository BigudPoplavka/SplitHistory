import { MAP_WIDTH, MAP_HEIGHT, latLngToPlane } from './projection.js';

const CLUSTER_ANCHOR = { x: -MAP_WIDTH * 0.32, z: -MAP_HEIGHT * 0.25 };
const REPULSION = 6;
const SPRING = 0.02;
const IDEAL_LEN = 3.2;
const ANCHOR_PULL = 0.004;
const ITERATIONS = 180;

function seededUnit(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

/**
 * Единый силовой (force-directed) лэйаут по X/Z для ВСЕХ заметок хранилища сразу —
 * связи между слоями должны притягивать узлы друг к другу в плане, а высота (Y)
 * слоя накладывается сверху отдельно при рендере. Заметки с geo фиксированы на
 * своей спроецированной точке карты; остальные свободно стягиваются в кластеры.
 */
export function computeGlobalLayout(notes) {
  const positions = new Map();
  const fixedSet = new Set();

  for (const note of notes) {
    if (note.geo && typeof note.geo.lat === 'number' && typeof note.geo.lng === 'number') {
      positions.set(note.id, latLngToPlane(note.geo.lat, note.geo.lng));
      fixedSet.add(note.id);
    } else {
      const angle = seededUnit(note.id) * Math.PI * 2;
      const radius = 3 + seededUnit(note.id + '_r') * 6;
      positions.set(note.id, {
        x: CLUSTER_ANCHOR.x + Math.cos(angle) * radius,
        z: CLUSTER_ANCHOR.z + Math.sin(angle) * radius
      });
    }
  }

  const ids = notes.map((n) => n.id);
  const edges = [];
  const seenEdge = new Set();
  for (const note of notes) {
    for (const link of note.links) {
      if (!positions.has(link.target)) continue;
      const key = [note.id, link.target].sort().join('~');
      if (seenEdge.has(key)) continue;
      seenEdge.add(key);
      edges.push([note.id, link.target]);
    }
  }

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const forces = new Map(ids.map((id) => [id, { x: 0, z: 0 }]));

    for (let i = 0; i < ids.length; i++) {
      const a = positions.get(ids[i]);
      for (let j = i + 1; j < ids.length; j++) {
        const b = positions.get(ids[j]);
        let dx = a.x - b.x;
        let dz = a.z - b.z;
        let distSq = dx * dx + dz * dz;
        if (distSq < 0.01) {
          dx = (Math.random() - 0.5) * 0.1;
          dz = (Math.random() - 0.5) * 0.1;
          distSq = 0.01;
        }
        const dist = Math.sqrt(distSq);
        const force = REPULSION / distSq;
        const fx = (dx / dist) * force;
        const fz = (dz / dist) * force;
        if (!fixedSet.has(ids[i])) { forces.get(ids[i]).x += fx; forces.get(ids[i]).z += fz; }
        if (!fixedSet.has(ids[j])) { forces.get(ids[j]).x -= fx; forces.get(ids[j]).z -= fz; }
      }
    }

    for (const [a, b] of edges) {
      const pa = positions.get(a);
      const pb = positions.get(b);
      const dx = pb.x - pa.x;
      const dz = pb.z - pa.z;
      const dist = Math.max(0.01, Math.sqrt(dx * dx + dz * dz));
      const diff = (dist - IDEAL_LEN) * SPRING;
      const fx = (dx / dist) * diff;
      const fz = (dz / dist) * diff;
      if (!fixedSet.has(a)) { forces.get(a).x += fx; forces.get(a).z += fz; }
      if (!fixedSet.has(b)) { forces.get(b).x -= fx; forces.get(b).z -= fz; }
    }

    for (const id of ids) {
      if (fixedSet.has(id)) continue;
      const p = positions.get(id);
      const f = forces.get(id);
      f.x += -(p.x - CLUSTER_ANCHOR.x) * ANCHOR_PULL;
      f.z += -(p.z - CLUSTER_ANCHOR.z) * ANCHOR_PULL;
      p.x += f.x;
      p.z += f.z;
    }
  }

  return positions;
}
