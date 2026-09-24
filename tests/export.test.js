import { describe, it, expect } from 'vitest';
import { exportToGraphML } from '../src/export/graphml.js';
import { exportToGeoJSON } from '../src/export/geojson.js';
import { exportToTimelineCSV } from '../src/export/csv.js';

const data = {
  layers: [{ id: 'people', name: 'Люди' }],
  notes: [
    {
      id: 'n1', title: 'Исаак Ньютон', type: 'person', layerId: 'people',
      dateStart: 1643, dateEnd: 1727, geo: { lat: 52.2, lng: 0.12 },
      links: [{ target: 'n2', type: 'соперничал' }]
    },
    {
      id: 'n2', title: 'Готфрид Лейбниц', type: 'person', layerId: 'people',
      dateStart: 1646, dateEnd: 1716, geo: null,
      route: [{ lat: 51, lng: 12 }, { lat: 52, lng: 13 }],
      links: []
    }
  ]
};

describe('exportToGraphML', () => {
  const xml = exportToGraphML(data);

  it('includes a node per note with escaped labels', () => {
    expect(xml).toContain('<node id="n1">');
    expect(xml).toContain('Исаак Ньютон');
  });
  it('includes an edge for each link to an existing note', () => {
    expect(xml).toContain('<edge source="n1" target="n2">');
  });
  it('produces well-formed opening/closing graphml tags', () => {
    expect(xml.trim().startsWith('<?xml')).toBe(true);
    expect(xml.trim().endsWith('</graphml>')).toBe(true);
  });
});

describe('exportToGeoJSON', () => {
  const geojson = JSON.parse(exportToGeoJSON(data));

  it('produces a FeatureCollection', () => {
    expect(geojson.type).toBe('FeatureCollection');
    expect(geojson.features).toHaveLength(2);
  });
  it('exports a point for geo notes', () => {
    const point = geojson.features.find((f) => f.properties.id === 'n1');
    expect(point.geometry).toEqual({ type: 'Point', coordinates: [0.12, 52.2] });
  });
  it('exports a LineString for route notes', () => {
    const line = geojson.features.find((f) => f.properties.id === 'n2');
    expect(line.geometry.type).toBe('LineString');
    expect(line.geometry.coordinates).toEqual([[12, 51], [13, 52]]);
  });
});

describe('exportToTimelineCSV', () => {
  const csv = exportToTimelineCSV(data);

  it('has a header row', () => {
    expect(csv.split('\n')[0]).toBe('title,dateStart,dateEnd,layer,type');
  });
  it('has one row per note with the resolved layer name', () => {
    const rows = csv.split('\n');
    expect(rows).toHaveLength(3);
    expect(rows[1]).toBe('Исаак Ньютон,1643,1727,Люди,person');
  });
});
