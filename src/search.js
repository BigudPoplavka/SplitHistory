/** Простой линейный текстовый поиск по заметке — по названию, тексту и тегам. */
export function matchesQuery(note, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  if (note.title && note.title.toLowerCase().includes(q)) return true;
  if (note.content && note.content.toLowerCase().includes(q)) return true;
  if (note.tags && note.tags.some((t) => t.toLowerCase().includes(q))) return true;
  return false;
}
