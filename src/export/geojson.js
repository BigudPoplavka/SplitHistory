/** Экспорт геопривязанных заметок (точки/маршруты/регионы) в GeoJSON для QGIS/Google Earth. */
export function exportToGeoJSON(data) {
  const features = [];

  for (const note of data.notes) {
    const props = { id: note.id, title: note.title, type: note.type };

    if (note.route && note.route.length > 0) {
      features.push({
        type: 'Feature',
        properties: props,
        geometry: { type: 'LineString', coordinates: note.route.map((p) => [p.lng, p.lat]) }
      });
    } else if (note.region && note.region.length > 0) {
      const ring = note.region.map(([lat, lng]) => [lng, lat]);
      if (ring.length > 0) ring.push(ring[0]);
      features.push({
        type: 'Feature',
        properties: props,
        geometry: { type: 'Polygon', coordinates: [ring] }
      });
    } else if (note.geo) {
      features.push({
        type: 'Feature',
        properties: props,
        geometry: { type: 'Point', coordinates: [note.geo.lng, note.geo.lat] }
      });
    }
  }

  return JSON.stringify({ type: 'FeatureCollection', features }, null, 2);
}
