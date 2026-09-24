function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/** Расстояние между двумя точками (км) по формуле гаверсинуса. */
export function haversineDistanceKm(a, b) {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function centroid(points) {
  if (!points || points.length === 0) return null;
  const sum = points.reduce((acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }), { lat: 0, lng: 0 });
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
}

/**
 * Единая "якорная" точка заметки для силового лэйаута и карты: собственная точка,
 * либо центроид маршрута/региона, если точки нет, а есть только протяжённая геометрия.
 */
export function getNoteAnchor(note) {
  if (note.geo && typeof note.geo.lat === 'number' && typeof note.geo.lng === 'number') {
    return { lat: note.geo.lat, lng: note.geo.lng };
  }
  if (note.route && note.route.length > 0) return centroid(note.route);
  if (note.region && note.region.length > 0) {
    return centroid(note.region.map(([lat, lng]) => ({ lat, lng })));
  }
  return null;
}
