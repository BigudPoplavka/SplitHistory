import { CONTINENTS } from './worldOutline.js';

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
  for (const continent of CONTINENTS) {
    ctx.beginPath();
    continent.points.forEach(([lat, lng], i) => {
      const { x, y } = lngLatToCanvas(lat, lng, width, height);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

/** Готовая canvas-текстура плоскости карты (нижний ground-слой сцены). */
export function createMapCanvas(width = 1024, height = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#23262b';
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

  drawWorldOutline(ctx, width, height, { fill: '#3c3f45', stroke: '#54575e' });

  return canvas;
}

export function lngLatToUnit(lat, lng) {
  return { x: (lng + 180) / 360, y: (90 - lat) / 180 };
}
