import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { store, getLayer, isNoteInTimeline } from './store.js';
import { MAP_WIDTH, MAP_HEIGHT, layerY, latLngToPlane } from './projection.js';
import { computeGlobalLayout } from './layout.js';
import { createMapCanvas } from './worldMap.js';
import { matchesQuery } from './search.js';

let scene, camera, renderer, labelRenderer, controls, container;
let raycaster, pointer;
let renderScheduled = false;

const layerPlaneMeshes = new Map();
const layerBorderLines = new Map();
const layerLabelObjects = new Map();
const noteMeshes = new Map();
const noteGeometryLines = new Map();

let edgeList = [];
let edgesDefaultObj = null;
let edgesHighlightObj = null;
let selectedNoteLabel = null;

let lastStructureKey = null;

function computeStructureKey(data) {
  const layersKey = data.layers.map((l) => `${l.id}:${l.order}:${l.kind}:${l.color}:${l.name}`).join('|');
  const notesKey = data.notes
    .map((n) => `${n.id}:${n.layerId}:${n.geo ? n.geo.lat + ',' + n.geo.lng : ''}:` +
      `${n.route ? n.route.map((p) => `${p.lat},${p.lng}`).join(';') : ''}:` +
      `${n.region ? n.region.map((p) => p.join(',')).join(';') : ''}:` +
      `${n.links.map((l) => l.target).join(',')}`)
    .join('|');
  return layersKey + '##' + notesKey;
}

export function initScene(containerEl, callbacks) {
  container = containerEl;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1c1d20);
  scene.fog = new THREE.Fog(0x1c1d20, 40, 90);

  const aspect = container.clientWidth / Math.max(1, container.clientHeight);
  const viewSize = 15;
  camera = new THREE.OrthographicCamera(
    -viewSize * aspect, viewSize * aspect, viewSize, -viewSize, 0.1, 300
  );
  camera.position.set(24, 20, 24);
  camera.lookAt(0, 5, 0);

  renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'low-power' });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  container.appendChild(renderer.domElement);

  labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(container.clientWidth, container.clientHeight);
  Object.assign(labelRenderer.domElement.style, { position: 'absolute', top: '0', left: '0', pointerEvents: 'none' });
  container.appendChild(labelRenderer.domElement);

  // Фиксированный изометрический ракурс: только зум, без вращения/панорамирования —
  // так намного дешевле по GPU, чем свободная орбитальная камера с постоянным рендером.
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 5, 0);
  controls.enableDamping = false;
  controls.enableRotate = false;
  controls.enablePan = false;
  controls.enableZoom = true;
  controls.minZoom = 0.4;
  controls.maxZoom = 3;
  controls.addEventListener('change', requestRender);
  controls.update();

  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();

  const labelDiv = document.createElement('div');
  labelDiv.className = 'note-label';
  selectedNoteLabel = new CSS2DObject(labelDiv);
  selectedNoteLabel.visible = false;
  scene.add(selectedNoteLabel);

  renderer.domElement.addEventListener('click', (event) => onClick(event, callbacks));
  renderer.domElement.addEventListener('dblclick', (event) => onDblClick(event, callbacks));
  window.addEventListener('resize', onResize);

  requestRender();
}

function onResize() {
  if (!container) return;
  const aspect = container.clientWidth / Math.max(1, container.clientHeight);
  const viewSize = 15;
  camera.left = -viewSize * aspect;
  camera.right = viewSize * aspect;
  camera.top = viewSize;
  camera.bottom = -viewSize;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
  labelRenderer.setSize(container.clientWidth, container.clientHeight);
  requestRender();
}

/** Рендерим только когда что-то реально изменилось (зум, данные, ресайз) — не 60 кадров/сек вхолостую. */
function requestRender() {
  if (!scene || renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => {
    renderScheduled = false;
    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  });
}

function onClick(event, callbacks) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const noteHit = raycaster.intersectObjects([...noteMeshes.values()]).find((hit) => hit.object.visible);
  if (noteHit) {
    callbacks.onSelectNote(noteHit.object.userData.noteId);
    return;
  }

  const planeHit = raycaster.intersectObjects([...layerPlaneMeshes.values()]).find((hit) => hit.object.visible);
  if (planeHit) {
    callbacks.onSelectLayer(planeHit.object.userData.layerId);
  }
}

