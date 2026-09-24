/** Небольшой парсер BibTeX без внешних зависимостей — рассчитан на плоские (без вложенных {}) поля. */
export function parseBibTeX(text) {
  const entries = [];
  const entryRe = /@(\w+)\s*\{\s*([^,]+),([\s\S]*?)\n\}/g;
  let match;
  while ((match = entryRe.exec(text)) !== null) {
    const [, , key, body] = match;
    const fields = {};
    const fieldRe = /(\w+)\s*=\s*[{"]([^}"]*)[}"]\s*,?/g;
    let fieldMatch;
    while ((fieldMatch = fieldRe.exec(body)) !== null) {
      fields[fieldMatch[1].toLowerCase()] = fieldMatch[2].trim();
    }
    entries.push({
      key: key.trim(),
      title: fields.title || key.trim(),
      author: fields.author || '',
      publicationYear: fields.year ? Number(fields.year) : null,
      publisher: fields.publisher || fields.journal || '',
      url: fields.url || ''
    });
  }
  return entries;
}

/** Заготовка заметки типа "источник" на основе разобранной BibTeX-записи. */
export function bibEntryToNotePartial(entry, layerId) {
  return {
    layerId,
    title: entry.title,
    type: 'source',
    citation: {
      author: entry.author,
      publicationYear: entry.publicationYear ?? null,
      publisher: entry.publisher,
      url: entry.url,
      reliability: 3
    }
  };
}
