/** Простой линейный текстовый поиск по заметке — по названию, тексту и тегам. */
export function matchesQuery(note, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  if (note.title && note.title.toLowerCase().includes(q)) return true;
  if (note.content && note.content.toLowerCase().includes(q)) return true;
  if (note.tags && note.tags.some((t) => t.toLowerCase().includes(q))) return true;
  return false;
}

/**
 * Релевантность названия заметки запросу: точное совпадение > начинается с запроса >
 * содержит запрос (чем раньше — тем выше). -1, если совпадения нет вовсе.
 */
export function scoreTitleMatch(title, query) {
  const t = String(title || '').toLowerCase();
  const q = String(query || '').trim().toLowerCase();
  if (!q) return 0;
  if (t === q) return 100;
  if (t.startsWith(q)) return 80 - Math.min(20, t.length - q.length);
  const idx = t.indexOf(q);
  if (idx === -1) return -1;
  return 50 - Math.min(40, idx);
}

/** Заметки, отсортированные по релевантности названия запросу (без совпадений исключены). */
export function rankNotesByTitle(notes, query, limit = 10) {
  return notes
    .map((note) => ({ note, score: scoreTitleMatch(note.title, query) }))
    .filter((r) => r.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.note);
}
