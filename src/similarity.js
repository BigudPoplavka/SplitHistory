export function normalizeTitle(title) {
  return String(title || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Расстояние Левенштейна (редакционное расстояние) без внешних зависимостей. */
export function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;

  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[n];
}

/** 1 = идентичные названия (после нормализации), 0 = совсем разные. */
export function titleSimilarity(a, b) {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const dist = levenshtein(na, nb);
  return 1 - dist / Math.max(na.length, nb.length);
}

/** Заметки того же типа с похожим названием — кандидаты в дубликаты. */
export function findSimilarNotes(title, type, notes, excludeId, threshold = 0.82) {
  return notes
    .filter((n) => n.id !== excludeId && n.type === type)
    .map((n) => ({ note: n, score: titleSimilarity(title, n.title) }))
    .filter((r) => r.score >= threshold)
    .sort((a, b) => b.score - a.score);
}