function onDblClick(event, callbacks) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const noteHit = raycaster.intersectObjects([...noteMeshes.values()]).find((hit) => hit.object.visible);
  if (noteHit) {
    callbacks.onEditNote(noteHit.object.userData.noteId);
  }
}

function disposeMesh(mesh) {
  scene.remove(mesh);
  mesh.geometry?.dispose();
  if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
  else mesh.material?.dispose();
}

function clearStructure() {
  for (const mesh of layerPlaneMeshes.values()) disposeMesh(mesh);
  for (const line of layerBorderLines.values()) disposeMesh(line);
  for (const label of layerLabelObjects.values()) {
    scene.remove(label);
    label.element.remove();
  }
  for (const mesh of noteMeshes.values()) disposeMesh(mesh);
  for (const line of noteGeometryLines.values()) disposeMesh(line);
  layerPlaneMeshes.clear();
  layerBorderLines.clear();
  layerLabelObjects.clear();
  noteMeshes.clear();
  noteGeometryLines.clear();
}

function buildLayerPlane(layer) {
  const geometry = new THREE.PlaneGeometry(MAP_WIDTH, MAP_HEIGHT);
  geometry.rotateX(-Math.PI / 2);

  let material;
  if (layer.kind === 'map') {
    const canvas = createMapCanvas();
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.97, side: THREE.DoubleSide });
  } else {
    material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(layer.color || '#ffffff'),
      transparent: true,
      opacity: Math.min(0.4, (layer.opacity ?? 0.85) * 0.28),
      side: THREE.DoubleSide,
      depthWrite: false
    });
  }

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(0, layerY(layer.order), 0);
  mesh.userData.layerId = layer.id;
  scene.add(mesh);
  layerPlaneMeshes.set(layer.id, mesh);

  const hw = MAP_WIDTH / 2;
  const hh = MAP_HEIGHT / 2;
  const y = layerY(layer.order);
  const corners = [
    new THREE.Vector3(-hw, y, -hh), new THREE.Vector3(hw, y, -hh),
    new THREE.Vector3(hw, y, -hh), new THREE.Vector3(hw, y, hh),
    new THREE.Vector3(hw, y, hh), new THREE.Vector3(-hw, y, hh),
    new THREE.Vector3(-hw, y, hh), new THREE.Vector3(-hw, y, -hh)
  ];
  const borderGeom = new THREE.BufferGeometry().setFromPoints(corners);
  const borderMat = new THREE.LineBasicMaterial({ color: new THREE.Color(layer.color || '#ffffff'), transparent: true, opacity: 0.5 });
  const border = new THREE.LineSegments(borderGeom, borderMat);
  scene.add(border);
  layerBorderLines.set(layer.id, border);

  const labelDiv = document.createElement('div');
  labelDiv.className = 'layer-label';
  labelDiv.textContent = layer.name;
  const label = new CSS2DObject(labelDiv);
  label.position.set(hw + 1.6, y, 0);
  scene.add(label);
  layerLabelObjects.set(layer.id, label);
}

function buildNoteMesh(note, position) {
  const layer = getLayer(note.layerId);
  const y = layer ? layerY(layer.order) : 0;
  const radius = 0.14 + Math.min(0.18, note.links.length * 0.03);
  const geometry = new THREE.SphereGeometry(radius, 16, 12);
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color((layer && layer.color) || '#ffffff')
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position.x, y, position.z);
  mesh.userData.noteId = note.id;
  mesh.userData.layerId = note.layerId;
  scene.add(mesh);
  noteMeshes.set(note.id, mesh);
}

/** Рисует маршрут (ломаная) или регион (замкнутый контур) заметки поверх её слоя. */
function buildNoteGeometryLine(note) {
  let points = null;
  let closed = false;
  if (note.route && note.route.length > 1) {
    points = note.route.map((p) => latLngToPlane(p.lat, p.lng));
  } else if (note.region && note.region.length > 1) {
    points = note.region.map(([lat, lng]) => latLngToPlane(lat, lng));
    closed = true;
  }
  if (!points) return;

  const layer = getLayer(note.layerId);
  const y = layer ? layerY(layer.order) : 0;
  const vecPoints = points.map((p) => new THREE.Vector3(p.x, y, p.z));
  if (closed) vecPoints.push(vecPoints[0].clone());

  const geometry = new THREE.BufferGeometry().setFromPoints(vecPoints);
  const material = new THREE.LineBasicMaterial({
    color: new THREE.Color((layer && layer.color) || '#ffffff'),
    transparent: true,
    opacity: 0.85
  });
  const line = new THREE.Line(geometry, material);
  line.userData.noteId = note.id;
  scene.add(line);
  noteGeometryLines.set(note.id, line);
}

