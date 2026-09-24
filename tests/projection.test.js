import { describe, it, expect } from 'vitest';
import { latLngToPlane, layerY, MAP_WIDTH, MAP_HEIGHT, LAYER_HEIGHT_STEP } from '../src/projection.js';

describe('latLngToPlane', () => {
  it('maps (0,0) to the plane origin', () => {
    const { x, z } = latLngToPlane(0, 0);
    expect(x).toBe(0);
    expect(z).toBeCloseTo(0, 10);
  });
  it('maps the corners to the plane extents', () => {
    expect(latLngToPlane(90, 180)).toEqual({ x: MAP_WIDTH / 2, z: -MAP_HEIGHT / 2 });
    expect(latLngToPlane(-90, -180)).toEqual({ x: -MAP_WIDTH / 2, z: MAP_HEIGHT / 2 });
  });
});

describe('layerY', () => {
  it('scales linearly with order', () => {
    expect(layerY(0)).toBe(0);
    expect(layerY(2)).toBe(2 * LAYER_HEIGHT_STEP);
  });
});
