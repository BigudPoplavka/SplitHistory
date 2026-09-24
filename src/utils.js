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

const HEADING_RE = /^(#{1,6})\s+(.+)$/;
const UL_RE = /^[-*]\s+(.+)$/;
const OL_RE = /^\d+\.\s+(.+)$/;

/** Заголовки текста заметки в порядке появления — основа для панели "Содержание". */
export function extractHeadings(content) {
  const headings = [];
  for (const rawLine of String(content || '').split('\n')) {
    const match = HEADING_RE.exec(rawLine.trim());
    if (match) headings.push({ level: match[1].length, text: match[2].trim() });
  }
  return headings;
}

function renderInline(text, notes, selfId) {
  let html = escapeHtml(text);

  html = html.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (full, title, alias) => {
    const cleanTitle = title.trim();
    const label = escapeHtml((alias || cleanTitle).trim());
    const target = (notes || []).find(
      (n) => n.id !== selfId && n.title.trim().toLowerCase() === cleanTitle.toLowerCase()
    );
    return target
      ? `<span class="md-wikilink resolved" data-note-id="${target.id}">${label}</span>`
      : `<span class="md-wikilink unresolved" data-title="${escapeHtml(cleanTitle)}">${label}</span>`;
  });

  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (full, label, url) =>
    `<a href="#" class="md-link" data-href="${escapeHtml(url)}">${escapeHtml(label)}</a>`);

  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  return html;
}

/**
 * Небольшой markdown-рендерер без зависимостей: заголовки (# — ######, разного цвета по уровню),
 * списки, абзацы, жирный/курсив/код, [[вики-ссылки]] и [текст](url).
 */
export function renderMarkdownToHtml(content, notes, selfId) {
  const lines = String(content || '').split('\n');
  const blocks = [];
  let paragraph = [];
  let list = null;
  let headingIndex = 0;

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push(`<p>${paragraph.map((l) => renderInline(l, notes, selfId)).join('<br>')}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      const items = list.items.map((i) => `<li>${renderInline(i, notes, selfId)}</li>`).join('');
      blocks.push(`<${list.type}>${items}</${list.type}>`);
      list = null;
    }
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    const headingMatch = HEADING_RE.exec(trimmed);
    const ulMatch = UL_RE.exec(trimmed);
    const olMatch = OL_RE.exec(trimmed);

    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = headingMatch[1].length;
      const id = `md-h-${headingIndex++}`;
      blocks.push(`<h${level} id="${id}" class="md-heading md-h${level}">${renderInline(headingMatch[2], notes, selfId)}</h${level}>`);
    } else if (ulMatch) {
      flushParagraph();
      if (!list || list.type !== 'ul') { flushList(); list = { type: 'ul', items: [] }; }
      list.items.push(ulMatch[1]);
    } else if (olMatch) {
      flushParagraph();
      if (!list || list.type !== 'ol') { flushList(); list = { type: 'ol', items: [] }; }
      list.items.push(olMatch[1]);
    } else if (trimmed === '') {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraph.push(rawLine);
    }
  }
  flushParagraph();
  flushList();

  return blocks.join('\n') || '<p class="md-empty">Пусто — переключитесь в режим редактирования, чтобы начать писать.</p>';
}
