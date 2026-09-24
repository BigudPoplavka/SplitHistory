import { describe, it, expect } from 'vitest';
import { haversineDistanceKm, centroid, getNoteAnchor } from '../src/geo.js';

describe('haversineDistanceKm', () => {
  it('returns 0 for identical points', () => {
    expect(haversineDistanceKm({ lat: 51.5, lng: -0.12 }, { lat: 51.5, lng: -0.12 })).toBeCloseTo(0, 5);
  });
  it('returns a plausible distance London-Paris (~340km)', () => {
    const london = { lat: 51.5074, lng: -0.1278 };
    const paris = { lat: 48.8566, lng: 2.3522 };
    const d = haversineDistanceKm(london, paris);
    expect(d).toBeGreaterThan(300);
    expect(d).toBeLessThan(380);
  });
});

describe('centroid', () => {
  it('returns null for empty input', () => {
    expect(centroid([])).toBeNull();
    expect(centroid(null)).toBeNull();
  });
  it('averages points', () => {
    expect(centroid([{ lat: 0, lng: 0 }, { lat: 10, lng: 20 }])).toEqual({ lat: 5, lng: 10 });
  });
});

describe('getNoteAnchor', () => {
  it('prefers the point geo when present', () => {
    const note = { geo: { lat: 1, lng: 2 }, route: [{ lat: 9, lng: 9 }] };
    expect(getNoteAnchor(note)).toEqual({ lat: 1, lng: 2 });
  });
  it('falls back to route centroid', () => {
    const note = { geo: null, route: [{ lat: 0, lng: 0 }, { lat: 2, lng: 4 }] };
    expect(getNoteAnchor(note)).toEqual({ lat: 1, lng: 2 });
  });
  it('falls back to region centroid', () => {
    const note = { geo: null, route: null, region: [[0, 0], [2, 4]] };
    expect(getNoteAnchor(note)).toEqual({ lat: 1, lng: 2 });
  });
  it('returns null when no geometry at all', () => {
    expect(getNoteAnchor({})).toBeNull();
  });
});
