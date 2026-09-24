/** Равнопромежуточная (equirectangular) проекция геокоординат на плоскость сцены. */

export const MAP_WIDTH = 24;
export const MAP_HEIGHT = 12;
export const LAYER_HEIGHT_STEP = 4.2;

export function latLngToPlane(lat, lng) {
  const x = (lng / 180) * (MAP_WIDTH / 2);
  const z = -(lat / 90) * (MAP_HEIGHT / 2);
  return { x, z };
}

export function layerY(order) {
  return order * LAYER_HEIGHT_STEP;
}
