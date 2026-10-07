import { CONTINENTS } from './worldOutline.js';

/**
 * Настоящие контуры суши (упрощённые из Natural Earth 1:50m через world-atlas/topojson-client,
 * см. data/world-land-50m.json) — массив колец [[lat,lng], ...]. Грузится один раз при старте
 * (см. loadWorldLandData); пока не загрузилось (или если загрузка не удалась) используется
 * стилизованный фоллбэк из worldOutline.js, чтобы приложение не падало без сети/файла.
 */
let realLandRings = null;
let loadPromise = null;

export function loadWorldLandData() {
  if (loadPromise) return loadPromise;
  loadPromise = fetch('./data/world-land-50m.json')
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
    .then((rings) => { realLandRings = rings; })
    .catch((err) => {
      console.warn('Не удалось загрузить реальные контуры карты, использую упрощённый фоллбэк:', err);
      realLandRings = null;
    });
  return loadPromise;
}

function lngLatToCanvas(lat, lng, width, height) {
  return {
    x: ((lng + 180) / 360) * width,
    y: ((90 - lat) / 180) * height
  };
}

export function drawWorldOutline(ctx, width, height, { fill = '#3c3f45', stroke = '#4c4f56' } = {}) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;

  const rings = realLandRings && realLandRings.length ? realLandRings : CONTINENTS.map((c) => c.points);

  for (const ring of rings) {
    ctx.beginPath();
    ring.forEach(([lat, lng], i) => {
      const { x, y } = lngLatToCanvas(lat, lng, width, height);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    if (!realLandRings) ctx.stroke();
  }
}

/** Готовая canvas-текстура плоскости карты (нижний ground-слой сцены). Высокое разрешение — чтобы не мылилось при зуме камеры. */
export function createMapCanvas(width = 2048, height = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#1b2430';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += width / 24) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += height / 12) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  drawWorldOutline(ctx, width, height, { fill: '#3c4a3c', stroke: '#52614f' });

  return canvas;
}

export function lngLatToUnit(lat, lng) {
  return { x: (lng + 180) / 360, y: (90 - lat) / 180 };
}

/** Обратное преобразование: пиксель/доля канвы карты → географические координаты. */
export function unitToLngLat(unitX, unitY) {
  return {
    lng: unitX * 360 - 180,
    lat: 90 - unitY * 180
  };
}
