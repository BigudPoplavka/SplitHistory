import * as L from 'leaflet';
import { getNoteAnchor } from '../geo.js';
import { isPicking, resolvePick } from './locationPicker.js';
import { createNoteWindow } from './noteWindows.js';

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const DBLCLICK_MS = 350;

let map = null;
let markersLayer = null;
let linesLayer = null;
let onEditNoteCallback = null;
let onSelectNoteCallback = null;
let lastFitLayerId = null;
let currentLayerId = null;
let lastMarkerClickId = null;
let lastMarkerClickTime = 0;

export function initMapView(container, callbacks) {
  onEditNoteCallback = callbacks.onEditNote;
  onSelectNoteCallback = callbacks.onSelectNote;

  map = L.map(container, {
    center: [20, 10],
    zoom: 2,
    minZoom: 2,
    maxZoom: 19,
    doubleClickZoom: false,
    worldCopyJump: true
  });

  L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, subdomains: 'abc', maxZoom: 19, className: 'map-tiles-dark' }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
  linesLayer = L.layerGroup().addTo(map);

  map.on('click', (e) => {
    if (isPicking()) {
      resolvePick(Math.round(e.latlng.lat * 100) / 100, Math.round(e.latlng.lng * 100) / 100);
    }
  });

  map.on('dblclick', (e) => {
    if (isPicking() || !currentLayerId) return;
    createNoteWindow(currentLayerId, { type: 'artifact', geo: { lat: Math.round(e.latlng.lat * 100) / 100, lng: Math.round(e.latlng.lng * 100) / 100 } });
  });
}

export function resizeMapView() {
  if (map) map.invalidateSize();
}

function anchorToLatLng(anchor) {
  return [anchor.lat, anchor.lng];
}

export function renderMapView(layer, notes, selectedNoteId) {
  if (!map) return;
  currentLayerId = layer ? layer.id : null;
  map.getContainer().classList.toggle('picking', isPicking());
  markersLayer.clearLayers();
  linesLayer.clearLayers();

  const color = (layer && layer.color) || '#e0645a';
  const idSet = new Set(notes.map((n) => n.id));
  const anchored = [];

  const seenEdge = new Set();
  for (const note of notes) {
    for (const link of note.links) {
      if (!idSet.has(link.target)) continue;
      const key = [note.id, link.target].sort().join('~');
      if (seenEdge.has(key)) continue;
      seenEdge.add(key);
      const a = getNoteAnchor(note);
      const b = getNoteAnchor(notes.find((n) => n.id === link.target));
      if (!a || !b) continue;
      L.polyline([anchorToLatLng(a), anchorToLatLng(b)], { color: '#e0645a', weight: 1.4, opacity: 0.6 }).addTo(linesLayer);
    }
  }

  for (const note of notes) {
    if (note.route && note.route.length > 1) {
      L.polyline(note.route.map((p) => [p.lat, p.lng]), { color, weight: 1.6, opacity: 0.8 }).addTo(linesLayer);
    } else if (note.region && note.region.length > 1) {
      L.polygon(note.region.map(([lat, lng]) => [lat, lng]), { color, weight: 1.6, opacity: 0.8, fill: false }).addTo(linesLayer);
    }

    const anchor = getNoteAnchor(note);
    if (!anchor) continue;
    anchored.push(anchor);

    const selected = note.id === selectedNoteId;
    const marker = L.circleMarker(anchorToLatLng(anchor), {
      radius: selected ? 8 : 6,
      color: selected ? '#ffffff' : color,
      weight: selected ? 2 : 1,
      fillColor: color,
      fillOpacity: 0.9
    });
    marker.bindTooltip(note.title, { permanent: true, direction: 'right', offset: [8, 0], className: 'map-note-label' });
    marker.on('click', (e) => {
      // Re-render на выбор уничтожает и пересоздаёт DOM-маркер, из-за чего браузер не
      // распознаёт второй клик как родной dblclick — считаем двойной клик вручную.
      L.DomEvent.stopPropagation(e);
      const now = Date.now();
      if (lastMarkerClickId === note.id && now - lastMarkerClickTime < DBLCLICK_MS) {
        lastMarkerClickId = null;
        onEditNoteCallback?.(note.id);
      } else {
        lastMarkerClickId = note.id;
        lastMarkerClickTime = now;
        onSelectNoteCallback?.(note.id);
      }
    });
    // Родной dblclick всё равно всплывает к карте (это отдельное событие от двух click) —
    // глушим его, иначе под маркером ещё и создастся новая заметка.
    marker.on('dblclick', (e) => L.DomEvent.stopPropagation(e));
    marker.addTo(markersLayer);
  }

  if (layer && layer.id !== lastFitLayerId) {
    lastFitLayerId = layer.id;
    if (anchored.length > 0) {
      const bounds = L.latLngBounds(anchored.map(anchorToLatLng));
      map.fitBounds(bounds.pad(0.3), { maxZoom: 10 });
    } else {
      map.setView([20, 10], 2);
    }
  }
}