function rebuild() {
  clearStructure();

  const layers = [...store.data.layers].sort((a, b) => a.order - b.order);
  for (const layer of layers) buildLayerPlane(layer);

  const positions = computeGlobalLayout(store.data.notes);
  for (const note of store.data.notes) {
    const pos = positions.get(note.id) || { x: 0, z: 0 };
    buildNoteMesh(note, pos);
    buildNoteGeometryLine(note);
  }

  edgeList = [];
  const seen = new Set();
  for (const note of store.data.notes) {
    for (const link of note.links) {
      if (!noteMeshes.has(link.target)) continue;
      const key = [note.id, link.target].sort().join('~');
      if (seen.has(key)) continue;
      seen.add(key);
      edgeList.push({ aId: note.id, bId: link.target });
    }
  }
}

function applyFilters() {
  for (const layer of store.data.layers) {
    const plane = layerPlaneMeshes.get(layer.id);
    if (plane) plane.visible = layer.visible;
    const border = layerBorderLines.get(layer.id);
    if (border) border.visible = layer.visible;
    const label = layerLabelObjects.get(layer.id);
    if (label) label.visible = layer.visible;
  }
  for (const note of store.data.notes) {
    const mesh = noteMeshes.get(note.id);
    if (!mesh) continue;
    const layer = getLayer(note.layerId);
    mesh.visible = (layer ? layer.visible : true) && isNoteInTimeline(note) && matchesQuery(note, store.searchQuery);
    const line = noteGeometryLines.get(note.id);
    if (line) line.visible = mesh.visible;
  }
}

function makeLineSegments(points, color, opacity) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
  return new THREE.LineSegments(geometry, material);
}

function rebuildEdges() {
  if (edgesDefaultObj) disposeMesh(edgesDefaultObj);
  if (edgesHighlightObj) disposeMesh(edgesHighlightObj);

  const normalPts = [];
  const highlightPts = [];
  const selLayerId = store.selection.layerId;
  const selNoteId = store.selection.noteId;

  for (const { aId, bId } of edgeList) {
    const meshA = noteMeshes.get(aId);
    const meshB = noteMeshes.get(bId);
    if (!meshA || !meshB || !meshA.visible || !meshB.visible) continue;

    const highlighted =
      (!!selLayerId && (meshA.userData.layerId === selLayerId || meshB.userData.layerId === selLayerId)) ||
      (!!selNoteId && (aId === selNoteId || bId === selNoteId));

    const bucket = highlighted ? highlightPts : normalPts;
    bucket.push(meshA.position.clone(), meshB.position.clone());
  }

  edgesDefaultObj = makeLineSegments(normalPts, 0xaaaaaa, 0.22);
  edgesHighlightObj = makeLineSegments(highlightPts, 0xe0645a, 0.9);
  scene.add(edgesDefaultObj);
  scene.add(edgesHighlightObj);
}

function updateHighlightVisuals() {
  for (const [layerId, label] of layerLabelObjects) {
    label.element.classList.toggle('active', layerId === store.selection.layerId);
  }
  for (const [noteId, mesh] of noteMeshes) {
    const isSelected = noteId === store.selection.noteId;
    mesh.scale.setScalar(isSelected ? 1.6 : 1);
  }

  const note = store.selection.noteId ? store.data.notes.find((n) => n.id === store.selection.noteId) : null;
  if (note && noteMeshes.has(note.id)) {
    const mesh = noteMeshes.get(note.id);
    selectedNoteLabel.element.textContent = note.title;
    selectedNoteLabel.position.copy(mesh.position);
    selectedNoteLabel.position.y += 0.5;
    selectedNoteLabel.visible = mesh.visible;
  } else {
    selectedNoteLabel.visible = false;
  }
}

export function syncScene() {
  if (!scene) return;
  const key = computeStructureKey(store.data);
  if (key !== lastStructureKey) {
    rebuild();
    lastStructureKey = key;
  }
  applyFilters();
  rebuildEdges();
  updateHighlightVisuals();
  requestRender();
}
