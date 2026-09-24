function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Экспорт таймлайна в CSV (для TimelineJS и подобных внешних визуализаторов). */
export function exportToTimelineCSV(data) {
  const layerById = new Map(data.layers.map((l) => [l.id, l]));
  const header = ['title', 'dateStart', 'dateEnd', 'layer', 'type'];
  const rows = data.notes.map((n) => [
    n.title,
    n.dateStart ?? '',
    n.dateEnd ?? '',
    layerById.get(n.layerId)?.name ?? '',
    n.type
  ]);
  return [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
}
