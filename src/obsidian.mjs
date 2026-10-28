// Pure helpers shared by the desktop importer and Markdown preview.
export function references(content) {
  const result = [];
  const text = String(content || '').replace(/```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`/g, '');
  for (const m of text.matchAll(/!?\[\[([^\]|]+)(?:\|[^\]]*)?\]\]|!?\[[^\]]*\]\((<[^>]+>|[^\s)]+)(?:\s+"[^"]*")?\)/g)) {
    let raw = (m[1] || m[2]).replace(/^<|>$/g, '');
    try { raw = decodeURIComponent(raw); } catch {}
    if (/^[a-z][a-z\d+.-]*:/i.test(raw) || raw.startsWith('//')) continue;
    const file = raw.split('#')[0];
    if (file) result.push({ raw, file, wiki: !!m[1] });
  }
  return result;
}
export function resolveFile(ref, source, files) {
  const normalize = value => {
    const parts = [];
    for (const part of value.replace(/\\/g, '/').split('/')) {
      if (part === '..') { if (!parts.length) return null; parts.pop(); }
      else if (part && part !== '.') parts.push(part);
    }
    return parts.join('/');
  };
  const parent = source.includes('/') ? source.slice(0, source.lastIndexOf('/') + 1) : '';
  const direct = normalize(ref.file.replace(/^\//, ''));
  const relative = normalize(parent + ref.file);
  const candidates = ref.wiki ? [direct, relative] : [relative, direct];
  for (const candidate of candidates) {
    if (!candidate) continue;
    for (const name of [candidate, candidate + '.md']) {
      if (files.includes(name)) return name;
    }
  }
  if (/^(\.\.?\/|\/)/.test(ref.file)) return null;
  const suffix = direct;
  if (!suffix) return null;
  const matches = files.filter(f => f === suffix || f.endsWith('/' + suffix) || f === suffix + '.md' || f.endsWith('/' + suffix + '.md'));
  return matches.length === 1 ? matches[0] : null;
}
export function extractTags(content) {
  const tags = new Set();
  const front = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
  if (front) {
    const match = /^(?:tags|tag):[ \t]*(.*)(?:\r?\n((?:[ \t]+-.*\r?\n?)*))?/m.exec(front[1]);
    if (match) for (const value of (match[1] + '\n' + (match[2] || '')).replace(/[\[\]"']/g, '').split(/[,\n]/)) {
      const tag = value.trim().replace(/^-\s*/, '').replace(/^#/, '');
      if (tag) tags.add(tag);
    }
  }
  const body = (front ? content.slice(front[0].length) : content).replace(/```[\s\S]*?```|`[^`]*`/g, '');
  for (const m of body.matchAll(/(?:^|\s)#([\p{L}\p{N}_/-]+)/gu)) if (!/^\d+$/.test(m[1])) tags.add(m[1]);
  return [...tags];
}
