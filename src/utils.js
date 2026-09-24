export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

export const TYPE_LABELS = {
  event: 'Событие',
  person: 'Личность',
  idea: 'Факт / идея',
  source: 'Источник',
  artifact: 'Артефакт / место',
  other: 'Прочее'
};

export function formatYear(year) {
  if (typeof year !== 'number') return '';
  if (year < 0) return `${Math.abs(year)} до н.э.`;
  return String(year);
}

export function formatDateRange(note) {
  const hasStart = typeof note.dateStart === 'number';
  const hasEnd = typeof note.dateEnd === 'number';
  if (!hasStart && !hasEnd) return '';
  if (hasStart && hasEnd && note.dateStart !== note.dateEnd) {
    return `${formatYear(note.dateStart)} — ${formatYear(note.dateEnd)}`;
  }
  return formatYear(hasStart ? note.dateStart : note.dateEnd);
}

const WIKI_LINK_RE = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;

/** Заголовки заметок, на которые ссылается текст через [[Название]] (или [[Название|Алиас]]). */
export function extractWikiLinkTitles(content) {
  const titles = new Set();
  let match;
  WIKI_LINK_RE.lastIndex = 0;
  while ((match = WIKI_LINK_RE.exec(content || '')) !== null) {
    const title = match[1].trim();
    if (title) titles.add(title);
  }
  return [...titles];
}

/** Сопоставляет заголовки из [[ ]] с реальными заметками (по точному совпадению названия). */
export function resolveWikiLinks(content, notes, selfId) {
  const titles = extractWikiLinkTitles(content);
  return titles.map((title) => {
    const note = notes.find((n) => n.id !== selfId && n.title.trim().toLowerCase() === title.toLowerCase());
    return { title, note: note || null };
  });
}

export function parseTagsInput(value) {
  return [...new Set(
    String(value || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
  )];
}
